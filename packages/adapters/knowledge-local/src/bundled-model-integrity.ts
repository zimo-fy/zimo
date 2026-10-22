import { createHash } from "node:crypto";

export function hashBundledModelAsset(relativePath: string, bytes: Buffer): string {
  const payload = relativePath.endsWith(".json") ? canonicalizeUtf8Newlines(bytes) : bytes;
  return createHash("sha256").update(payload).digest("hex");
}

export function canonicalizeUtf8Newlines(bytes: Buffer): Buffer {
  return Buffer.from(
    bytes
      .toString("utf8")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n"),
    "utf8",
  );
}
