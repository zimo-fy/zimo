import type {
  DocumentArtifact,
  DocumentDigest,
  DocumentSelector,
  DocumentSlice,
} from "@zimo/domain";
import { AppError, isDocumentImageFormat } from "@zimo/domain";
import {
  OfficeParser,
  type OfficeChunk,
  type OfficeContentNode,
  type SupportedFileType,
} from "officeparser";

const MAX_READ_CHARACTERS = 12_000;

export async function inspectDocument(
  bytes: Uint8Array,
  artifact: DocumentArtifact,
  signal: AbortSignal,
): Promise<DocumentDigest> {
  const chunks = await parseChunks(bytes, artifact, signal);
  const units = summarizeUnits(chunks, artifact.format);
  const fullText = chunks
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .join("\n\n");
  const preview = fullText.slice(0, 2_000);
  return {
    artifactId: artifact.id,
    revisionId: artifact.currentRevisionId,
    format: artifact.format,
    displayName: artifact.displayName,
    unitCount: units.length || (chunks.length > 0 ? 1 : 0),
    units: units.slice(0, 80),
    preview,
    truncated: units.length > 80 || fullText.length > preview.length,
  };
}

export async function readDocument(
  bytes: Uint8Array,
  artifact: DocumentArtifact,
  selector: DocumentSelector,
  signal: AbortSignal,
): Promise<DocumentSlice> {
  const chunks = (await parseChunks(bytes, artifact, signal)).filter((chunk) =>
    matchesSelector(chunk, selector),
  );
  const joined = chunks.map(formatChunk).filter(Boolean).join("\n\n");
  const cursor = selector.cursor ?? 0;
  const limit = Math.min(selector.maxCharacters ?? 6_000, MAX_READ_CHARACTERS);
  if (!Number.isInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 200) {
    throw invalidSelector();
  }
  const content = joined.slice(cursor, cursor + limit);
  const nextCursor = cursor + content.length < joined.length ? cursor + content.length : undefined;
  return {
    artifactId: artifact.id,
    revisionId: artifact.currentRevisionId,
    content,
    ...(nextCursor === undefined ? {} : { nextCursor }),
    truncated: nextCursor !== undefined,
  };
}

export async function extractDocumentText(
  bytes: Uint8Array,
  artifact: DocumentArtifact,
  signal: AbortSignal,
): Promise<string> {
  return (await parseChunks(bytes, artifact, signal))
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

async function parseChunks(
  bytes: Uint8Array,
  artifact: DocumentArtifact,
  signal: AbortSignal,
): Promise<OfficeChunk[]> {
  if (signal.aborted) throw abortError();
  if (isDocumentImageFormat(artifact.format)) {
    return [];
  }
  if (artifact.format === "txt" || artifact.format === "md" || artifact.format === "json") {
    const decoded = decodeUtf8(bytes);
    try {
      const text =
        artifact.format === "json" ? JSON.stringify(JSON.parse(decoded), null, 2) : decoded;
      return [{ text, metadata: { sourceType: artifact.format as never } }];
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "DOCUMENT_INVALID",
        category: "security",
        userMessage: "文件无法安全读取或格式与扩展名不符。",
      });
    }
  }
  const officeType = officeFileType(artifact.format);
  const ast = await OfficeParser.parseOffice(Buffer.from(bytes), {
    fileType: officeType,
    extractAttachments: false,
    includeRawContent: false,
    ocr: false,
    ignoreInternalLinks: true,
    htmlParserConfig: {
      preserveAttributes: false,
      preserveIframes: false,
      embedFolkForms: false,
    },
    decompressionLimits: {
      maxUncompressedBytes: 80 * 1_024 * 1_024,
      maxZipEntries: 4_000,
      maxTableCells: 200_000,
    },
    abortSignal: signal,
  });
  if (signal.aborted) throw abortError();
  return chunksFromAst(ast.content, officeType);
}

