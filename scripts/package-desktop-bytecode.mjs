import { spawn } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { listFiles } from "./desktop-bytecode-files.mjs";
import { resolveElectronDist } from "./resolve-electron-dist.mjs";
import { resolvePnpmInvocation } from "./resolve-pnpm-cli.mjs";

const mode = process.argv[2];
const builderArguments = {
  dir: ["--dir", "--publish", "never"],
  mac: ["--mac", "dmg", "zip", "--publish", "never"],
  win: ["--win", "nsis", "zip", "--x64", "--publish", "never"],
}[mode];

if (!builderArguments) {
  throw new Error("打包模式必须是 dir、mac 或 win。");
}

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = resolve(workspaceRoot, "apps/desktop");
const mainOutput = resolve(desktopRoot, "out/main");
const compilerName = "bytenode-electron-main-compiler.cjs";
const compilerOutput = resolve(mainOutput, compilerName);
const stagingRoot = await mkdtemp(join(tmpdir(), "zimo-bytenode-stage-"));
const pnpm = resolvePnpmInvocation();
const electronDistArgument = `--config.electronDist=${resolveElectronDist()}`;

try {
  await run(pnpm.command, [...pnpm.argsPrefix, "run", "build"], desktopRoot, pnpm.shell);
  await copyFile(resolve(workspaceRoot, "scripts", compilerName), compilerOutput);
  await run(
    pnpm.command,
    [
      ...pnpm.argsPrefix,
      "exec",
      "electron-builder",
      "--dir",
      "--publish",
      "never",
      `--config.directories.output=${stagingRoot}`,
      `--config.extraMetadata.main=out/main/${compilerName}`,
      electronDistArgument,
    ],
    desktopRoot,
    pnpm.shell,
  );
  const compilerExecutable = await findCompilerExecutable(stagingRoot);
  await rm(compilerOutput, { force: true });
  await run(
    process.execPath,
    [resolve(workspaceRoot, "scripts/compile-desktop-bytecode.mjs"), compilerExecutable],
    workspaceRoot,
  );
  await run(
    pnpm.command,
    [...pnpm.argsPrefix, "exec", "electron-builder", ...builderArguments, electronDistArgument],
    desktopRoot,
    pnpm.shell,
  );
} finally {
  await rm(compilerOutput, { force: true });
  await rm(stagingRoot, { recursive: true, force: true });
}

async function findCompilerExecutable(root) {
  const files = await listFiles(root);
  const candidates = files.filter((file) => {
    if (process.platform === "darwin") {
      return file.includes(".app/Contents/MacOS/") && basename(file) === "Zimo";
    }
    if (process.platform === "win32") return basename(file).toLowerCase() === "zimo.exe";
    return basename(file).toLowerCase() === "zimo";
  });
  if (candidates.length !== 1) {
    throw new Error(`无法唯一定位临时 Bytenode 编译器应用：${candidates.length}`);
  }
  return candidates[0];
}

async function run(command, args, cwd, shell = false) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "inherit",
      shell,
      windowsHide: true,
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} 执行失败：${code ?? signal ?? "unknown"}`));
    });
  });
}
