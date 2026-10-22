import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type {
  WebSearchGateway,
  ExternalWebSearchProviderKind,
  WebSearchResult,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
type FetchImplementation = (input: string, init: RequestInit) => Promise<Response>;
type ResolveHost = (hostname: string) => Promise<readonly { address: string; family: number }[]>;

export class DesktopWebSearchGateway implements WebSearchGateway {
  constructor(
    private readonly fetchImplementation: FetchImplementation = (url, init) => fetch(url, init),
    private readonly resolveHost: ResolveHost = (hostname) =>
      lookup(hostname, { all: true, verbatim: true }),
  ) {}

  async search(
    input: Readonly<{
      provider: ExternalWebSearchProviderKind;
      apiKey?: string | undefined;
      baseUrl?: string | undefined;
      query: string;
      count: number;
      freshness?: "day" | "week" | "month" | undefined;
    }>,
    signal: AbortSignal,
  ): Promise<readonly WebSearchResult[]> {
    const request = createSearchRequest(input);
    const response = await safeFetch(
      request.url,
      request.init,
      signal,
      this.fetchImplementation,
      this.resolveHost,
      false,
    );
    if (!response.ok)
      throw remoteError("WEB_SEARCH_FAILED", "搜索服务暂时不可用。", response.status);
    const raw = await readLimitedText(response, MAX_RESPONSE_BYTES, signal);
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      throw remoteError(
        "WEB_SEARCH_RESPONSE_INVALID",
        "搜索服务返回了无效数据。",
        undefined,
        error,
      );
    }
    return normalizeSearchResults(input.provider, payload, input.count);
  }

  async fetch(
    input: Readonly<{ url: string; maxCharacters: number }>,
    signal: AbortSignal,
  ): Promise<Readonly<{ url: string; title?: string | undefined; content: string }>> {
    const response = await safeFetch(
      input.url,
      {
        method: "GET",
        headers: { Accept: "text/html,text/plain,application/json,application/xml" },
      },
      signal,
      this.fetchImplementation,
      this.resolveHost,
      true,
    );
    if (!response.ok) throw remoteError("WEB_FETCH_FAILED", "网页暂时无法读取。", response.status);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!isSupportedContentType(contentType)) {
      throw remoteError("WEB_FETCH_CONTENT_UNSUPPORTED", "该地址不是可读取的网页或文本内容。");
    }
    const raw = await readLimitedText(response, MAX_RESPONSE_BYTES, signal);
    if (contentType.includes("text/html") || looksLikeHtml(raw)) {
      const article = await extractArticle(raw, response.url || input.url);
      return {
        url: response.url || input.url,
        ...(article.title ? { title: article.title } : {}),
        content: truncate(article.content, input.maxCharacters),
      };
    }
    return {
      url: response.url || input.url,
      content: truncate(formatText(raw, contentType), input.maxCharacters),
    };
  }
}

function createSearchRequest(input: {
  provider: ExternalWebSearchProviderKind;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  query: string;
  count: number;
  freshness?: "day" | "week" | "month" | undefined;
}): { url: string; init: RequestInit } {
  if (input.provider === "tavily") {
    return {
      url: "https://api.tavily.com/search",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          api_key: input.apiKey,
          query: input.query,
          max_results: input.count,
          search_depth: "basic",
          ...(input.freshness ? { time_range: input.freshness } : {}),
        }),
      },
    };
  }
  if (input.provider === "brave") {
    const query = new URLSearchParams({ q: input.query, count: String(input.count) });
    if (input.freshness) {
      query.set("freshness", { day: "pd", week: "pw", month: "pm" }[input.freshness]);
    }
    return {
      url: `https://api.search.brave.com/res/v1/web/search?${query.toString()}`,
      init: {
        method: "GET",
        headers: { Accept: "application/json", "X-Subscription-Token": input.apiKey ?? "" },
      },
    };
  }
  if (!input.baseUrl) throw remoteError("WEB_SEARCH_CONFIGURATION_INVALID", "SearXNG 地址未配置。");
  const query = new URLSearchParams({ q: input.query, format: "json", pageno: "1" });
  if (input.freshness) query.set("time_range", input.freshness);
  return {
    url: `${input.baseUrl.replace(/\/+$/, "")}/search?${query.toString()}`,
    init: { method: "GET", headers: { Accept: "application/json" } },
  };
}

