import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const defaultRequire = createRequire(import.meta.url);

export function resolveElectronDist({
  requireFn = defaultRequire,
  fileExists = existsSync,
  readText = (file) => readFileSync(file, "utf8"),
} = {}) {
  let electronPackagePath;
  try {
    electronPackagePath = requireFn.resolve("electron/package.json");
  } catch (error) {
    throw new Error("未找到 Electron 包，无法使用本地运行时打包。", { cause: error });
  }

  const electronRoot = dirname(electronPackagePath);
  const expectedVersion = requireFn(electronPackagePath).version;
  const distDirectory = join(electronRoot, "dist");
  const pathFile = join(electronRoot, "path.txt");
  if (!fileExists(pathFile)) {
    throw new Error("Electron 运行时未安装，缺少 path.txt。请先完成平台运行时准备后再打包。");
  }

  const relativeBinary = readText(pathFile).trim();
  const binaryPath = join(distDirectory, relativeBinary);
  if (!fileExists(binaryPath)) {
    throw new Error("Electron 运行时二进制缺失，无法改用本地 dist 打包。");
  }

  const versionFile = join(distDirectory, "version");
  if (!fileExists(versionFile)) {
    throw new Error("Electron 运行时缺少 version 文件，无法确认与 lockfile 一致。");
  }

  const actualVersion = readText(versionFile).trim().replace(/^v/, "");
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Electron 运行时版本不匹配：已安装 ${actualVersion}，期望 ${expectedVersion}。`,
    );
  }

  return distDirectory;
}
