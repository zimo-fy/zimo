import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

import type { DocumentFileStore, DocumentFormat, ImportedDocumentFile } from "@zimo/domain";
import { AppError } from "@zimo/domain";

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const ID_PATTERN = /^[0-9a-f-]{36}$/i;

type FormatKind =
  "pdf" | "ooxml" | "opendocument" | "epub" | "rtf" | "text" | "json" | "png" | "jpeg" | "webp";

const FORMATS: Record<
  string,
  { format: DocumentFormat; mediaType: string; kind: FormatKind; marker?: string }
> = {
  ".docx": {
    format: "docx",
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "ooxml",
    marker: "word/",
  },
  ".xlsx": {
    format: "xlsx",
    mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "ooxml",
    marker: "xl/",
  },
  ".pptx": {
    format: "pptx",
    mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "ooxml",
    marker: "ppt/",
  },
  ".pdf": { format: "pdf", mediaType: "application/pdf", kind: "pdf", marker: "%PDF-" },
  ".txt": { format: "txt", mediaType: "text/plain", kind: "text" },
  ".md": { format: "md", mediaType: "text/markdown", kind: "text" },
  ".markdown": { format: "md", mediaType: "text/markdown", kind: "text" },
  ".html": { format: "html", mediaType: "text/html", kind: "text" },
  ".htm": { format: "html", mediaType: "text/html", kind: "text" },
  ".csv": { format: "csv", mediaType: "text/csv", kind: "text" },
  ".json": { format: "json", mediaType: "application/json", kind: "json" },
  ".rtf": { format: "rtf", mediaType: "application/rtf", kind: "rtf" },
  ".odt": {
    format: "odt",
    mediaType: "application/vnd.oasis.opendocument.text",
    kind: "opendocument",
  },
  ".ods": {
    format: "ods",
    mediaType: "application/vnd.oasis.opendocument.spreadsheet",
    kind: "opendocument",
  },
  ".odp": {
    format: "odp",
    mediaType: "application/vnd.oasis.opendocument.presentation",
    kind: "opendocument",
  },
  ".epub": { format: "epub", mediaType: "application/epub+zip", kind: "epub" },
  ".png": { format: "png", mediaType: "image/png", kind: "png" },
  ".jpg": { format: "jpeg", mediaType: "image/jpeg", kind: "jpeg" },
  ".jpeg": { format: "jpeg", mediaType: "image/jpeg", kind: "jpeg" },
  ".webp": { format: "webp", mediaType: "image/webp", kind: "webp" },
};

export class LocalDocumentFileStore implements DocumentFileStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async importFile(input: {
    sourcePath: string;
    conversationId: string;
    artifactId: string;
    revisionId: string;
  }): Promise<ImportedDocumentFile> {
    requireId(input.conversationId);
    requireId(input.artifactId);
    requireId(input.revisionId);
    const info = await lstat(input.sourcePath).catch(() => null);
    if (!info || !info.isFile() || info.isSymbolicLink()) throw invalidDocument();
    if (info.size === 0 || info.size > MAX_DOCUMENT_BYTES) {
      throw new AppError({
        code: "DOCUMENT_SIZE_INVALID",
        category: "user",
        userMessage: "文件不能为空，且单个文件不能超过 20 MB。",
      });
    }
    const extension = extname(input.sourcePath).toLowerCase();
    const spec = FORMATS[extension];
    if (!spec) {
      throw new AppError({
        code: "DOCUMENT_FORMAT_UNSUPPORTED",
        category: "user",
        userMessage:
          "仅支持 DOCX、XLSX、PPTX、PDF、TXT、Markdown、HTML、JSON、CSV、RTF、OpenDocument、EPUB、PNG、JPEG 和 WebP。",
      });
    }
    const bytes = await readFile(input.sourcePath);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES) {
      throw new AppError({
        code: "DOCUMENT_SIZE_INVALID",
        category: "user",
        userMessage: "文件不能为空，且单个文件不能超过 20 MB。",
      });
    }
    validateSignature(bytes, spec);
    const displayName = safeDisplayName(basename(input.sourcePath));
    const storageKey = join(
      input.conversationId,
      input.artifactId,
      "revisions",
      `${input.revisionId}${extension}`,
    );
    const destination = this.resolveStorageKey(storageKey);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await writeFile(destination, bytes, { flag: "wx" });
    return {
      displayName,
      mediaType: spec.mediaType,
      format: spec.format,
      sizeBytes: bytes.byteLength,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      storageKey,
    };
  }

  async exportFile(storageKey: string, destinationPath: string): Promise<void> {
    try {
      await copyFile(this.resolveStorageKey(storageKey), destinationPath);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "DOCUMENT_EXPORT_FAILED",
        category: "storage",
        userMessage: "文件导出失败，请更换位置后重试。",
        retryable: true,
        cause: error,
      });
    }
  }

  async removeFile(storageKey: string): Promise<void> {
    await rm(this.resolveStorageKey(storageKey), { force: true });
  }

  async readFile(storageKey: string): Promise<Uint8Array> {
    return readFile(this.resolveStorageKey(storageKey));
  }

  async writeFile(input: {
    bytes: Uint8Array;
    conversationId: string;
    artifactId: string;
    revisionId: string;
    format: DocumentFormat;
  }): Promise<ImportedDocumentFile> {
    requireId(input.conversationId);
    requireId(input.artifactId);
    requireId(input.revisionId);
    if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_DOCUMENT_BYTES) {
      throw new AppError({
        code: "DOCUMENT_SIZE_INVALID",
        category: "user",
        userMessage: "生成的文件不能为空，且不能超过 20 MB。",
      });
    }
    const extension = `.${input.format}`;
    const spec = FORMATS[extension];
    if (!spec) throw invalidDocument();
    const bytes = Buffer.from(input.bytes);
    validateSignature(bytes, spec);
    const storageKey = join(
      input.conversationId,
      input.artifactId,
      "revisions",
      `${input.revisionId}${extension}`,
    );
    const destination = this.resolveStorageKey(storageKey);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await writeFile(destination, bytes, { flag: "wx" });
    return {
      displayName: `document.${input.format}`,
      mediaType: spec.mediaType,
      format: input.format,
      sizeBytes: bytes.byteLength,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      storageKey,
    };
  }

  private resolveStorageKey(storageKey: string): string {
    const destination = resolve(this.root, storageKey);
    const pathFromRoot = relative(this.root, destination);
    if (!pathFromRoot || pathFromRoot.startsWith("..")) {
      throw new AppError({
        code: "DOCUMENT_STORAGE_KEY_INVALID",
        category: "security",
        userMessage: "文件存储引用无效。",
      });
    }
    return destination;
  }
}