async function safeFetch(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  fetchImplementation: FetchImplementation,
  resolveHost: ResolveHost,
  allowRedirects: boolean,
): Promise<Response> {
  let currentUrl = url;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicHttpUrl(currentUrl, resolveHost);
    const response = await fetchImplementation(currentUrl, {
      ...init,
      redirect: "manual",
      signal,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (!allowRedirects) {
      throw remoteError("WEB_REDIRECT_REJECTED", "搜索服务返回了不允许的重定向。");
    }
    const location = response.headers.get("location");
    if (!location || redirect === MAX_REDIRECTS) {
      throw remoteError("WEB_REDIRECT_INVALID", "网页重定向次数过多或目标无效。");
    }
    currentUrl = new URL(location, currentUrl).toString();
    if (response.status === 303) {
      init = { method: "GET", ...(init.headers ? { headers: init.headers } : {}) };
    }
  }
  throw remoteError("WEB_REDIRECT_INVALID", "网页重定向次数过多。");
}

async function assertPublicHttpUrl(rawUrl: string, resolveHost: ResolveHost): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw remoteError("WEB_URL_INVALID", "网页地址无效。", undefined, error);
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw remoteError("WEB_URL_REJECTED", "只允许不含账号信息的公网 HTTP(S) 地址。");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw remoteError("WEB_URL_REJECTED", "暂不允许访问自定义端口。");
  }
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname, family: isIP(url.hostname) }]
    : await resolveHost(url.hostname).catch((error: unknown) => {
        throw remoteError("WEB_DNS_FAILED", "网页域名无法解析。", undefined, error);
      });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw remoteError("WEB_PRIVATE_ADDRESS_REJECTED", "不能访问本机、私有网络或保留地址。");
  }
}

function isPublicAddress(address: string): boolean {
  if (address.includes(":")) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
    if (/^fe[89ab]/.test(normalized)) return false;
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPublicAddress(mapped) : true;
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  const [a, b] = parts as [number, number, number, number];
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function readLimitedText(
  response: Response,
  limitBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limitBytes) {
    throw remoteError("WEB_RESPONSE_TOO_LARGE", "网页内容超过读取上限。");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limitBytes) throw remoteError("WEB_RESPONSE_TOO_LARGE", "网页内容超过读取上限。");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function normalizeSearchResults(
  provider: ExternalWebSearchProviderKind,
  payload: unknown,
  limit: number,
): readonly WebSearchResult[] {
  const root = record(payload);
  const candidates = provider === "brave" ? record(root.web).results : root.results;
  if (!Array.isArray(candidates))
    throw remoteError("WEB_SEARCH_RESPONSE_INVALID", "搜索服务返回了无效数据。");
  return candidates.slice(0, limit).flatMap((candidate) => {
    const item = record(candidate);
    const title = text(item.title ?? item.name, 500);
    const url = text(item.url, 2_000);
    const snippet = text(item.content ?? item.description ?? item.snippet, 5_000);
    if (!title || !url || !snippet) return [];
    let source: string;
    try {
      source = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return [];
    }
    const publishedAt = text(item.published_date ?? item.page_age ?? item.datePublished, 200);
    return [{ title, url, snippet, source, ...(publishedAt ? { publishedAt } : {}) }];
  });
}

async function extractArticle(
  html: string,
  url: string,
): Promise<{ title?: string; content: string }> {
  try {
    const [{ Readability }, { parseHTML }] = await Promise.all([
      import("@mozilla/readability"),
      // The worker entry uses linkedom's JavaScript canvas shim and never probes node-canvas.
      import("linkedom/worker"),
    ]);
    const { document } = parseHTML(html);
    const base = document.createElement("base");
    base.setAttribute("href", url);
    document.head?.appendChild(base);
    const article = new Readability(document as unknown as Document).parse();
    const content = article?.textContent?.replace(/\n{3,}/g, "\n\n").trim();
    if (content) return { ...(article?.title ? { title: article.title } : {}), content };
  } catch {
    // Fall through to the bounded tag-stripping fallback.
  }
  return {
    content: html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

function formatText(value: string, contentType: string): string {
  if (!contentType.includes("application/json")) return value.trim();
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value.trim();
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function truncate(value: string, maxCharacters: number): string {
  return value.length <= maxCharacters ? value : `${value.slice(0, maxCharacters)}\n\n[内容已截断]`;
}

function looksLikeHtml(value: string): boolean {
  return /<(html|head|body|article|main)\b/i.test(value.slice(0, 2_000));
}

function isSupportedContentType(value: string): boolean {
  return (
    !value ||
    value.includes("text/html") ||
    value.includes("text/plain") ||
    value.includes("application/json") ||
    value.includes("application/xml") ||
    value.includes("text/xml")
  );
}

function remoteError(
  code: string,
  userMessage: string,
  status?: number,
  cause?: unknown,
): AppError {
  return new AppError({
    code,
    category: code.includes("PRIVATE") || code.includes("REJECTED") ? "security" : "network",
    userMessage,
    retryable: status === undefined || status === 408 || status === 429 || status >= 500,
    ...(status === undefined ? {} : { safeDetails: { status } }),
    ...(cause ? { cause } : {}),
  });
}
