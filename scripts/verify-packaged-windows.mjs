import { access, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const unpackedModulesPath = path.resolve(
  "apps/desktop/release/win-unpacked/resources/app.asar.unpacked/node_modules",
);
const imageModulesPath = path.join(unpackedModulesPath, "@img");
const onnxRuntimePath = path.join(
  unpackedModulesPath,
  "onnxruntime-node",
  "bin",
  "napi-v3",
  "win32",
);

async function assertExists(targetPath, label) {
  try {
    await access(targetPath);
  } catch {
    throw new Error(`${label} 不存在：${targetPath}`);
  }
}

await assertExists(
  path.join(imageModulesPath, "sharp-win32-x64", "lib", "sharp-win32-x64.node"),
  "Windows x64 Sharp 原生模块",
);
await assertExists(
  path.join(imageModulesPath, "sharp-win32-x64", "lib", "libvips-42.dll"),
  "Windows x64 Sharp libvips 运行库",
);
await assertExists(
  path.join(onnxRuntimePath, "x64", "onnxruntime_binding.node"),
  "Windows x64 ONNX Runtime Node 原生模块",
);
await assertExists(
  path.join(onnxRuntimePath, "x64", "onnxruntime.dll"),
  "Windows x64 ONNX Runtime 动态库",
);

const packagedImageModules = await readdir(imageModulesPath);
const unexpectedModules = packagedImageModules.filter(
  (name) =>
    name.includes("darwin") ||
    name.includes("linux") ||
    name.includes("wasm") ||
    name.includes("win32-arm64") ||
    name.includes("win32-ia32"),
);

if (unexpectedModules.length > 0) {
  throw new Error(`Windows x64 产物包含非目标 Sharp 模块：${unexpectedModules.join(", ")}`);
}

const packagedOnnxArchitectures = await readdir(onnxRuntimePath);
const unexpectedOnnxArchitectures = packagedOnnxArchitectures.filter((name) => name !== "x64");

if (unexpectedOnnxArchitectures.length > 0) {
  throw new Error(
    `Windows x64 产物包含非目标 ONNX Runtime：${unexpectedOnnxArchitectures.join(", ")}`,
  );
}

process.stdout.write("Windows x64 Sharp 与 ONNX Runtime 产物结构检查通过。\n");
