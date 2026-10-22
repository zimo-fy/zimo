import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { resolvePnpmInvocation } from "../../scripts/resolve-pnpm-cli.mjs";

const temporaryDirectories: string[] = [];
const packageScript = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/package-desktop-bytecode.mjs",
);

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Windows pnpm spawn resolution", () => {
  it("invokes the launching pnpm CLI with Node and no shell", () => {
    const cli = join(createTemporaryDirectory(), "pnpm.cjs");
    writeFileSync(cli, "");

    expect(
      resolvePnpmInvocation({
        env: { npm_execpath: cli },
        platform: "win32",
        nodeExecPath: "C:\\Program Files\\nodejs\\node.exe",
        fileExists: (candidate) => candidate === cli,
      }),
    ).toEqual({
      command: "C:\\Program Files\\nodejs\\node.exe",
      argsPrefix: [cli],
      shell: false,
    });
  });

  it("falls back to pnpm.cmd with a shell only on Windows", () => {
    expect(
      resolvePnpmInvocation({
        env: {},
        platform: "win32",
        nodeExecPath: "C:\\missing\\node.exe",
        fileExists: () => false,
      }),
    ).toEqual({
      command: "pnpm.cmd",
      argsPrefix: [],
      shell: true,
    });
  });

  it("keeps the bytecode packager off raw pnpm.cmd spawn", () => {
    const source = readFileSync(packageScript, "utf8");

    expect(source).toContain("resolvePnpmInvocation()");
    expect(source).toContain("windowsHide: true");
    expect(source).not.toContain('process.platform === "win32" ? "pnpm.cmd" : "pnpm"');
  });
});

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "zimo-pnpm-cli-"));
  temporaryDirectories.push(directory);
  return directory;
}
