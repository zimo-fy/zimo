import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const VC_REDIST_URL =
  "https://download.visualstudio.microsoft.com/download/pr/bd1c8d9d-ba95-4eee-bc6e-df1fcc876373/CC0FF0EB1DC3F5188AE6300FAEF32BF5BEEBA4BDD6E8E445A9184072096B713B/VC_redist.x64.exe";
const VC_REDIST_SHA256 = "cc0ff0eb1dc3f5188ae6300faef32bf5beeba4bdd6e8e445a9184072096b713b";
const VC_REDIST_BYTES = 25_635_768;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(repositoryRoot, "apps", "desktop", "build");
const outputPath = path.join(outputDirectory, "vc_redist.x64.exe");
const temporaryPath = path.join(outputDirectory, "vc_redist.x64.exe.download");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function hasVerifiedCachedCopy() {
  try {
    const bytes = await readFile(outputPath);
    return bytes.byteLength === VC_REDIST_BYTES && sha256(bytes) === VC_REDIST_SHA256;
  } catch {
    return false;
  }
}

if (await hasVerifiedCachedCopy()) {
  process.stdout.write("Microsoft Visual C++ x64 运行库缓存校验通过。\n");
  process.exit(0);
}

await mkdir(outputDirectory, { recursive: true });
await rm(temporaryPath, { force: true });

try {
  const response = await globalThis.fetch(VC_REDIST_URL, {
    redirect: "follow",
    signal: globalThis.AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`下载失败，HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== VC_REDIST_BYTES || sha256(bytes) !== VC_REDIST_SHA256) {
    throw new Error("Microsoft Visual C++ x64 运行库完整性校验失败");
  }
  await writeFile(temporaryPath, bytes, { flag: "wx" });
  await rename(temporaryPath, outputPath);
  process.stdout.write("Microsoft Visual C++ x64 运行库已下载并通过 SHA-256 校验。\n");
} catch (error) {
  await rm(temporaryPath, { force: true });
  const message = error instanceof Error ? error.message : "未知错误";
  throw new Error(`无法准备 Windows 安装前置依赖：${message}`, { cause: error });
}
