import { describe, expect, it } from "vitest";

import { projectMcpToolResult } from "./mcp-tool-result-projection";

describe("MCP tool result projection", () => {
  it("keeps only fields required by the Didi estimate flow", () => {
    const result = projectMcpToolResult("didi", "taxi_estimate", {
      content: [{ type: "text", text: "车型价格说明" }],
      structuredContent: {
        traceId: "trace-1",
        items: [
          {
            productName: "快车",
            productCategory: "1",
            priceText: "75",
            routePoints: Array.from({ length: 2_626 }, (_, index) => index),
          },
        ],
        upstreamPayload: "private",
      },
    });

    expect(result.structuredContent).toEqual({
      traceId: "trace-1",
      items: [{ productName: "快车", productCategory: "1", priceText: "75" }],
    });
    expect(JSON.stringify(result)).not.toContain("routePoints");
    expect(JSON.stringify(result)).not.toContain("upstreamPayload");
  });

  it("falls back to the text channel when required structured fields are absent", () => {
    const result = projectMcpToolResult("didi", "taxi_estimate", {
      content: [{ type: "text", text: "可用车型：快车" }],
      structuredContent: { oversizedInternalData: Array.from({ length: 2_626 }, () => 1) },
    });

    expect(result).toEqual({ content: [{ type: "text", text: "可用车型：快车" }] });
  });

  it("does not alter other MCP tools", () => {
    const result = {
      content: [{ type: "text" as const, text: "unchanged" }],
      structuredContent: { value: true },
    };

    expect(projectMcpToolResult("didi", "taxi_query_order", result)).toBe(result);
    expect(projectMcpToolResult("other", "taxi_estimate", result)).toBe(result);
  });
});
