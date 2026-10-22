import { spawn, type ChildProcess } from "node:child_process";
import { platform } from "node:os";

import type {
  WorkspaceCommandExecutor,
  WorkspaceCommandRequest,
  WorkspaceCommandResult,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import {
  normalizeWorkspaceRelativePath,
  resolveExistingWorkspacePath,
} from "./workspace-path-security";

// Two streams plus worst-case JSON control-character escaping remain below the
// ControlledToolService 100,000-character serialized output limit.
const OUTPUT_CHARACTER_LIMIT = 8_000;
const TERMINATION_GRACE_MS = 2_000;

export class HostWorkspaceCommandExecutor implements WorkspaceCommandExecutor {
  async execute(
    input: WorkspaceCommandRequest,
    signal: AbortSignal,
  ): Promise<WorkspaceCommandResult> {
    signal.throwIfAborted();
    const relativeCwd = normalizeWorkspaceRelativePath(input.cwd, true);
    const cwd = await resolveExistingWorkspacePath(input.rootRef, relativeCwd);
    signal.throwIfAborted();
    const launch = commandLaunch(input.command);
    const startedAt = Date.now();
    const stdout = new BoundedText(OUTPUT_CHARACTER_LIMIT);
    const stderr = new BoundedText(OUTPUT_CHARACTER_LIMIT);

    return new Promise<WorkspaceCommandResult>((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = spawn(launch.command, launch.args, {
          cwd,
          shell: false,
          env: commandEnvironment(),
          windowsHide: true,
          detached: platform() !== "win32",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        reject(commandStartError(error));
        return;
      }

      let finished = false;
      let timedOut = false;
      let cancelled = false;
      let forceTimer: ReturnType<typeof setTimeout> | undefined;
      const timeout = setTimeout(() => {
        timedOut = true;
        terminateProcessTree(child);
        forceTimer = scheduleForceTermination(child);
      }, input.timeoutMs);
      const abort = () => {
        cancelled = true;
        terminateProcessTree(child);
        forceTimer = scheduleForceTermination(child);
      };
      signal.addEventListener("abort", abort, { once: true });
      child.stdout?.on("data", (chunk: Buffer | string) => stdout.append(chunk));
      child.stderr?.on("data", (chunk: Buffer | string) => stderr.append(chunk));
      child.once("error", (error) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(commandStartError(error));
      });
      child.once("close", (exitCode, exitSignal) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (cancelled || signal.aborted) {
          reject(Object.assign(new Error("Command cancelled"), { name: "AbortError" }));
          return;
        }
        resolve({
          cwd: relativeCwd || ".",
          exitCode,
          ...(exitSignal ? { signal: exitSignal } : {}),
          stdout: stdout.value(),
          stderr: stderr.value(),
          timedOut,
          truncated: stdout.truncated || stderr.truncated,
          durationMs: Date.now() - startedAt,
        });
      });

      function cleanup(): void {
        clearTimeout(timeout);
        if (forceTimer) clearTimeout(forceTimer);
        signal.removeEventListener("abort", abort);
      }
    });
  }
}

export function commandLaunch(command: string): { command: string; args: readonly string[] } {
  if (platform() === "win32") {
    return {
      command: "powershell.exe",
      args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    };
  }
  if (platform() === "darwin") {
    return { command: "/bin/zsh", args: ["-l", "-c", command] };
  }
  return { command: "/bin/bash", args: ["-l", "-c", command] };
}

function commandEnvironment(): NodeJS.ProcessEnv {
  const keys = [
    "PATH",
    "HOME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "USER",
    "LOGNAME",
    "SHELL",
    "LANG",
    "LC_ALL",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "PATHEXT",
    "LOCALAPPDATA",
    "APPDATA",
    "ProgramFiles",
    "ProgramFiles(x86)",
  ] as const;
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = process.env[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

function terminateProcessTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (platform() === "win32") {
    const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    killer.unref();
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function scheduleForceTermination(child: ChildProcess): ReturnType<typeof setTimeout> | undefined {
  if (!child.pid || platform() === "win32") return undefined;
  const processGroupId = child.pid;
  return setTimeout(() => {
    try {
      process.kill(-processGroupId, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }, TERMINATION_GRACE_MS);
}

class BoundedText {
  private readonly halfLimit: number;
  private head = "";
  private tail = "";
  private totalCharacters = 0;

  constructor(private readonly limit: number) {
    this.halfLimit = Math.floor(limit / 2);
  }

  get truncated(): boolean {
    return this.totalCharacters > this.limit;
  }

  append(chunk: Buffer | string): void {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    this.totalCharacters += text.length;
    const needed = Math.max(0, this.halfLimit - this.head.length);
    if (needed > 0) this.head += text.slice(0, needed);
    const remainder = text.slice(needed);
    this.tail = `${this.tail}${remainder}`.slice(-this.halfLimit);
  }

  value(): string {
    if (!this.truncated) return `${this.head}${this.tail}`;
    return `${this.head}\n…输出已截断…\n${this.tail}`;
  }
}

function commandStartError(cause: unknown): AppError {
  return new AppError({
    code: "WORKSPACE_COMMAND_START_FAILED",
    category: "internal",
    userMessage: "终端命令无法启动，请检查当前系统的 Shell 环境。",
    cause,
  });
}
