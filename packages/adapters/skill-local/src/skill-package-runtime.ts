import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";

import {
  AppError,
  type InstructionSkillPackage,
  type SkillPackageStore,
  type SkillScriptExecutionRequest,
  type SkillScriptExecutionResult,
  type SkillScriptExecutor,
} from "@zimo/domain";

const SCRIPT_EXTENSIONS = new Set([".py", ".js", ".mjs", ".cjs"]);
const TEXT_RESOURCE_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml", ".csv"]);
const OUTPUT_LIMIT = 100_000;
const RESOURCE_LIMIT = 64 * 1024;
const MANIFEST_NAME = ".zimo-package.json";

type StoredManifest = {
  checksum: string;
  files: string[];
  scripts: string[];
};

export class LocalSkillPackageRuntime implements SkillPackageStore, SkillScriptExecutor {
  constructor(private readonly root: string) {}

  async install(
    skillId: string,
    skillPackage: InstructionSkillPackage,
  ): Promise<readonly string[]> {
    assertSegment(skillId, "Skill ID");
    assertChecksum(skillPackage.checksum);
    const files = normalizePackageFiles(skillPackage.files);
    const scripts = files
      .map((file) => file.path)
      .filter((path) => SCRIPT_EXTENSIONS.has(extname(path).toLowerCase()));
    const target = this.packageRoot(skillId, skillPackage.checksum);
    const staging = `${target}.staging-${randomUUID()}`;
    await mkdir(dirname(target), { recursive: true });
    await rm(staging, { recursive: true, force: true });
    try {
      for (const file of files) {
        const destination = resolveInside(staging, file.path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, file.content, { mode: 0o444, flag: "wx" });
      }
      const manifest: StoredManifest = {
        checksum: skillPackage.checksum,
        files: files.map((file) => file.path),
        scripts,
      };
      await writeFile(join(staging, MANIFEST_NAME), JSON.stringify(manifest), {
        encoding: "utf8",
        mode: 0o444,
        flag: "wx",
      });
      await rm(target, { recursive: true, force: true });
      await rename(staging, target);
      return scripts;
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
      throw packageStorageError("无法保存 Skill 安装包。", error);
    }
  }

  async remove(skillId: string): Promise<void> {
    assertSegment(skillId, "Skill ID");
    await rm(join(this.root, "packages", skillId), { recursive: true, force: true });
    await rm(join(this.root, "data", skillId), { recursive: true, force: true });
  }

  async listScripts(skillId: string, checksum: string): Promise<readonly string[]> {
    const manifest = await this.readManifest(skillId, checksum).catch(() => null);
    return manifest?.scripts ?? [];
  }

  async listResources(skillId: string, checksum: string): Promise<readonly string[]> {
    const manifest = await this.readManifest(skillId, checksum).catch(() => null);
    return manifest?.files.filter(isReadableResource) ?? [];
  }

  async readResource(skillId: string, checksum: string, path: string): Promise<string> {
    const manifest = await this.readManifest(skillId, checksum);
    const resourcePath = normalizeRelativePath(path);
    if (!manifest.files.includes(resourcePath) || !isReadableResource(resourcePath)) {
      throw runtimeError(
        "SKILL_RESOURCE_NOT_ALLOWED",
        "请求的资源不属于当前已安装 Skill，或不是支持的文本资源。",
        "security",
      );
    }
    const resource = resolveInside(this.packageRoot(skillId, checksum), resourcePath);
    try {
      const content = await readFile(resource);
      if (content.byteLength > RESOURCE_LIMIT) {
        throw runtimeError("SKILL_RESOURCE_TOO_LARGE", "Skill 资源超过读取限制。", "user");
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(content);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw runtimeError("SKILL_RESOURCE_READ_FAILED", "无法读取 Skill 资源。", "storage", error);
    }
  }

  async execute(
    request: SkillScriptExecutionRequest,
    signal: AbortSignal,
  ): Promise<SkillScriptExecutionResult> {
    const manifest = await this.readManifest(request.skillId, request.checksum);
    const scriptPath = normalizeRelativePath(request.scriptPath);
    if (!manifest.scripts.includes(scriptPath)) {
      throw runtimeError(
        "SKILL_SCRIPT_NOT_ALLOWED",
        "请求的脚本不属于当前已安装 Skill。",
        "security",
      );
    }
    const workspace = await this.prepareWorkspace(request.skillId, request.checksum, manifest);
    const script = resolveInside(workspace, scriptPath);
    const runtime = runtimeCommand(script);
    return runProcess(
      runtime.command,
      [...runtime.prefix, script, ...request.arguments],
      workspace,
      signal,
    );
  }

  private async prepareWorkspace(
    skillId: string,
    checksum: string,
    manifest: StoredManifest,
  ): Promise<string> {
    const source = this.packageRoot(skillId, checksum);
    const workspace = join(this.root, "data", skillId, "workspace");
    await mkdir(workspace, { recursive: true });
    await mkdir(join(workspace, ".tmp"), { recursive: true });
    for (const path of manifest.files) {
      const destination = resolveInside(workspace, path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(resolveInside(source, path), destination);
      await chmod(destination, 0o644);
    }
    return workspace;
  }

  private async readManifest(skillId: string, checksum: string): Promise<StoredManifest> {
    assertSegment(skillId, "Skill ID");
    assertChecksum(checksum);
    try {
      const parsed = JSON.parse(
        await readFile(join(this.packageRoot(skillId, checksum), MANIFEST_NAME), "utf8"),
      ) as Partial<StoredManifest>;
      if (
        parsed.checksum !== checksum ||
        !Array.isArray(parsed.files) ||
        !Array.isArray(parsed.scripts)
      ) {
        throw new Error("Invalid manifest");
      }
      return {
        checksum,
        files: parsed.files.map(normalizeRelativePath),
        scripts: parsed.scripts.map(normalizeRelativePath),
      };
    } catch (error) {
      throw packageStorageError("Skill 脚本文件尚未安装，请重新安装该 Skill。", error);
    }
  }

  private packageRoot(skillId: string, checksum: string): string {
    return join(this.root, "packages", skillId, checksum);
  }
}

function normalizePackageFiles(files: InstructionSkillPackage["files"]) {
  const normalized = files.map((file) => ({ ...file, path: normalizeRelativePath(file.path) }));
  const paths = new Set(normalized.map((file) => file.path));
  if (paths.size !== normalized.length || paths.has(MANIFEST_NAME)) {
    throw runtimeError("SKILL_PACKAGE_INVALID", "Skill 包包含重复或保留文件名。", "user");
  }
  return normalized;
}

function isReadableResource(path: string): boolean {
  return (
    path !== "SKILL.md" &&
    path !== "manifest.json" &&
    !path.startsWith("scripts/") &&
    TEXT_RESOURCE_EXTENSIONS.has(extname(path).toLowerCase())
  );
}

function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw runtimeError("SKILL_PACKAGE_INVALID", "Skill 包包含不安全的文件路径。", "security");
  }
  return segments.join("/");
}

