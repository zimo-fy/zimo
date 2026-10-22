import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { AppError } from "@zimo/domain";

export async function readLimitedAgentResponse(
  response: Response,
  limit: number,
): Promise<Uint8Array> {
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > limit) throw responseTooLarge();
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
        throw responseTooLarge();
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

export async function assertPublicAgentHttpsUrl(url: URL): Promise<void> {
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

function responseTooLarge(): AppError {
  return new AppError({
    code: "AGENT_CATALOG_INVALID_RESPONSE",
    category: "security",
    userMessage: "远端响应超过大小限制。",
  });
}

function unsafeUrl(): AppError {
  return new AppError({
    code: "AGENT_INSTRUCTIONS_URL_UNSAFE",
    category: "security",
    userMessage: "Agent 角色地址不是安全的公开 HTTPS 地址。",
  });
}
