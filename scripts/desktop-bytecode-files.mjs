import { Buffer } from "node:buffer";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";

export const BYTECODE_ENTRY = "index.cjs";
export const BYTECODE_LOADER_LIMIT = 512;

export async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat().sort();
}

export function bytecodePathFor(sourcePath) {
  return sourcePath.slice(0, -extname(sourcePath).length) + ".jsc";
}

export function loaderSource(sourcePath) {
  const bytecodeFile = `./${basename(bytecodePathFor(sourcePath))}`;
  return `"use strict";\nrequire("bytenode");\nmodule.exports = require(${JSON.stringify(bytecodeFile)});\n`;
}

export async function inspectBytecodeOutput(root) {
  const files = await listFiles(root);
  const loaders = files.filter((file) => file.endsWith(".cjs"));
  const bytecode = files.filter((file) => file.endsWith(".jsc"));
  const unexpectedJavaScript = files.filter(
    (file) => file.endsWith(".js") || file.endsWith(".mjs"),
  );
  const sourceMaps = files.filter((file) => file.endsWith(".map"));
  const issues = [];

  if (!loaders.some((file) => relative(root, file) === BYTECODE_ENTRY)) {
    issues.push(`缺少 Main 加载入口 ${BYTECODE_ENTRY}`);
  }
  if (loaders.length === 0 || bytecode.length !== loaders.length) {
    issues.push(`加载器与字节码数量不一致：${loaders.length}/${bytecode.length}`);
  }
  if (unexpectedJavaScript.length > 0) issues.push("Main 产物中仍包含 JS 源 bundle");
  if (sourceMaps.length > 0) issues.push("Main 产物中仍包含 source map");

  for (const loader of loaders) {
    const content = await readFile(loader, "utf8");
    if (Buffer.byteLength(content) > BYTECODE_LOADER_LIMIT) {
      issues.push(`加载器体积异常：${relative(root, loader)}`);
    }
    if (!content.includes('require("bytenode")') || !content.includes('.jsc"')) {
      issues.push(`加载器内容异常：${relative(root, loader)}`);
    }
    const compiled = bytecodePathFor(loader);
    const compiledStat = await stat(compiled).catch(() => null);
    if (!compiledStat || compiledStat.size < 32) {
      issues.push(`字节码缺失或无效：${relative(root, compiled)}`);
    }
  }

  return { loaders, bytecode, issues };
}

export function relativeLoaderTarget(sourcePath) {
  return relative(dirname(sourcePath), bytecodePathFor(sourcePath));
}
