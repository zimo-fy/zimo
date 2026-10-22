import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";

import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import { AppError } from "@zimo/domain";
import type {
  EmbeddingModelInfo,
  EmbeddingProvider,
  ExtractedKnowledgeSegment,
  ImportedKnowledgeFile,
  KnowledgeFileImporter,
} from "@zimo/domain";
import { OfficeParser, type OfficeChunk, type SupportedFileType } from "officeparser";

import { hashBundledModelAsset } from "./bundled-model-integrity";

const MAX_FILE_BYTES = 20 * 1_024 * 1_024;
const MODEL_KEY = "bge-small-zh-v1.5-int8";
const MODEL_ID = "Xenova/bge-small-zh-v1.5";
const MODEL_REVISION = "75c43b069aac4d136ba6bc1122f995fedcfd2781";
const MODEL_DIMENSIONS = 512;
const MODEL_MARKER = "zimo-model.json";
const MODEL_ASSETS = [
  {
    path: `${MODEL_ID}/${MODEL_REVISION}/config.json`,
    sha256: "d4193ead3a810fd694fa8a31d7fc72fbaebc0668b603e398734bf2f6538ff42f",
  },
  {
    path: `${MODEL_ID}/${MODEL_REVISION}/tokenizer.json`,
    sha256: "48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26",
  },
  {
    path: `${MODEL_ID}/${MODEL_REVISION}/tokenizer_config.json`,
    sha256: "e6f3b96db926a37d4039995fbf5ad17de158dfb8f6343d607e4dbaad18d75f5a",
  },
  {
    path: `${MODEL_ID}/${MODEL_REVISION}/onnx/model_quantized.onnx`,
    sha256: "15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc",
  },
] as const;

const SUPPORTED_EXTENSIONS = new Map<string, { mediaType: string; officeType?: SupportedFileType }>(
  [
    [".txt", { mediaType: "text/plain" }],
    [".json", { mediaType: "application/json" }],
    [".md", { mediaType: "text/markdown" }],
    [".markdown", { mediaType: "text/markdown" }],
    [".html", { mediaType: "text/html", officeType: "html" }],
    [".htm", { mediaType: "text/html", officeType: "html" }],
    [".csv", { mediaType: "text/csv", officeType: "csv" }],
    [".pdf", { mediaType: "application/pdf", officeType: "pdf" }],
    [
      ".docx",
      {
        mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        officeType: "docx",
      },
    ],
    [
      ".xlsx",
      {
        mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        officeType: "xlsx",
      },
    ],
    [
      ".pptx",
      {
        mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        officeType: "pptx",
      },
    ],
    [".rtf", { mediaType: "application/rtf", officeType: "rtf" }],
    [".odt", { mediaType: "application/vnd.oasis.opendocument.text", officeType: "odt" }],
    [".ods", { mediaType: "application/vnd.oasis.opendocument.spreadsheet", officeType: "ods" }],
    [".odp", { mediaType: "application/vnd.oasis.opendocument.presentation", officeType: "odp" }],
    [".epub", { mediaType: "application/epub+zip", officeType: "epub" }],
  ],
);

export class LocalKnowledgeFileImporter implements KnowledgeFileImporter {
  async importFile(sourcePath: string, storageDirectory: string): Promise<ImportedKnowledgeFile> {
    let storageKey: string | undefined;
    try {
      const source = await lstat(sourcePath);
      if (!source.isFile() || source.isSymbolicLink()) throw unsafeFileError();
      if (source.size <= 0) {
        throw new AppError({
          code: "KNOWLEDGE_FILE_EMPTY",
          category: "user",
          userMessage: "不能导入空文件。",
        });
      }
      if (source.size > MAX_FILE_BYTES) {
        throw new AppError({
          code: "KNOWLEDGE_FILE_TOO_LARGE",
          category: "user",
          userMessage: "单个知识文件不能超过 20 MB。",
        });
      }
      const extension = extname(sourcePath).toLocaleLowerCase();
      const format = SUPPORTED_EXTENSIONS.get(extension);
      if (!format) {
        throw new AppError({
          code: "KNOWLEDGE_FILE_TYPE_UNSUPPORTED",
          category: "user",
          userMessage: "暂不支持这种文件格式。",
        });
      }
      const bytes = await readFile(sourcePath);
      if (bytes.byteLength !== source.size) throw unsafeFileError();
      const name = safeDisplayName(basename(sourcePath));
      const segments = await extractSegments(bytes, extension, format.officeType);
      storageKey = `${randomUUID()}${extension}`;
      await mkdir(storageDirectory, { recursive: true });
      await writeFile(resolveManagedPath(storageDirectory, storageKey), bytes, { flag: "wx" });
      return {
        name,
        mediaType: format.mediaType,
        sizeBytes: bytes.byteLength,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        storageKey,
        segments,
      };
    } catch (error) {
      if (storageKey) {
        await rm(resolveManagedPath(storageDirectory, storageKey), { force: true }).catch(
          () => undefined,
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "KNOWLEDGE_FILE_READ_FAILED",
        category: "user",
        userMessage: "文件无法安全读取或解析，请检查格式后重试。",
      });
    }
  }

