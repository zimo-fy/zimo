import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  AppError,
  type InstructionSkillPackage,
  type RemoteSkillCatalogEntry,
  type SecretStore,
  type SessionStore,
  type SkillCatalogGateway,
} from "@zimo/domain";
import { unzipSync, type UnzipFileInfo } from "fflate";

const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_INSTRUCTION_BYTES = 256 * 1024;
const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PACKAGE_FILES = 500;

export class ZimoSkillCatalogGateway implements SkillCatalogGateway {
  constructor(
    _baseUrl: string,
    _sessions: SessionStore,
    _secrets: SecretStore,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly validateDownloadUrl: (url: URL) => Promise<void> = assertPublicHttpsUrl,
  ) {}

  list(_signal: AbortSignal): Promise<readonly RemoteSkillCatalogEntry[]> {
    return Promise.reject(
      new AppError({
        code: "SKILL_CATALOG_DISABLED",
        category: "configuration",
        userMessage: "Skill 目录不从云端接口加载。",
      }),
    );
  }

  async download(
    entry: RemoteSkillCatalogEntry,
    signal: AbortSignal,
  ): Promise<InstructionSkillPackage> {
    if (!entry.downloadUrl) throw invalidResponse("该 Skill 没有可用的安装包。");
    let url = parseUrl(entry.downloadUrl);
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      await this.validateDownloadUrl(url);
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/zip" },
        redirect: "manual",
        signal,
      }).catch((cause) => {
        throw networkError("Skill 安装包下载失败，请稍后重试。", cause);
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === 3) throw invalidResponse("Skill 下载地址重定向无效。");
        url = parseUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw networkError(`Skill 安装包下载失败（${response.status}）。`);
      try {
        return readInstructionArchive(await readLimited(response, MAX_ARCHIVE_BYTES), entry);
      } catch (cause) {
        if (cause instanceof AppError) throw cause;
        throw invalidResponse("Skill 安装包无法安全解析。", cause);
      }
    }
    throw invalidResponse();
  }
}

function readInstructionArchive(
  archive: Uint8Array,
  entry: RemoteSkillCatalogEntry,
): InstructionSkillPackage {
  const counts = { files: 0, totalBytes: 0 };
  const extracted = unzipSync(archive, {
    filter: (file) => shouldExtractPackageFile(file, counts),
  });
  const entries = Object.entries(extracted).filter(([path]) => !isIgnoredArchivePath(path));
  const instructionEntries = entries.filter(
    ([path]) => archiveSegments(path).at(-1) === "SKILL.md",
  );
  if (instructionEntries.length !== 1) {
    throw invalidResponse("Skill 安装包必须且只能包含一个 SKILL.md。");
  }
  const [instructionPath, instructionBytes] = instructionEntries[0]!;
  if (instructionBytes.byteLength > MAX_INSTRUCTION_BYTES) {
    throw invalidResponse("Skill 的 SKILL.md 超过大小限制。");
  }
  const rootSegments = archiveSegments(instructionPath).slice(0, -1);
  const files = entries.flatMap(([path, content]) => {
    const segments = archiveSegments(path);
    if (!startsWithSegments(segments, rootSegments)) return [];
    const relativeSegments = segments.slice(rootSegments.length);
    if (relativeSegments.length === 0) return [];
    return [{ path: relativeSegments.join("/"), content }];
  });
  if (!files.some((file) => file.path === "SKILL.md")) {
    throw invalidResponse("Skill 安装包缺少 SKILL.md。");
  }
  const content = new TextDecoder("utf-8", { fatal: true }).decode(instructionBytes).trim();
  if (!content) throw invalidResponse("Skill 的 SKILL.md 不能为空。");
  const digest = createHash("sha256").update(entry.packageId).update("\0");
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    digest.update(file.path).update("\0").update(file.content).update("\0");
  }
  return {
    packageId: entry.packageId,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    category: entry.category,
    tags: [],
    permissions: ["context:user-input", "context:conversation"],
    instructions: content,
    checksum: digest.digest("hex"),
    files,
  };
}

function shouldExtractPackageFile(
  file: UnzipFileInfo,
  counts: { files: number; totalBytes: number },
): boolean {
  const normalized = normalizeArchivePath(file.name);
  if (normalized.endsWith("/") || isIgnoredArchivePath(normalized)) return false;
  counts.files += 1;
  counts.totalBytes += file.originalSize;
  if (counts.files > MAX_PACKAGE_FILES) throw invalidResponse("Skill 安装包文件数量超过安全上限。");
  if (file.originalSize > MAX_FILE_BYTES) throw invalidResponse("Skill 安装包包含过大的单个文件。");
  if (counts.totalBytes > MAX_PACKAGE_BYTES)
    throw invalidResponse("Skill 安装包解压后超过大小限制。");
  return true;
}

function normalizeArchivePath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    normalized.length > 1_000 ||
    segments.some((segment) => segment === ".." || segment === ".")
  ) {
    throw invalidResponse("Skill 安装包包含不安全的文件路径。");
  }
  return normalized;
}

function archiveSegments(value: string): string[] {
  return normalizeArchivePath(value).split("/").filter(Boolean);
}

function isIgnoredArchivePath(value: string): boolean {
  const segments = value.replaceAll("\\", "/").split("/").filter(Boolean);
  return segments.includes("__MACOSX") || segments.at(-1) === ".DS_Store";
}

function startsWithSegments(value: readonly string[], prefix: readonly string[]): boolean {
  return prefix.every((segment, index) => value[index] === segment);
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > limit) throw invalidResponse("远端响应超过大小限制。");
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
        throw invalidResponse("远端响应超过大小限制。");
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

async function assertPublicHttpsUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw unsafeUrl();
  const addresses = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw unsafeUrl();
  }
}

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [first = 0, second = 0] = address.split(".").map(Number);
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127)
    );
  }
  const value = address.toLowerCase();
  return !(
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb")
  );
}

function parseUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw unsafeUrl();
  }
}

function unsafeUrl(): AppError {
  return new AppError({
    code: "SKILL_DOWNLOAD_URL_UNSAFE",
    category: "security",
    userMessage: "Skill 下载地址不是安全的公开 HTTPS 地址。",
  });
}

function invalidResponse(
  message = "Skill 服务返回的数据无法安全处理。",
  cause?: unknown,
): AppError {
  return new AppError({
    code: "SKILL_CATALOG_INVALID_RESPONSE",
    category: "security",
    userMessage: message,
    cause,
  });
}

function networkError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: "SKILL_CATALOG_NETWORK_ERROR",
    category: "network",
    userMessage: message,
    retryable: true,
    cause,
  });
}
