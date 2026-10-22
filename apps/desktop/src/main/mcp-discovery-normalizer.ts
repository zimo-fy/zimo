import type { Tool } from "@modelcontextprotocol/client";
import {
  AppError,
  isValidMcpToolName,
  MCP_MAX_REMOTE_TOOLS,
  MCP_MAX_TOOL_CATALOG_CHARACTERS,
  MCP_MAX_TOOL_SCHEMA_CHARACTERS,
  type McpDiscoveredTool,
  type McpJsonValue,
} from "@zimo/domain";

export type McpDiscoveryRejectionReason =
  | "too_many_tools"
  | "invalid_tool_name"
  | "schema_invalid"
  | "schema_too_large"
  | "catalog_too_large";

export interface McpDiscoveryDiagnostic {
  reason: McpDiscoveryRejectionReason;
  observed: number | string;
  limit?: number;
  toolIndex?: number;
}

type RejectionDetails = McpDiscoveryDiagnostic;

class McpDiscoveryShapeError extends Error {
  constructor(readonly details: RejectionDetails) {
    super(details.reason);
  }
}

export function normalizeMcpDiscoveryTools(
  tools: readonly Tool[],
  reportRejection?: (diagnostic: McpDiscoveryDiagnostic) => void,
): readonly McpDiscoveredTool[] {
  try {
    if (tools.length > MCP_MAX_REMOTE_TOOLS) {
      throw rejected("too_many_tools", tools.length, MCP_MAX_REMOTE_TOOLS);
    }
    const normalized = tools.map((tool, index) => normalizeTool(tool, index));
    const catalogCharacters = JSON.stringify(normalized).length;
    if (catalogCharacters > MCP_MAX_TOOL_CATALOG_CHARACTERS) {
      throw rejected("catalog_too_large", catalogCharacters, MCP_MAX_TOOL_CATALOG_CHARACTERS);
    }
    return normalized;
  } catch (error) {
    if (!(error instanceof McpDiscoveryShapeError)) throw error;
    try {
      reportRejection?.(error.details);
    } catch {
      // Diagnostics must never change the discovery outcome.
    }
    throw invalidResponse();
  }
}

function normalizeTool(tool: Tool, toolIndex: number): McpDiscoveredTool {
  if (!isValidMcpToolName(tool.name)) {
    throw rejected("invalid_tool_name", tool.name.length, undefined, toolIndex);
  }
  const inputSchema = normalizeJsonRecord(tool.inputSchema, toolIndex);
  const annotations = tool.annotations
    ? {
        ...(typeof tool.annotations.readOnlyHint === "boolean"
          ? { readOnly: tool.annotations.readOnlyHint }
          : {}),
        ...(typeof tool.annotations.destructiveHint === "boolean"
          ? { destructive: tool.annotations.destructiveHint }
          : {}),
        ...(typeof tool.annotations.idempotentHint === "boolean"
          ? { idempotent: tool.annotations.idempotentHint }
          : {}),
        ...(typeof tool.annotations.openWorldHint === "boolean"
          ? { openWorld: tool.annotations.openWorldHint }
          : {}),
      }
    : undefined;
  return {
    name: tool.name,
    ...(typeof tool.title === "string" && tool.title ? { title: tool.title.slice(0, 160) } : {}),
    ...(typeof tool.description === "string" && tool.description
      ? { description: tool.description.slice(0, 2_000) }
      : {}),
    inputSchema,
    ...(annotations ? { annotations } : {}),
  };
}

function normalizeJsonRecord(
  value: unknown,
  toolIndex: number,
): Readonly<Record<string, McpJsonValue>> {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw rejected("schema_invalid", typeof value, undefined, toolIndex);
  }
  if (serialized === undefined) {
    throw rejected("schema_invalid", typeof value, undefined, toolIndex);
  }
  if (serialized.length > MCP_MAX_TOOL_SCHEMA_CHARACTERS) {
    throw rejected(
      "schema_too_large",
      serialized.length,
      MCP_MAX_TOOL_SCHEMA_CHARACTERS,
      toolIndex,
    );
  }
  const normalized = JSON.parse(serialized) as unknown;
  if (!isRecord(normalized)) {
    throw rejected("schema_invalid", typeof normalized, undefined, toolIndex);
  }
  return normalized as Readonly<Record<string, McpJsonValue>>;
}

function rejected(
  reason: McpDiscoveryRejectionReason,
  observed: number | string,
  limit?: number,
  toolIndex?: number,
): McpDiscoveryShapeError {
  return new McpDiscoveryShapeError({
    reason,
    observed,
    ...(limit !== undefined ? { limit } : {}),
    ...(toolIndex !== undefined ? { toolIndex } : {}),
  });
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
