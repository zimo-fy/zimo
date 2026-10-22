import { lookup } from "node:dns/promises";
import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

import {
  AppError,
  type KnowledgeDirectoryCatalogGateway,
  type RemoteKnowledgeCatalogDirectory,
  type RemoteKnowledgeCatalogDocument,
  type RemoteKnowledgeDirectoryCatalog,
  type SecretStore,
  type SessionStore,
} from "@zimo/domain";
import { z } from "zod";

const MAX_CATALOG_BYTES = 4 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_DIRECTORIES = 200;
const MAX_DOCUMENTS_PER_NODE = 500;

const documentRowSchema = z
  .object({
    id: z.union([z.string().trim().min(1).max(32), z.number().int().positive()]),
    name: z.string().trim().min(1).max(200),
    originalFilename: z.string().trim().min(1).max(260),
    fileExt: z.string().trim().max(20).nullish(),
    mimeType: z.string().trim().max(200).nullish(),
    fileSize: z.number().int().nonnegative(),
    status: z.string().trim().max(40).nullish(),
    checksum: z.string().trim().min(1).max(128).nullish(),
    storagePath: z.string().trim().url().max(2048).nullish(),
  })
  .passthrough();

const directoryRowSchema: z.ZodType<DirectoryRow> = z.lazy(() =>
  z
    .object({
      id: z.union([z.string().trim().min(1).max(32), z.number().int().positive()]),
      name: z.string().trim().min(1).max(200),
      description: z.string().trim().max(500).nullish(),
      documentCount: z.number().int().nonnegative().optional(),
      totalDocumentCount: z.number().int().nonnegative().optional(),
      documents: z.array(documentRowSchema).max(MAX_DOCUMENTS_PER_NODE).optional(),
      children: z.array(directoryRowSchema).max(MAX_DIRECTORIES).optional(),
    })
    .passthrough(),
);

type DirectoryRow = {
  id: string | number;
  name: string;
  description?: string | null;
  documentCount?: number;
  totalDocumentCount?: number;
  documents?: z.infer<typeof documentRowSchema>[];
  children?: DirectoryRow[];
};

const catalogResponseSchema = z
  .object({
    success: z.boolean().optional(),
    code: z.union([z.string(), z.number()]).optional(),
    msg: z.string().max(500).optional(),
    data: z
      .object({
        tree: z.array(directoryRowSchema).max(MAX_DIRECTORIES).optional(),
        uncategorizedDocuments: z.array(documentRowSchema).max(MAX_DOCUMENTS_PER_NODE).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export class ZimoKnowledgeDirectoryCatalogGateway implements KnowledgeDirectoryCatalogGateway {
  private readonly baseUrl: URL;

  constructor(
    baseUrl: string,
    private readonly sessions: SessionStore,
    private readonly secrets: SecretStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  }

  async listTree(signal: AbortSignal): Promise<RemoteKnowledgeDirectoryCatalog> {
    const token = await this.accessToken();
    const url = new URL("ai/knowledge/directory/tree-with-documents", this.baseUrl);
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      redirect: "error",
      signal,
    }).catch((cause) => {
      throw networkError("无法获取云端知识库目录，请检查网络后重试。", cause);
    });
    if (response.status === 401 || response.status === 403) throw authenticationError();
    if (!response.ok) {
      throw networkError(`云端知识库服务暂不可用（${response.status}）。`);
    }
    const raw = parseJson(await readLimited(response, MAX_CATALOG_BYTES));
    const parsed = catalogResponseSchema.safeParse(raw);
    if (!parsed.success || parsed.data.success === false || String(parsed.data.code) === "401") {
      if (String(parsed.data?.code) === "401") throw authenticationError();
      throw invalidResponse();
    }
    return {
      directories: (parsed.data.data.tree ?? []).map(mapDirectory),
      uncategorizedDocuments: (parsed.data.data.uncategorizedDocuments ?? []).map(mapDocument),
    };
  }

  async downloadDocumentToTempFile(
    document: RemoteKnowledgeCatalogDocument,
    signal: AbortSignal,
  ): Promise<string> {
    const url = new URL(document.storageUrl);
    await assertPublicHttpsUrl(url);
    const response = await this.fetchImpl(url, {
      method: "GET",
      redirect: "error",
      signal,
    }).catch((cause) => {
      throw networkError("无法下载云端文档，请检查网络后重试。", cause);
    });
    if (response.status === 401 || response.status === 403) throw authenticationError();
    if (!response.ok) throw networkError(`云端文档暂不可用（${response.status}）。`);
    const extension = resolveImportExtension(document, url);
    const bytes = await readLimited(response, MAX_FILE_BYTES);
    if (bytes.byteLength <= 0) throw invalidResponse("云端文档为空。");
    const directory = await mkdtemp(join(tmpdir(), "zimo-knowledge-cloud-"));
    const tempPath = join(directory, buildTempImportFilename(document, extension));
    await writeFile(tempPath, bytes);
    return tempPath;
  }

  private async accessToken(): Promise<string> {
    const session = await this.sessions.get();
    const token = session ? await this.secrets.get(session.tokenSecretRef) : null;
    if (!token) throw authenticationError();
    return token;
  }
}

function mapDirectory(row: DirectoryRow): RemoteKnowledgeCatalogDirectory {
  return {
    catalogDirectoryId: String(row.id),
    name: row.name.trim(),
    ...(row.description?.trim() ? { description: row.description.trim() } : {}),
    documentCount: row.documentCount ?? row.documents?.length ?? 0,
    totalDocumentCount: row.totalDocumentCount ?? row.documentCount ?? row.documents?.length ?? 0,
    documents: (row.documents ?? []).map(mapDocument),
    children: (row.children ?? []).map(mapDirectory),
  };
}

function mapDocument(row: z.infer<typeof documentRowSchema>): RemoteKnowledgeCatalogDocument {
  const storageUrl = row.storagePath?.trim();
  const remoteChecksum = row.checksum?.trim();
  if (!storageUrl || !remoteChecksum) throw invalidResponse();
  return {
    catalogDocumentId: String(row.id),
    name: row.name.trim(),
    originalFilename: row.originalFilename.trim(),
    fileExt: (row.fileExt ?? "").trim(),
    fileSize: row.fileSize,
    ...(row.mimeType?.trim() ? { mimeType: row.mimeType.trim() } : {}),
    status: (row.status ?? "normal").trim(),
    remoteChecksum,
    storageUrl,
  };
}

async function assertPublicHttpsUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw unsafeUrl();
  const addresses = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw unsafeUrl();
  }
}

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    return true;
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return !normalized.startsWith("fc") && !normalized.startsWith("fd") && normalized !== "::1";
  }
  return false;
}

