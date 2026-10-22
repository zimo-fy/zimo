import {
  modelGatewayContentCharacters,
  type ModelGatewayToolDefinition,
  type ModelGatewayToolMessage,
} from "@zimo/domain";

export type ModelProviderRequestOperation =
  "connection_test" | "stream" | "classify" | "tool_initial" | "tool_followup";

export interface ModelProviderFailureDiagnostic {
  operation: ModelProviderRequestOperation;
  durationMs: number;
  errorName: string;
  status?: number;
  errorCode?: string;
  transportKind?: string;
  causes: readonly { name: string; code?: string }[];
  requestMessageCount?: number;
  requestToolCount?: number;
  requestMessageCharacters?: number;
  requestToolResultCharacters?: number;
  requestToolSchemaCharacters?: number;
}

type ToolRequest = {
  messages: readonly ModelGatewayToolMessage[];
  tools: readonly ModelGatewayToolDefinition[];
};

const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "TimeoutError",
  "AbortError",
  "FetchError",
  "SocketError",
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "ConnectTimeoutError",
  "HeadersTimeoutError",
  "BodyTimeoutError",
]);

const SAFE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "invalid_request_error",
  "rate_limit_exceeded",
]);

export function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  return typeof candidate.statusCode === "number" ? candidate.statusCode : undefined;
}

export function createFailureDiagnostic(
  operation: ModelProviderRequestOperation,
  startedAt: number,
  error: unknown,
  request?: ToolRequest,
): ModelProviderFailureDiagnostic {
  const root = record(error);
  const status = readStatus(error);
  const errorCode = safeCode(root.code);
  const causes = causeChain(error);
  const transportKind = classifyTransport(error, causes);
  return {
    operation,
    durationMs: Math.max(0, Date.now() - startedAt),
    errorName: safeName(root.name),
    ...(status !== undefined ? { status } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(transportKind ? { transportKind } : {}),
    causes,
    ...(request ? summarizeRequest(request) : {}),
  };
}

function summarizeRequest(
  request: ToolRequest,
): Pick<
  ModelProviderFailureDiagnostic,
  | "requestMessageCount"
  | "requestToolCount"
  | "requestMessageCharacters"
  | "requestToolResultCharacters"
  | "requestToolSchemaCharacters"
> {
  return {
    requestMessageCount: request.messages.length,
    requestToolCount: request.tools.length,
    requestMessageCharacters: request.messages.reduce(
      (sum, message) => sum + modelGatewayContentCharacters(message.content),
      0,
    ),
    requestToolResultCharacters: request.messages.reduce(
      (sum, message) => sum + (message.role === "tool" ? message.content.length : 0),
      0,
    ),
    requestToolSchemaCharacters: request.tools.reduce(
      (sum, tool) => sum + tool.description.length + JSON.stringify(tool.inputSchema).length,
      0,
    ),
  };
}

function causeChain(error: unknown): readonly { name: string; code?: string }[] {
  const causes: { name: string; code?: string }[] = [];
  const visited = new Set<object>();
  let current = record(error).cause;
  while (current && typeof current === "object" && causes.length < 3 && !visited.has(current)) {
    visited.add(current);
    const value = record(current);
    const code = safeCode(value.code);
    causes.push({ name: safeName(value.name), ...(code ? { code } : {}) });
    current = value.cause;
  }
  return causes;
}

function classifyTransport(
  error: unknown,
  causes: readonly { name: string; code?: string }[],
): string | undefined {
  const codes = [safeCode(record(error).code), ...causes.map((cause) => cause.code)];
  if (codes.some((code) => code === "ECONNRESET" || code === "UND_ERR_SOCKET"))
    return "connection_reset";
  if (codes.some((code) => code === "ECONNREFUSED")) return "connection_refused";
  if (codes.some((code) => code === "ENOTFOUND" || code === "EAI_AGAIN")) return "dns";
  if (codes.some((code) => code === "ETIMEDOUT" || code?.includes("TIMEOUT"))) return "timeout";
  if (codes.some((code) => code?.includes("CERT") || code?.includes("TLS"))) return "tls";
  if (causes.some((cause) => cause.name === "TimeoutError")) return "timeout";
  for (const message of errorMessages(error)) {
    if (/fetch failed/i.test(message)) return "fetch_failed";
    if (
      /socket hang up|other side closed|terminated|connection closed|connection error/i.test(
        message,
      )
    ) {
      return "connection_closed";
    }
    if (/timed? ?out/i.test(message)) return "timeout";
  }
  return undefined;
}

function errorMessages(error: unknown): readonly string[] {
  const messages: string[] = [];
  const visited = new Set<object>();
  let current = error;
  let depth = 0;
  while (current && typeof current === "object" && depth < 4 && !visited.has(current)) {
    depth += 1;
    visited.add(current);
    const value = record(current);
    if (typeof value.message === "string") messages.push(value.message.slice(0, 500));
    current = value.cause;
  }
  return messages;
}

function safeName(value: unknown): string {
  return typeof value === "string" && SAFE_ERROR_NAMES.has(value) ? value : "OtherError";
}

function safeCode(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_ERROR_CODES.has(value) ? value : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
