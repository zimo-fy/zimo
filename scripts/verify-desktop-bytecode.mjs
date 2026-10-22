import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { inspectBytecodeOutput } from "./desktop-bytecode-files.mjs";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(workspaceRoot, "apps/desktop/out/main");
const inspection = await inspectBytecodeOutput(outputRoot);

if (inspection.issues.length > 0) {
  throw new Error(`Bytenode 产物校验失败：${inspection.issues.join("；")}`);
}

process.stdout.write(
  `Bytenode 产物校验通过：${inspection.loaders.length} 个加载器，${inspection.bytecode.length} 个字节码文件。\n`,
);