function resolveInside(root: string, relativePath: string): string {
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${resolve(root)}${sep}`)) {
    throw runtimeError("SKILL_PACKAGE_INVALID", "Skill 文件路径越界。", "security");
  }
  return target;
}

function assertSegment(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) {
    throw runtimeError("SKILL_PACKAGE_INVALID", `${label} 无效。`, "security");
  }
}

function assertChecksum(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw runtimeError("SKILL_PACKAGE_INVALID", "Skill 校验值无效。", "security");
  }
}

function runtimeCommand(script: string): { command: string; prefix: string[] } {
  const extension = extname(script).toLowerCase();
  if (extension === ".py") {
    return { command: process.platform === "win32" ? "python" : "python3", prefix: [] };
  }
  if ([".js", ".mjs", ".cjs"].includes(extension)) {
    return { command: process.execPath, prefix: [] };
  }
  throw runtimeError("SKILL_SCRIPT_NOT_ALLOWED", "当前不支持该脚本类型。", "configuration");
}

async function runProcess(
  command: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
): Promise<SkillScriptExecutionResult> {
  if (signal.aborted) throw abortError();
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: runtimeEnvironment(cwd, command === process.execPath),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let exceeded = false;
    const append = (target: "stdout" | "stderr", chunk: Buffer) => {
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
      if (stdout.length + stderr.length > OUTPUT_LIMIT) {
        exceeded = true;
        child.kill();
      }
    };
    const abort = () => {
      child.kill();
      const forceKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
      forceKill.unref();
    };
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
    child.once("error", (error) => {
      signal.removeEventListener("abort", abort);
      reject(
        runtimeError(
          "SKILL_RUNTIME_NOT_AVAILABLE",
          "Skill 脚本运行环境不可用，请检查 Python 或应用运行环境。",
          "configuration",
          error,
        ),
      );
    });
    child.once("close", (code) => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) return reject(abortError());
      if (exceeded) {
        return reject(runtimeError("SKILL_SCRIPT_OUTPUT_TOO_LARGE", "Skill 脚本输出超过限制。"));
      }
      if (code !== 0) {
        return reject(runtimeError("SKILL_SCRIPT_FAILED", "Skill 脚本执行失败。"));
      }
      resolvePromise({ exitCode: code, stdout, stderr });
    });
  });
}

function runtimeEnvironment(cwd: string, electronAsNode: boolean): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? "en_US.UTF-8",
    HOME: cwd,
    USERPROFILE: cwd,
    TMPDIR: join(cwd, ".tmp"),
    TEMP: join(cwd, ".tmp"),
    TMP: join(cwd, ".tmp"),
  };
  for (const key of ["SystemRoot", "WINDIR", "PATHEXT"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  if (electronAsNode) env.ELECTRON_RUN_AS_NODE = "1";
  return env;
}

function abortError(): AppError {
  return runtimeError("TOOL_CANCELLED", "Skill 脚本执行已取消。", "user");
}

function packageStorageError(message: string, cause?: unknown): AppError {
  return runtimeError("SKILL_PACKAGE_STORAGE_FAILED", message, "storage", cause);
}

function runtimeError(
  code: string,
  userMessage: string,
  category: "configuration" | "internal" | "security" | "storage" | "user" = "internal",
  cause?: unknown,
): AppError {
  return new AppError({ code, category, userMessage, cause });
}
