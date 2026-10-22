import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { HostWorkspaceCommandExecutor } from "./workspace-command-executor";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("HostWorkspaceCommandExecutor", () => {
  it("runs a shell command in the selected workspace", async () => {
    const rootRef = await temporaryDirectory();
    const result = await new HostWorkspaceCommandExecutor().execute(
      {
        rootRef,
        cwd: "",
        command: process.platform === "win32" ? "Write-Output zimo" : "printf zimo",
        timeoutMs: 5_000,
      },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      cwd: ".",
      exitCode: 0,
      stdout: expect.stringContaining("zimo"),
      timedOut: false,
      truncated: false,
    });
  });

  it("terminates a command when its own timeout expires", async () => {
    const rootRef = await temporaryDirectory();
    const result = await new HostWorkspaceCommandExecutor().execute(
      {
        rootRef,
        cwd: "",
        command: process.platform === "win32" ? "Start-Sleep -Seconds 5" : "sleep 5",
        timeoutMs: 25,
      },
      new AbortController().signal,
    );

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  it("propagates conversation cancellation", async () => {
    const rootRef = await temporaryDirectory();
    const controller = new AbortController();
    const execution = new HostWorkspaceCommandExecutor().execute(
      {
        rootRef,
        cwd: "",
        command: process.platform === "win32" ? "Start-Sleep -Seconds 5" : "sleep 5",
        timeoutMs: 5_000,
      },
      controller.signal,
    );
    controller.abort();

    await expect(execution).rejects.toMatchObject({ name: "AbortError" });
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "zimo-command-"));
  temporaryDirectories.push(directory);
  return realpath(directory);
}