  async removeManagedFile(storageDirectory: string, storageKey: string): Promise<void> {
    await rm(resolveManagedPath(storageDirectory, storageKey), { force: true });
  }
}

export class BundledBgeEmbeddingProvider implements EmbeddingProvider {
  private model: FeatureExtractionPipeline | undefined;
  private verified = false;
  private runtimeStatus: EmbeddingModelInfo["status"] = "failed";
  private errorCode: string | undefined;

  constructor(private readonly modelDirectory: string) {}

  async getStatus(): Promise<EmbeddingModelInfo> {
    if (this.verified) return this.info(this.runtimeStatus);
    try {
      const marker = JSON.parse(
        await readFile(join(this.modelDirectory, MODEL_MARKER), "utf8"),
      ) as Record<string, unknown>;
      if (
        marker.key !== MODEL_KEY ||
        marker.modelId !== MODEL_ID ||
        marker.revision !== MODEL_REVISION ||
        marker.dimensions !== MODEL_DIMENSIONS
      ) {
        throw new Error("Bundled model marker mismatch");
      }
      for (const asset of MODEL_ASSETS) {
        const bytes = await readFile(join(this.modelDirectory, ...asset.path.split("/")));
        if (hashBundledModelAsset(asset.path, bytes) !== asset.sha256) {
          throw new Error("Bundled model checksum mismatch");
        }
      }
      this.runtimeStatus = "ready";
      this.errorCode = undefined;
    } catch {
      this.runtimeStatus = "failed";
      this.errorCode = "BUNDLED_EMBEDDING_MODEL_INVALID";
    }
    this.verified = true;
    return this.info(this.runtimeStatus);
  }

  async embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (texts.length === 0) return [];
    if (texts.length > 32 || texts.some((text) => !text.trim() || text.length > 8_000)) {
      throw new AppError({
        code: "EMBEDDING_INPUT_INVALID",
        category: "user",
        userMessage: "Embedding 输入超出安全限制。",
      });
    }
    const status = await this.getStatus();
    if (status.status !== "ready") {
      throw new AppError({
        code: "EMBEDDING_MODEL_NOT_READY",
        category: "configuration",
        userMessage: "应用内置的 Embedding 模型不可用，请重新安装应用。",
      });
    }
    try {
      const extractor = await this.load();
      const tensor = await extractor([...texts], { pooling: "cls", normalize: true });
      const values = tensor.tolist() as number[][];
      if (
        values.length !== texts.length ||
        values.some(
          (vector) => vector.length !== MODEL_DIMENSIONS || vector.some((v) => !Number.isFinite(v)),
        )
      ) {
        throw new Error("Unexpected embedding shape");
      }
      return values;
    } catch {
      this.runtimeStatus = "failed";
      this.errorCode = "EMBEDDING_INFERENCE_FAILED";
      throw new AppError({
        code: "EMBEDDING_INFERENCE_FAILED",
        category: "internal",
        userMessage: "本地 Embedding 推理失败，请重启或重新安装应用后重试。",
        retryable: true,
      });
    }
  }

  private async load(): Promise<FeatureExtractionPipeline> {
    if (this.model) return this.model;
    const { env, pipeline } = await import("@huggingface/transformers");
    env.cacheDir = this.modelDirectory;
    env.allowRemoteModels = false;
    this.model = await pipeline("feature-extraction", MODEL_ID, {
      revision: MODEL_REVISION,
      dtype: "q8",
      cache_dir: this.modelDirectory,
      local_files_only: true,
    });
    return this.model;
  }

  private info(status: EmbeddingModelInfo["status"]): EmbeddingModelInfo {
    return {
      key: MODEL_KEY,
      displayName: "BGE Small 中文 v1.5 · INT8",
      revision: MODEL_REVISION.slice(0, 12),
      dimensions: MODEL_DIMENSIONS,
      status,
      localOnly: status === "ready",
      ...(this.errorCode ? { errorCode: this.errorCode } : {}),
    };
  }
}

