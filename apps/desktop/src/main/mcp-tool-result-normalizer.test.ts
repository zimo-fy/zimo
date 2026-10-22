import { describe, expect, it, vi } from "vitest";

import { normalizeMcpToolResult } from "./mcp-tool-result-normalizer";

describe("MCP tool result diagnostics", () => {
  it("accepts large arrays when the total serialized result stays within the character limit", () => {
    const report = vi.fn();

    const value = normalizeMcpToolResult(
      {
        content: [{ type: "text", text: "fallback" }],
        structuredContent: { items: Array.from({ length: 2_626 }, (_, index) => index) },
      },
      report,
    );

    expect(value).toEqual({ items: Array.from({ length: 2_626 }, (_, index) => index) });
    expect(report).not.toHaveBeenCalled();
  });

  it("accepts deeply nested JSON when the serialized result stays within the character limit", () => {
    const report = vi.fn();
    const nested: Record<string, unknown> = {};
    let cursor = nested;
    for (let index = 0; index < 30; index += 1) {
      const child: Record<string, unknown> = {};
      cursor.child = child;
      cursor = child;
    }

    expect(normalizeMcpToolResult({ content: [], structuredContent: nested }, report)).toEqual(
      nested,
    );
    expect(report).not.toHaveBeenCalled();
  });

  it("identifies an oversized serialized result by character count", () => {
    const report = vi.fn();

    expect(() =>
      normalizeMcpToolResult({ content: [{ type: "text", text: "x".repeat(90_001) }] }, report),
    ).toThrow("无法安全处理");
    expect(report).toHaveBeenCalledWith({
      reason: "output_too_large",
      source: "content",
      hasStructuredContent: false,
      contentBlockCount: 1,
      contentTypes: ["text"],
      observed: 90_012,
      limit: 90_000,
    });
  });

  it("identifies unsupported content blocks without recording block data", () => {
    const report = vi.fn();

    expect(() =>
      normalizeMcpToolResult(
        { content: [{ type: "image", data: "private-image", mimeType: "image/png" }] },
        report,
      ),
    ).toThrow("无法安全处理");
    expect(report).toHaveBeenCalledWith({
      reason: "content_type_unsupported",
      source: "content",
      hasStructuredContent: false,
      contentBlockCount: 1,
      contentTypes: ["image"],
      observed: "image",
    });
    expect(JSON.stringify(report.mock.calls)).not.toContain("private-image");
  });
});
