import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

import {
  bytecodePathFor,
  inspectBytecodeOutput,
  listFiles,
  loaderSource,
} from "./desktop-bytecode-files.mjs";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(workspaceRoot, "apps/desktop/out/main");
const electronPath = process.argv[2] ? resolve(process.argv[2]) : undefined;
const sourceFiles = (await listFiles(outputRoot)).filter(
  (file) => file.endsWith(".cjs") && !file.endsWith("bytenode-electron-main-compiler.cjs"),
);
const generatedFiles = sourceFiles.map(bytecodePathFor);
const compilationTimeoutMs = 5 * 60_000;

if (!electronPath) {
  throw new Error("缺少已打包的 Electron 编译器应用路径。");
}
if (sourceFiles.length === 0) {
  throw new Error("没有找到可编译的 Electron Main CJS bundle。");
}

try {
  await compileInPackagedElectron(
    sourceFiles.map((source) => ({ source, output: bytecodePathFor(source) })),
  );
} catch (error) {
  await Promise.all(generatedFiles.map((file) => rm(file, { force: true })));
  throw error;
}

await Promise.all(
  sourceFiles.map((filename) => writeFile(filename, loaderSource(filename), { mode: 0o644 })),
);

const inspection = await inspectBytecodeOutput(outputRoot);
if (inspection.issues.length > 0) {
  throw new Error(`Bytenode 产物校验失败：${inspection.issues.join("；")}`);
}

process.stdout.write(
  `Bytenode 编译完成：${inspection.bytecode.length} 个 Electron Main bundle 已转换为字节码。\n`,
);

async function compileInPackagedElectron(jobs) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "zimo-bytenode-build-"));
  const jobFile = join(temporaryDirectory, "jobs.json");
  await writeFile(jobFile, JSON.stringify(jobs), { mode: 0o600 });
  try {
    await new Promise((resolveProcess, rejectProcess) => {
      const child = spawn(electronPath, [], {
        env: { ...process.env, ZIMO_BYTENODE_JOB_FILE: jobFile },
        stdio: ["ignore", "inherit", "inherit"],
      });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, compilationTimeoutMs);
      child.once("error", (error) => {
        clearTimeout(timer);
        rejectProcess(error);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        if (timedOut) rejectProcess(new Error("Electron 字节码编译超过 5 分钟，已终止。"));
        else if (code === 0) resolveProcess();
        else rejectProcess(new Error(`Electron 字节码编译失败：${code ?? signal ?? "unknown"}`));
      });
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