function validateSignature(
  bytes: Buffer,
  spec: { format: DocumentFormat; kind: FormatKind; marker?: string },
): void {
  if (spec.kind === "pdf") {
    if (bytes.subarray(0, 5).toString("ascii") !== (spec.marker ?? "%PDF-"))
      throw invalidDocument();
    return;
  }
  if (spec.kind === "rtf") {
    if (!bytes.subarray(0, 5).toString("latin1").startsWith("{\\rtf")) throw invalidDocument();
    return;
  }
  if (spec.kind === "json") {
    try {
      JSON.parse(decodeUtf8Text(bytes));
    } catch {
      throw invalidDocument();
    }
    return;
  }
  if (spec.kind === "text") {
    decodeUtf8Text(bytes);
    if (bytes.includes(0)) throw invalidDocument();
    return;
  }
  if (spec.kind === "png") {
    if (
      bytes.length < 8 ||
      bytes[0] !== 0x89 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x4e ||
      bytes[3] !== 0x47 ||
      bytes[4] !== 0x0d ||
      bytes[5] !== 0x0a ||
      bytes[6] !== 0x1a ||
      bytes[7] !== 0x0a
    ) {
      throw invalidDocument();
    }
    return;
  }
  if (spec.kind === "jpeg") {
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw invalidDocument();
    }
    return;
  }
  if (spec.kind === "webp") {
    if (
      bytes.length < 12 ||
      bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
      bytes.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
      throw invalidDocument();
    }
    return;
  }
  if (spec.kind === "ooxml") {
    if (
      bytes[0] !== 0x50 ||
      bytes[1] !== 0x4b ||
      !validateZipArchive(bytes, {
        requireContentTypes: true,
        requiredPrefixes: [spec.marker ?? ""],
      })
    ) {
      throw invalidDocument();
    }
    return;
  }
  if (spec.kind === "opendocument") {
    if (
      bytes[0] !== 0x50 ||
      bytes[1] !== 0x4b ||
      !validateZipArchive(bytes, { requiredPrefixes: ["content.xml", "mimetype"] })
    ) {
      throw invalidDocument();
    }
    return;
  }
  if (
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    !validateZipArchive(bytes, { requiredPrefixes: ["META-INF/"] })
  ) {
    throw invalidDocument();
  }
}

function decodeUtf8Text(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalidDocument();
  }
}

function validateZipArchive(
  bytes: Buffer,
  options: { requireContentTypes?: boolean; requiredPrefixes: readonly string[] },
): boolean {
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) return false;
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (entryCount === 0 || entryCount > 5_000 || centralSize > 5 * 1024 * 1024) return false;
  if (centralOffset + centralSize > eocd) return false;
  let cursor = centralOffset;
  let expandedBytes = 0;
  let foundContentTypes = false;
  let foundRequiredPrefix = false;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > eocd || bytes.readUInt32LE(cursor) !== 0x02014b50) return false;
    const flags = bytes.readUInt16LE(cursor + 8);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if ((flags & 1) !== 0 || next > eocd) return false;
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (unsafeArchiveEntry(name)) return false;
    expandedBytes += uncompressedSize;
    if (expandedBytes > 200 * 1024 * 1024) return false;
    if (compressedSize > 0 && uncompressedSize / compressedSize > 250) return false;
    foundContentTypes ||= name === "[Content_Types].xml";
    foundRequiredPrefix ||= options.requiredPrefixes.some((prefix) => name.startsWith(prefix));
    cursor = next;
  }
  const typesOk = options.requireContentTypes ? foundContentTypes : true;
  return typesOk && foundRequiredPrefix && cursor === centralOffset + centralSize;
}

function findEndOfCentralDirectory(bytes: Buffer): number {
  const start = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function unsafeArchiveEntry(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    !name ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.split("/").includes("..") ||
    lowerName.includes("vbaproject.bin") ||
    (lowerName.includes("/embeddings/") && !name.endsWith("/"))
  );
}

function safeDisplayName(value: string): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized || normalized.length > 180 || [...normalized].some(isControlCharacter)) {
    throw invalidDocument();
  }
  return normalized;
}

function isControlCharacter(value: string): boolean {
  const codePoint = value.codePointAt(0) ?? 0;
  return codePoint < 32 || codePoint === 127;
}

function requireId(value: string): void {
  if (!ID_PATTERN.test(value)) throw invalidDocument();
}

function invalidDocument() {
  return new AppError({
    code: "DOCUMENT_INVALID",
    category: "security",
    userMessage: "文件无法安全读取或格式与扩展名不符。",
  });
}
