import { isIP } from "node:net";

import type { ModelConnection, ModelNativeSearchGateway, WebSearchResult } from "@zimo/domain";
import { AppError } from "@zimo/domain";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
type FetchImplementation = (url: string, init: RequestInit) => Promise<Response>;

export class DesktopModelNativeSearchGateway implements ModelNativeSearchGateway {
  constructor(
    private readonly fetchImplementation: FetchImplementation = (url, init) => fetch(url, init),
  ) {}

  async search(
    connection: ModelConnection,
    input: Readonly<{ query: string; count: number }>,
    signal: AbortSignal,
  ): Promise<Readonly<{ results: readonly WebSearchResult[]; errorCount: number }>> {
    const endpoint = messagesEndpoint(connection.baseUrl);
    const response = await this.fetchImplementation(endpoint, {
      method: "POST",
      redirect: "manual",
      signal,
      headers: {
        Authorization: `Bearer ${connection.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: connection.modelName,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `请使用 web_search 工具实际联网检索以下问题，并给出可核对的来源：${input.query}`,
          },
        ],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
        tool_choice: { type: "any" },
      }),
    });
    if (!response.ok)
      throw nativeError(
        "MODEL_NATIVE_SEARCH_FAILED",
        "当前模型的原生联网请求失败，请检查网关是否支持该能力。",
      );
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES)
      throw nativeError("MODEL_NATIVE_SEARCH_RESPONSE_INVALID", "原生联网响应超过大小限制。");
    const raw = await readBoundedResponse(response, signal);
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw nativeError("MODEL_NATIVE_SEARCH_RESPONSE_INVALID", "原生联网返回了无效数据。");
    }
    return parseNativeResults(payload, input.count);
  }
}

function messagesEndpoint(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw nativeError("MODEL_NATIVE_SEARCH_URL_INVALID", "模型 API 地址无效。");
  }
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw nativeError(
      "MODEL_NATIVE_SEARCH_URL_INVALID",
      "原生联网只允许使用已配置的 HTTPS 模型地址。",
    );
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/messages`;
  return url.toString();
}

function parseNativeResults(
  payload: unknown,
  count: number,
): { results: readonly WebSearchResult[]; errorCount: number } {
  if (!record(payload) || !Array.isArray(payload.content))
    throw nativeError("MODEL_NATIVE_SEARCH_RESPONSE_INVALID", "当前网关没有返回原生联网结果。");
  const results: WebSearchResult[] = [];
  const seen = new Set<string>();
  let errorCount = 0;
  let usedSearch = false;
  for (const block of payload.content) {
    if (!record(block)) continue;
    if (block.type === "server_tool_use" && block.name === "web_search") usedSearch = true;
    if (block.type !== "web_search_tool_result") continue;
    if (record(block.content) && block.content.type === "web_search_tool_result_error") {
      errorCount += 1;
      continue;
    }
    if (!Array.isArray(block.content)) continue;
    for (const item of block.content) {
      if (record(item) && item.type === "web_search_tool_result_error") {
        errorCount += 1;
        continue;
      }
      if (!record(item) || item.type !== "web_search_result" || typeof item.url !== "string")
        continue;
      const url = safeSourceUrl(item.url);
      if (!url || seen.has(url) || results.length >= count) continue;
      seen.add(url);
      results.push({
        title: typeof item.title === "string" ? item.title.slice(0, 500) : url,
        url,
        snippet: "原生搜索未提供摘要；请使用 web_fetch 核实来源。",
        source: new URL(url).hostname.replace(/^www\./, ""),
      });
    }
  }
  if (!usedSearch)
    throw nativeError(
      "MODEL_NATIVE_SEARCH_UNSUPPORTED",
      "当前模型未执行原生联网搜索，不能仅凭文本回答判定为支持。",
    );
  if (results.length === 0)
    throw nativeError(
      errorCount > 0 ? "MODEL_NATIVE_SEARCH_FAILED" : "MODEL_NATIVE_SEARCH_RESPONSE_INVALID",
      errorCount > 0
        ? "原生联网工具返回了错误，没有可用来源。"
        : "原生联网已执行，但没有返回有效来源。",
    );
  return { results, errorCount };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBoundedResponse(response: Response, signal: AbortSignal): Promise<string> {
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
      if (total > MAX_RESPONSE_BYTES)
        throw nativeError("MODEL_NATIVE_SEARCH_RESPONSE_INVALID", "原生联网响应超过大小限制。");
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

function safeSourceUrl(raw: string): string | null {
  if (raw.length > 2_000) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      isIP(host) !== 0
    )
      return null;
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function nativeError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "network", userMessage });
}
