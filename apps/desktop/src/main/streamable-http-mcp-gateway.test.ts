import { describe, expect, it, vi } from "vitest";
import type { Tool } from "@modelcontextprotocol/client";

import {
  createMcpRequestHeaders,
  createMcpRequestUrl,
  StreamableHttpMcpGateway,
  type McpSession,
} from "./streamable-http-mcp-gateway";

const target = {
  id: "example",
  name: "Example",
  endpoint: "https://mcp.example.com/",
  source: "custom" as const,
  authentication: "bearer" as const,
};

describe("StreamableHttpMcpGateway", () => {
  it("connects, performs tools/list and keeps every returned tool", async () => {
    const session = fakeSession();
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
    );

    const result = await gateway.discover(target, "test-token", new AbortController().signal);

    expect(session.connect).toHaveBeenCalledOnce();
    expect(session.listTools).toHaveBeenCalledOnce();
    expect(result.tools.map((tool) => tool.name)).toEqual(["read_item", "write_item"]);
    expect(session.close).toHaveBeenCalledOnce();
  });

  it("accepts MCP-standard namespaced tool names containing dots", async () => {
    const session = fakeSession();
    session.listTools = vi.fn(async () => [
      { name: "doc.ai_format_pure_text", inputSchema: { type: "object" as const } },
      { name: "smartcanvas.list_blocks", inputSchema: { type: "object" as const } },
    ]);
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
    );

    await expect(
      gateway.discover(target, "test-token", new AbortController().signal),
    ).resolves.toMatchObject({
      tools: [{ name: "doc.ai_format_pure_text" }, { name: "smartcanvas.list_blocks" }],
    });
  });

  it("reports bounded discovery metadata when a tool name is invalid", async () => {
    const session = fakeSession();
    session.listTools = vi.fn(async () => [
      { name: "invalid tool", inputSchema: { type: "object" as const } },
    ]);
    const report = vi.fn();
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
      undefined,
      undefined,
      report,
    );

    await expect(
      gateway.discover(target, "test-token", new AbortController().signal),
    ).rejects.toThrow("无法安全处理");
    expect(report).toHaveBeenCalledWith({
      serverId: "example",
      reason: "invalid_tool_name",
      observed: 12,
      toolIndex: 0,
    });
  });

  it("accepts deeply nested and wide tool schemas within the character limit", async () => {
    let deepSchema: Record<string, unknown> = { type: "string" };
    for (let index = 0; index < 20; index += 1) {
      deepSchema = { type: "object", properties: { child: deepSchema } };
    }
    const wideSchema = {
      type: "object",
      properties: Object.fromEntries(
        Array.from({ length: 501 }, (_, index) => [`field_${index}`, { type: "string" }]),
      ),
    };
    const session = fakeSession();
    session.listTools = vi.fn(async () => [
      { name: "deep_schema", inputSchema: deepSchema as Tool["inputSchema"] },
      { name: "wide_schema", inputSchema: wideSchema as Tool["inputSchema"] },
    ]);
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
    );

    await expect(
      gateway.discover(target, "test-token", new AbortController().signal),
    ).resolves.toMatchObject({
      tools: [{ name: "deep_schema" }, { name: "wide_schema" }],
    });
  });

  it("continues to reject a tool schema above the character limit", async () => {
    const session = fakeSession();
    session.listTools = vi.fn(async () => [
      {
        name: "oversized_schema",
        inputSchema: {
          type: "object" as const,
          description: "x".repeat(50_001),
        },
      },
    ]);
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
    );

    await expect(
      gateway.discover(target, "test-token", new AbortController().signal),
    ).rejects.toThrow("无法安全处理");
  });

  it("uses tools/call and normalizes structured output", async () => {
    const session = fakeSession();
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
    );

    await expect(
      gateway.callTool(
        target,
        "test-token",
        "write_item",
        { value: "x" },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ value: { saved: true } });
    expect(session.callTool).toHaveBeenCalledWith(
      "write_item",
      { value: "x" },
      expect.any(AbortSignal),
    );
  });

  it("reuses one initialized MCP session within a run and closes it afterward", async () => {
    const session = fakeSession();
    const createSession = vi.fn(() => session);
    const gateway = new StreamableHttpMcpGateway(createSession, async () => undefined);
    const signal = new AbortController().signal;

    await gateway.callTool(target, "test-token", "read_item", {}, signal, "run-1");
    await gateway.callTool(target, "test-token", "write_item", { value: "x" }, signal, "run-1");

    expect(createSession).toHaveBeenCalledOnce();
    expect(session.connect).toHaveBeenCalledOnce();
    expect(session.callTool).toHaveBeenCalledTimes(2);
    expect(session.close).not.toHaveBeenCalled();

    await gateway.closeRun("run-1");
    expect(session.close).toHaveBeenCalledOnce();
  });

  it("evicts a failed run session so the next call reconnects", async () => {
    const failedSession = fakeSession();
    failedSession.callTool = vi.fn(async () => {
      throw new Error("connection reset");
    });
    const recoveredSession = fakeSession();
    const createSession = vi
      .fn()
      .mockReturnValueOnce(failedSession)
      .mockReturnValueOnce(recoveredSession);
    const gateway = new StreamableHttpMcpGateway(createSession, async () => undefined);
    const signal = new AbortController().signal;

    await expect(
      gateway.callTool(target, "test-token", "read_item", {}, signal, "run-1"),
    ).rejects.toMatchObject({ code: "MCP_CONNECTION_FAILED" });
    await expect(
      gateway.callTool(target, "test-token", "read_item", {}, signal, "run-1"),
    ).resolves.toEqual({ value: { saved: true } });

    expect(createSession).toHaveBeenCalledTimes(2);
    expect(failedSession.close).toHaveBeenCalledOnce();
    await gateway.closeRun("run-1");
    expect(recoveredSession.close).toHaveBeenCalledOnce();
  });

  it("reports safe transport metadata for a failed tools/call request", async () => {
    const session = fakeSession();
    session.callTool = vi.fn(async () => {
      throw Object.assign(new Error("response contains secret-token"), {
        name: "SdkHttpError",
        code: "ClientHttpNotImplemented",
        data: { status: 429, statusText: "Too Many Requests", text: "secret-token" },
      });
    });
    const report = vi.fn();
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
      undefined,
      undefined,
      undefined,
      report,
    );

    await expect(
      gateway.callTool(
        target,
        "credential-secret",
        "slide_progress",
        { session_id: "argument-secret" },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "MCP_CONNECTION_FAILED" });
    expect(report).toHaveBeenCalledWith({
      serverId: "example",
      phase: "tools_call",
      durationMs: expect.any(Number),
      errorName: "SdkHttpError",
      errorCode: "ClientHttpNotImplemented",
      httpStatus: 429,
      toolName: "slide_progress",
    });
    const serialized = JSON.stringify(report.mock.calls);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("credential-secret");
    expect(serialized).not.toContain("argument-secret");
    expect(serialized).not.toContain("Too Many Requests");
  });

  it("distinguishes a tools/list transport failure from connection failures", async () => {
    const session = fakeSession();
    session.listTools = vi.fn(async () => {
      throw Object.assign(new Error("remote body"), { code: "ECONNRESET" });
    });
    const report = vi.fn();
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
      undefined,
      undefined,
      undefined,
      report,
    );

    await expect(
      gateway.discover(target, "test-token", new AbortController().signal),
    ).rejects.toMatchObject({ code: "MCP_CONNECTION_FAILED" });
    expect(report).toHaveBeenCalledWith({
      serverId: "example",
      phase: "tools_list",
      durationMs: expect.any(Number),
      errorName: "Error",
      errorCode: "ECONNRESET",
    });
  });

  it("reports only response size metadata when tool output is rejected", async () => {
    const session = fakeSession();
    session.callTool = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "safe fallback" }],
      structuredContent: { text: "x".repeat(90_000) },
    }));
    const report = vi.fn();
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
      undefined,
      report,
    );

    await expect(
      gateway.callTool(target, "test-token", "estimate", {}, new AbortController().signal),
    ).rejects.toThrow("无法安全处理");
    expect(report).toHaveBeenCalledWith({
      serverId: "example",
      toolName: "estimate",
      reason: "output_too_large",
      source: "structured_content",
      hasStructuredContent: true,
      contentBlockCount: 1,
      contentTypes: ["text"],
      observed: 90_011,
      limit: 90_000,
    });
  });

  it("rejects a server that does not declare the tools capability", async () => {
    const session = fakeSession();
    session.supportsTools = () => false;
    const gateway = new StreamableHttpMcpGateway(
      () => session,
      async () => undefined,
    );

    await expect(
      gateway.discover(target, "test-token", new AbortController().signal),
    ).rejects.toThrow("没有声明 tools 能力");
    expect(session.listTools).not.toHaveBeenCalled();
    expect(session.close).toHaveBeenCalledOnce();
  });

  it("injects only the fixed Tencent Meeting token headers", () => {
    expect(
      createMcpRequestHeaders(
        {
          id: "tencent-meeting",
          name: "腾讯会议",
          endpoint: "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1",
          source: "catalog",
          authentication: "header_token",
        },
        "test-token",
      ),
    ).toEqual({
      "X-Tencent-Meeting-Token": "test-token",
      "X-Skill-Version": "v1.0.1",
    });
  });

  it("injects catalog API keys into their fixed headers", () => {
    expect(
      createMcpRequestHeaders(
        {
          id: "tencent-docs",
          name: "腾讯文档",
          endpoint: "https://docs.qq.com/openapi/mcp",
          source: "catalog",
          authentication: "api_key",
        },
        "test-token",
      ),
    ).toEqual({ Authorization: "test-token" });
  });

  it("injects query credentials without changing the stored endpoint", () => {
    const target = {
      id: "amap",
      name: "高德地图",
      endpoint: "https://mcp.amap.com/mcp",
      source: "catalog" as const,
      authentication: "query_token" as const,
    };
    expect(createMcpRequestUrl(target, "test-key").toString()).toBe(
      "https://mcp.amap.com/mcp?key=test-key",
    );
    expect(target.endpoint).toBe("https://mcp.amap.com/mcp");
  });

  it("rejects fixed credential placement for a custom server", () => {
    expect(() =>
      createMcpRequestHeaders(
        {
          id: "tencent-docs",
          name: "spoofed",
          endpoint: "https://example.com/mcp",
          source: "custom",
          authentication: "api_key",
        },
        "test-token",
      ),
    ).toThrow("凭据配置无效");
  });
});

function fakeSession(): McpSession {
  return {
    connect: vi.fn(async () => undefined),
    supportsTools: () => true,
    listTools: vi.fn(async () => [
      { name: "read_item", inputSchema: { type: "object" as const } },
      { name: "write_item", inputSchema: { type: "object" as const } },
    ]),
    callTool: vi.fn(async () => ({
      content: [{ type: "text" as const, text: "saved" }],
      structuredContent: { saved: true },
    })),
    serverVersion: () => ({ name: "test-server", version: "1.0.0" }),
    close: vi.fn(async () => undefined),
  };
}
