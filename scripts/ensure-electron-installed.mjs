import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);

try {
  const electronPath = require("electron");
  if (typeof electronPath !== "string" || !existsSync(electronPath)) {
    throw new Error("Electron executable path is unavailable after installation");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown Electron installation error";
  process.stderr.write(`Electron 开发运行时准备失败：${message}\n`);
  process.stderr.write("请检查网络或 Electron 下载镜像配置，然后重新执行 pnpm run dev。\n");
  process.exitCode = 1;
}
