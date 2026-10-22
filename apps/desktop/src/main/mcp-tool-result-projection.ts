import type { CallToolResult } from "@modelcontextprotocol/client";

const DIDI_SERVER_ID = "didi";
const DIDI_ESTIMATE_TOOL = "taxi_estimate";

export function projectMcpToolResult(
  serverId: string,
  toolName: string,
  result: CallToolResult,
): CallToolResult {
  if (serverId !== DIDI_SERVER_ID || toolName !== DIDI_ESTIMATE_TOOL) return result;
  const projection = projectDidiEstimate(result.structuredContent);
  return projection
    ? { ...result, structuredContent: projection }
    : withoutStructuredContent(result);
}

function projectDidiEstimate(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(value) || typeof value.traceId !== "string" || !Array.isArray(value.items)) {
    return undefined;
  }
  const items = value.items.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.productName !== "string" ||
      typeof item.productCategory !== "string" ||
      typeof item.priceText !== "string"
    ) {
      return [];
    }
    return [
      {
        productName: item.productName,
        productCategory: item.productCategory,
        priceText: item.priceText,
      },
    ];
  });
  if (items.length === 0) return undefined;
  return { traceId: value.traceId, items };
}

function withoutStructuredContent(result: CallToolResult): CallToolResult {
  return {
    content: result.content,
    ...(result.isError === undefined ? {} : { isError: result.isError }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