function officeFileType(format: DocumentArtifact["format"]): SupportedFileType {
  if (format === "html") return "html";
  if (format === "csv") return "csv";
  if (format === "rtf") return "rtf";
  if (format === "odt") return "odt";
  if (format === "ods") return "ods";
  if (format === "odp") return "odp";
  if (format === "epub") return "epub";
  return format as SupportedFileType;
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new AppError({
      code: "DOCUMENT_INVALID",
      category: "security",
      userMessage: "文件无法安全读取或格式与扩展名不符。",
    });
  }
}

function chunksFromAst(
  nodes: readonly OfficeContentNode[],
  sourceType: SupportedFileType,
): OfficeChunk[] {
  let closestHeading: string | undefined;
  return nodes.flatMap((node, index) => {
    const text = normalizeExtractedText(nodeText(node)).trim();
    if (node.type === "heading" && text) closestHeading = text;
    if (!text) return [];
    const metadata: OfficeChunk["metadata"] = { sourceType };
    if (node.type === "page") metadata.pageNumber = numberMetadata(node, "pageNumber") ?? index + 1;
    if (node.type === "slide")
      metadata.slideNumber = numberMetadata(node, "slideNumber") ?? index + 1;
    if (node.type === "sheet")
      metadata.sheetName = stringMetadata(node, "sheetName") ?? `Sheet ${index + 1}`;
    if (closestHeading) metadata.closestHeading = closestHeading;
    return [{ text, metadata }];
  });
}

function normalizeExtractedText(value: string): string {
  return value.normalize("NFKC").replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, "$1");
}

function nodeText(node: OfficeContentNode): string {
  if (typeof node.text === "string" && node.text.trim()) return node.text;
  return (node.children ?? [])
    .map(nodeText)
    .filter(Boolean)
    .join(node.type === "row" ? "\t" : "\n");
}

function numberMetadata(node: OfficeContentNode, key: string): number | undefined {
  const value = (node.metadata as Readonly<Record<string, unknown>> | undefined)?.[key];
  return typeof value === "number" ? value : undefined;
}

function stringMetadata(node: OfficeContentNode, key: string): string | undefined {
  const value = (node.metadata as Readonly<Record<string, unknown>> | undefined)?.[key];
  return typeof value === "string" ? value : undefined;
}

function matchesSelector(chunk: OfficeChunk, selector: DocumentSelector): boolean {
  if (
    selector.pageNumbers?.length &&
    !selector.pageNumbers.includes(chunk.metadata.pageNumber ?? -1)
  ) {
    return false;
  }
  if (
    selector.slideNumbers?.length &&
    !selector.slideNumbers.includes(chunk.metadata.slideNumber ?? -1)
  ) {
    return false;
  }
  if (selector.sheetName && chunk.metadata.sheetName !== selector.sheetName) return false;
  return true;
}

function summarizeUnits(
  chunks: readonly OfficeChunk[],
  format: DocumentArtifact["format"],
): string[] {
  const values = chunks.flatMap((chunk) => {
    if (format === "pdf" && chunk.metadata.pageNumber)
      return [`第 ${chunk.metadata.pageNumber} 页`];
    if (format === "pptx" && chunk.metadata.slideNumber)
      return [`第 ${chunk.metadata.slideNumber} 张幻灯片`];
    if (format === "xlsx" && chunk.metadata.sheetName) return [chunk.metadata.sheetName];
    if (chunk.metadata.closestHeading) return [chunk.metadata.closestHeading];
    return [];
  });
  return [...new Set(values)];
}

function formatChunk(chunk: OfficeChunk): string {
  const label = chunk.metadata.pageNumber
    ? `第 ${chunk.metadata.pageNumber} 页`
    : chunk.metadata.slideNumber
      ? `第 ${chunk.metadata.slideNumber} 张幻灯片`
      : chunk.metadata.sheetName
        ? `工作表 ${chunk.metadata.sheetName}`
        : chunk.metadata.closestHeading;
  return `${label ? `[${label}]\n` : ""}${chunk.text.trim()}`.trim();
}

function invalidSelector() {
  return new AppError({
    code: "DOCUMENT_SELECTOR_INVALID",
    category: "user",
    userMessage: "文档读取范围无效。",
  });
}

function abortError() {
  return new DOMException("Document operation cancelled", "AbortError");
}