async function extractSegments(
  bytes: Buffer,
  extension: string,
  officeType?: SupportedFileType,
): Promise<readonly ExtractedKnowledgeSegment[]> {
  if (extension === ".txt") return [{ text: decodeUtf8(bytes), metadata: {} }];
  if (extension === ".md" || extension === ".markdown") return extractMarkdown(bytes);
  if (extension === ".json") {
    const parsed: unknown = JSON.parse(decodeUtf8(bytes));
    return [{ text: JSON.stringify(parsed, null, 2), metadata: {} }];
  }
  if (!officeType) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const ast = await OfficeParser.parseOffice(bytes, {
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
      abortSignal: controller.signal,
    });
    const converted = await ast.to("chunks", {
      includeFormatting: false,
      includeImages: false,
      includeCharts: false,
      ignoreInternalLinks: true,
      abortSignal: controller.signal,
      chunksConfig: {
        strategy: "document-structure",
        splitBy:
          officeType === "pdf"
            ? "page"
            : officeType === "pptx" || officeType === "odp"
              ? "slide"
              : officeType === "xlsx" || officeType === "ods"
                ? "sheet"
                : "heading",
        maxChunkSize: 1_200,
        tableSplitStrategy: "row",
        includeMetadata: true,
        addStartIndex: true,
      },
    });
    return (converted.value as OfficeChunk[]).map((chunk) => ({
      text: chunk.text,
      metadata: {
        ...(chunk.metadata.pageNumber ? { pageNumber: chunk.metadata.pageNumber } : {}),
        ...(chunk.metadata.slideNumber ? { slideNumber: chunk.metadata.slideNumber } : {}),
        ...(chunk.metadata.sheetName ? { sheetName: chunk.metadata.sheetName } : {}),
        ...(chunk.metadata.closestHeading ? { heading: chunk.metadata.closestHeading } : {}),
        ...(chunk.startIndex !== undefined ? { startIndex: chunk.startIndex } : {}),
        ...(chunk.endIndex !== undefined ? { endIndex: chunk.endIndex } : {}),
      },
    }));
  } finally {
    clearTimeout(timer);
  }
}

function extractMarkdown(bytes: Buffer): readonly ExtractedKnowledgeSegment[] {
  const markdown = decodeUtf8(bytes).replace(/\r\n?/g, "\n");
  const segments: ExtractedKnowledgeSegment[] = [];
  let heading: string | undefined;
  let sectionStart = 0;
  let offset = 0;
  let lines: string[] = [];

  const flush = (endIndex: number) => {
    const text = lines.join("\n").trim();
    if (text) {
      segments.push({
        text,
        metadata: {
          ...(heading ? { heading } : {}),
          startIndex: sectionStart,
          endIndex,
        },
      });
    }
  };

  for (const line of markdown.split("\n")) {
    const headingMatch = /^ {0,3}#{1,6}[ \t]+(.+?)\s*#*\s*$/.exec(line);
    if (headingMatch) {
      flush(offset);
      heading = headingMatch[1]?.trim();
      sectionStart = offset;
      lines = heading ? [heading] : [];
    } else {
      lines.push(line);
    }
    offset += line.length + 1;
  }
  flush(markdown.length);
  return segments;
}

function decodeUtf8(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new AppError({
      code: "KNOWLEDGE_TEXT_ENCODING_INVALID",
      category: "user",
      userMessage: "文本文件必须使用 UTF-8 编码。",
    });
  }
}

function safeDisplayName(value: string): string {
  const normalized = [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join("")
    .trim();
  if (!normalized || normalized.length > 180) {
    throw new AppError({
      code: "KNOWLEDGE_FILE_NAME_INVALID",
      category: "user",
      userMessage: "文件名无效或过长。",
    });
  }
  return normalized;
}

function resolveManagedPath(storageDirectory: string, storageKey: string): string {
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(storageKey)) throw unsafeFileError();
  const root = resolve(storageDirectory);
  const target = resolve(root, storageKey);
  if (!target.startsWith(`${root}${sep}`)) throw unsafeFileError();
  return target;
}

function unsafeFileError(): AppError {
  return new AppError({
    code: "KNOWLEDGE_FILE_UNSAFE",
    category: "security",
    userMessage: "该文件未通过安全检查。",
  });
}
