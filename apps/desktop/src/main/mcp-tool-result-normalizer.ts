import type { CallToolResult } from "@modelcontextprotocol/client";
import { AppError, type McpJsonValue } from "@zimo/domain";

const MAX_CONTENT_CHARACTERS = 90_000;

export type McpToolResponseRejectionReason =
  "content_type_unsupported" | "json_type_unsupported" | "output_too_large";

export interface McpToolResponseDiagnostic {
  reason: McpToolResponseRejectionReason;
  source: "content" | "structured_content";
  hasStructuredContent: boolean;
  contentBlockCount: number;
  contentTypes: readonly string[];
  observed: number | string;
  limit?: number;
}

interface RejectionDetails {
  reason: McpToolResponseRejectionReason;
  source: McpToolResponseDiagnostic["source"];
  observed: number | string;
  limit?: number;
}

class McpToolResponseShapeError extends Error {
  constructor(readonly details: RejectionDetails) {
    super(details.reason);
  }
}

export function normalizeMcpToolResult(
  result: CallToolResult,
  reportRejection?: (diagnostic: McpToolResponseDiagnostic) => void,
): McpJsonValue {
  const content = result.content ?? [];
  const hasStructuredContent = result.structuredContent !== undefined;
  try {
    const source = result.structuredContent != null ? "structured_content" : "content";
    const value =
      result.structuredContent ??
      (() => {
        const texts = content.map((block) => {
          if (block.type !== "text") {
            throw rejected("content_type_unsupported", source, block.type);
          }
          return block.text;
        });
        if (texts.length === 0) return { text: "" };
        const text = texts.join("\n");
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return { text };
        }
      })();
    const serialized = serializeJson(value, source);
    const outputCharacters = serialized.length;
    if (outputCharacters > MAX_CONTENT_CHARACTERS) {
      throw rejected("output_too_large", source, outputCharacters, MAX_CONTENT_CHARACTERS);
    }
    return parseJsonValue(serialized, source);
  } catch (error) {
    if (!(error instanceof McpToolResponseShapeError)) throw error;
    try {
      reportRejection?.({
        ...error.details,
        hasStructuredContent,
        contentBlockCount: content.length,
        contentTypes: [...new Set(content.map((block) => block.type))].slice(0, 10),
      });
    } catch {
      // Diagnostics must never change the tool call outcome.
    }
    throw invalidResponse();
  }
}

function serializeJson(value: unknown, source: McpToolResponseDiagnostic["source"]): string {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw rejected("json_type_unsupported", source, typeof value);
    return serialized;
  } catch (error) {
    if (error instanceof McpToolResponseShapeError) throw error;
    throw rejected("json_type_unsupported", source, typeof value);
  }
}

function parseJsonValue(
  serialized: string,
  source: McpToolResponseDiagnostic["source"],
): McpJsonValue {
  const parsed: unknown = JSON.parse(serialized);
  if (!isMcpJsonValue(parsed)) {
    throw rejected("json_type_unsupported", source, typeof parsed);
  }
  return parsed;
}

function isMcpJsonValue(value: unknown): value is McpJsonValue {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (
      current === null ||
      typeof current === "string" ||
      typeof current === "boolean" ||
      (typeof current === "number" && Number.isFinite(current))
    ) {
      continue;
    }
    if (Array.isArray(current)) {
      for (const item of current) pending.push(item);
      continue;
    }
    if (isRecord(current)) {
      for (const item of Object.values(current)) pending.push(item);
      continue;
    }
    return false;
  }
  return true;
}

function rejected(
  reason: McpToolResponseRejectionReason,
  source: McpToolResponseDiagnostic["source"],
  observed: number | string,
  limit?: number,
): McpToolResponseShapeError {
  return new McpToolResponseShapeError({ reason, source, observed, ...(limit ? { limit } : {}) });
}

function invalidResponse(): AppError {
  return new AppError({
    code: "MCP_RESPONSE_INVALID",
    category: "security",
    userMessage: "MCP 服务返回的数据无法安全处理。",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