function unsafeUrl(): AppError {
  return new AppError({
    code: "KNOWLEDGE_CATALOG_UNSAFE_URL",
    category: "security",
    userMessage: "云端文档地址无法安全下载。",
  });
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > limit) throw invalidResponse("云端知识库响应超过大小限制。");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.length;
      if (length > limit) {
        await reader.cancel();
        throw invalidResponse("云端知识库响应超过大小限制。");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function parseJson(value: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(value)) as unknown;
  } catch (cause) {
    throw invalidResponse("云端知识库服务返回了无效 JSON。", cause);
  }
}

function resolveImportExtension(document: RemoteKnowledgeCatalogDocument, url: URL): string {
  const fromOriginal = extname(document.originalFilename).toLocaleLowerCase();
  if (fromOriginal) return fromOriginal;
  const rawExt = document.fileExt.trim().toLocaleLowerCase();
  if (rawExt) return rawExt.startsWith(".") ? rawExt : `.${rawExt}`;
  const fromUrl = extname(url.pathname).toLocaleLowerCase();
  return fromUrl || ".bin";
}

function buildTempImportFilename(
  document: RemoteKnowledgeCatalogDocument,
  extension: string,
): string {
  let name = basename(document.originalFilename.trim()) || document.name.trim();
  if (!name) name = `document${extension}`;
  name = name.replace(/[<>:"|?*\u0000-\u001f\\/]/g, "_").slice(0, 240);
  if (!extname(name)) name = `${name}${extension}`;
  return name;
}

function authenticationError(): AppError {
  return new AppError({
    code: "KNOWLEDGE_CATALOG_AUTH_REQUIRED",
    category: "configuration",
    userMessage: "登录状态不可用，请重新登录后再获取云端知识库目录。",
  });
}

function invalidResponse(message = "云端知识库服务返回的数据无法安全处理。", cause?: unknown): AppError {
  return new AppError({
    code: "KNOWLEDGE_CATALOG_INVALID_RESPONSE",
    category: "security",
    userMessage: message,
    cause,
  });
}

function networkError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: "KNOWLEDGE_CATALOG_NETWORK_ERROR",
    category: "network",
    userMessage: message,
    retryable: true,
    cause,
  });
}
