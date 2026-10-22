import { describe, expect, it, vi } from "vitest";
import type { ModelGateway } from "@zimo/domain";

import { BROWSER_TOOL_ID_LIST } from "./browser-tool-ids";
import { runModelToolLoop } from "./model-tool-loop";
import { ControlledToolService, type RegisteredTool } from "./tool-runtime";

describe("runModelToolLoop", () => {
  it("loads an installed capability during the same tool loop without extra authorization", async () => {
    const turns = [
      {
        content: "",
        toolCalls: [
          {
            id: "search-1",
            name: "search_capabilities",
            arguments: { query: "查询交通信息", kinds: ["mcp"] },
          },
        ],
      },
      {
        content: "",
        toolCalls: [{ id: "call-1", name: "mcp_1_lookup", arguments: { city: "深圳" } }],
      },
      { content: "已查询完成", toolCalls: [] },
    ];
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream(turns.shift()!)),
    };
    const execute = vi.fn(async () => ({ stations: ["前海湾"] }));
    const searchCapabilities = vi.fn(async () => ({
      installed: [
        {
          id: "mcp.transport.lookup",
          kind: "mcp" as const,
          name: "交通查询",
          description: "查询公共交通信息",
          availability: "ready" as const,
          usage: "已自动加载",
        },
      ],
      installable: [],
      loadedToolIds: ["mcp.transport.lookup"],
      guidance: "继续执行",
    }));
    const tools = new ControlledToolService(
      [tool("mcp.transport.lookup", execute), tool("product.current.inspect", vi.fn())],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-23T00:00:00.000Z") },
    );

    const result = await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "查询交通信息" }],
      tools,
      toolIds: ["product.current.inspect"],
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "agent" },
      createToolCallId: () => "local-call",
      searchCapabilities,
    });

    expect(result.content).toBe("已查询完成");
    expect(searchCapabilities).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(vi.mocked(gateway.streamWithTools!).mock.calls[0]?.[2]).toEqual([
      expect.objectContaining({ name: "mcp_0_inspect" }),
      expect.objectContaining({ name: "search_capabilities" }),
    ]);
    expect(vi.mocked(gateway.streamWithTools!).mock.calls[1]?.[2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "mcp_0_inspect" }),
        expect.objectContaining({ name: "mcp_1_lookup" }),
        expect.objectContaining({ name: "search_capabilities" }),
      ]),
    );
  });

  it("exposes the built-in memory function with a stable name in the existing tool request", async () => {
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream({ content: "你好，大力", toolCalls: [] })),
    };
    const tools = new ControlledToolService(
      [tool("zimo.memory.save", vi.fn())],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-20T00:00:00.000Z") },
    );

    await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "你好，我叫大力" }],
      toolIds: ["zimo.memory.save"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "agent", ownerUserId: "alice" },
      createToolCallId: () => "local-call",
    });

    expect(vi.mocked(gateway.streamWithTools!).mock.calls[0]?.[2]).toEqual([
      expect.objectContaining({ name: "save_user_memory" }),
    ]);
    expect(gateway.streamWithTools).toHaveBeenCalledTimes(1);
  });

  it("exposes stable web_search and web_fetch function names", async () => {
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream({ content: "done", toolCalls: [] })),
    };
    const tools = new ControlledToolService(
      [tool("zimo.web.search", vi.fn()), tool("zimo.web.fetch", vi.fn())],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-20T00:00:00.000Z") },
    );

    await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "search" }],
      toolIds: ["zimo.web.search", "zimo.web.fetch"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "workflow", nodeId: "agent" },
      createToolCallId: () => "local-call",
    });

    expect(vi.mocked(gateway.streamWithTools!).mock.calls[0]?.[2]).toEqual([
      expect.objectContaining({ name: "web_search" }),
      expect.objectContaining({ name: "web_fetch" }),
    ]);
  });

  it("exposes browser functions with stable browser names", async () => {
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream({ content: "done", toolCalls: [] })),
    };
    const tools = new ControlledToolService(
      BROWSER_TOOL_ID_LIST.map((id) => tool(id, vi.fn())),
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-23T00:00:00.000Z") },
    );

    await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "open the browser" }],
      toolIds: BROWSER_TOOL_ID_LIST,
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "agent" },
      createToolCallId: () => "local-call",
    });

    expect(
      vi.mocked(gateway.streamWithTools!).mock.calls[0]?.[2].map((definition) => definition.name),
    ).toEqual([
      "browser_tabs",
      "browser_open",
      "browser_focus",
      "browser_snapshot",
      "browser_screenshot",
      "browser_navigate",
      "browser_click",
      "browser_type",
      "browser_press",
      "browser_scroll",
      "browser_wait",
    ]);
  });

  it("exposes all tools from bound servers and returns tool results to the model", async () => {
    const turns = [
      {
        content: "working",
        toolCalls: [{ id: "call-1", name: "mcp_1_write_item", arguments: { value: "x" } }],
      },
      { content: "done", toolCalls: [] },
    ];
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream(turns.shift()!)),
    };
    const execute = vi.fn(async () => ({ saved: true }));
    const captureRound = vi.fn();
    const onText = vi.fn();
    const closeRun = vi.fn(async () => undefined);
    const tools = new ControlledToolService(
      [tool("mcp.example.read_item", vi.fn()), tool("mcp.example.write_item", execute)],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
      { closeRun },
    );

    const result = await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "write x" }],
      mcpServerIds: ["example"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "workflow", nodeId: "agent" },
      createToolCallId: () => "local-call",
      captureRound,
      onText,
    });

    expect(result.content).toBe("done");
    expect(onText.mock.calls.map(([text]) => text)).toEqual(["working", "done"]);
    expect(closeRun).toHaveBeenCalledOnce();
    expect(closeRun).toHaveBeenCalledWith("run");
    expect(execute).toHaveBeenCalledWith(
      { value: "x" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(gateway.streamWithTools).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({ name: "mcp_0_read_item" }),
        expect.objectContaining({ name: "mcp_1_write_item" }),
      ]),
      expect.any(AbortSignal),
    );
    expect(captureRound).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        round: 1,
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "mcp_0_read_item" }),
          expect.objectContaining({ name: "mcp_1_write_item" }),
        ]),
        toolCalls: [{ id: "call-1", name: "mcp_1_write_item", arguments: { value: "x" } }],
      }),
    );
    expect(captureRound).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        round: 2,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "assistant", toolCalls: expect.any(Array) }),
          expect.objectContaining({ role: "tool", content: '{"saved":true}' }),
        ]),
        toolCalls: [],
      }),
    );
  });

  it("rejects a tool call that was not exposed in this model turn", async () => {
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() =>
        toolStream({
          content: "",
          toolCalls: [{ id: "call-1", name: "unknown_tool", arguments: {} }],
        }),
      ),
    };
    const closeRun = vi.fn(async () => undefined);
    const tools = new ControlledToolService(
      [tool("mcp.example.read_item", vi.fn())],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
      { closeRun },
    );

    await expect(
      runModelToolLoop({
        gateway,
        connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
        messages: [{ role: "user", content: "test" }],
        mcpServerIds: ["example"],
        tools,
        signal: new AbortController().signal,
        context: { runId: "run", workflowId: "workflow", nodeId: "agent" },
        createToolCallId: () => "local-call",
      }),
    ).rejects.toMatchObject({ code: "MODEL_TOOL_NOT_EXPOSED" });
    expect(closeRun).toHaveBeenCalledWith("run");
  });

  it("exposes only the exact MCP Tools selected by a conversation", async () => {
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream({ content: "done", toolCalls: [] })),
    };
    const tools = new ControlledToolService(
      [tool("mcp.example.read_item", vi.fn()), tool("mcp.example.write_item", vi.fn())],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
    );

    await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "read" }],
      toolIds: ["mcp.example.read_item"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "chat" },
      createToolCallId: () => "local-call",
    });

    expect(gateway.streamWithTools).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      [expect.objectContaining({ name: "mcp_0_read_item" })],
      expect.any(AbortSignal),
    );
  });

  it("continues beyond twelve tool rounds until the model returns a final answer", async () => {
    let round = 0;
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => {
        round += 1;
        return toolStream(
          round === 14
            ? { content: "done", toolCalls: [] }
            : {
                content: "",
                toolCalls: [{ id: `call-${round}`, name: "mcp_0_read_item", arguments: {} }],
              },
        );
      }),
    };
    const execute = vi.fn(async () => ({ ok: true }));
    const tools = new ControlledToolService(
      [tool("mcp.example.read_item", execute)],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
    );

    const result = await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "test" }],
      mcpServerIds: ["example"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "workflow", nodeId: "agent" },
      createToolCallId: () => "local-call",
    });

    expect(result.content).toBe("done");
    expect(gateway.streamWithTools).toHaveBeenCalledTimes(14);
    expect(execute).toHaveBeenCalledTimes(13);
  });

  it("executes more than thirty-six tool calls when the model requests them", async () => {
    let round = 0;
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => {
        round += 1;
        return toolStream(
          round === 1
            ? {
                content: "",
                toolCalls: Array.from({ length: 37 }, (_, index) => ({
                  id: `call-${index + 1}`,
                  name: "mcp_0_read_item",
                  arguments: {},
                })),
              }
            : { content: "done", toolCalls: [] },
        );
      }),
    };
    const execute = vi.fn(async () => ({ ok: true }));
    const tools = new ControlledToolService(
      [tool("mcp.example.read_item", execute)],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
    );

    const result = await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "test" }],
      mcpServerIds: ["example"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "workflow", nodeId: "agent" },
      createToolCallId: () => "local-call",
    });

    expect(result.content).toBe("done");
    expect(gateway.streamWithTools).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledTimes(37);
  });

  it("keeps the current round usage after cancel and does not execute later tools", async () => {
    const run = new AbortController();
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(async function* () {
        yield { type: "text" as const, text: "开始" };
        run.abort();
        yield {
          type: "usage" as const,
          usage: { totalTokens: 5067, inputTokens: 4658, outputTokens: 409 },
        };
        yield {
          type: "tool_calls" as const,
          toolCalls: [{ id: "call-1", name: "mcp_0_write_item", arguments: { value: "x" } }],
        };
        yield { type: "completed" as const };
      }),
    };
    const execute = vi.fn(async () => ({ saved: true }));
    const onText = vi.fn();
    const tools = new ControlledToolService(
      [tool("mcp.example.write_item", execute)],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
    );

    const result = await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "write x" }],
      mcpServerIds: ["example"],
      tools,
      signal: run.signal,
      streamSignal: new AbortController().signal,
      context: { runId: "run", workflowId: "workflow", nodeId: "agent" },
      createToolCallId: () => "local-call",
      onText,
    });

    expect(result).toEqual({
      content: "开始",
      usage: { totalTokens: 5067, inputTokens: 4658, outputTokens: 409 },
    });
    expect(onText).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it("coalesces same-round document patches into one persisted operation batch", async () => {
    const turns = [
      {
        content: "",
        toolCalls: [
          {
            id: "call-1",
            name: "mcp_0_patch",
            arguments: {
              documentRef: "doc_1",
              operations: [{ type: "replace_text", search: "错一", replacement: "正一" }],
            },
          },
          {
            id: "call-2",
            name: "mcp_0_patch",
            arguments: {
              documentRef: "doc_1",
              operations: [{ type: "replace_text", search: "错二", replacement: "正二" }],
            },
          },
        ],
      },
      { content: "done", toolCalls: [] },
    ];
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream(turns.shift()!)),
    };
    const execute = vi.fn(async () => ({ revisionCreated: true }));
    const tools = new ControlledToolService(
      [tool("zimo.document.patch", execute)],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-09-15T00:00:00.000Z") },
    );

    await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "修正文档" }],
      toolIds: ["zimo.document.patch"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "agent" },
      createToolCallId: () => "local-call",
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(
      {
        documentRef: "doc_1",
        operations: [
          { type: "replace_text", search: "错一", replacement: "正一" },
          { type: "replace_text", search: "错二", replacement: "正二" },
        ],
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const secondRoundMessages = vi.mocked(gateway.streamWithTools!).mock.calls[1]?.[1];
    expect(secondRoundMessages?.filter((message) => message.role === "tool")).toHaveLength(2);
  });
});

function tool(id: string, execute: RegisteredTool["execute"]): RegisteredTool {
  return {
    definition: {
      id,
      title: id,
      description: id,
      source: "mcp",
      permissions: [{ id: "mcp:test", title: "test", description: "test", risk: "high" }],
      inputSchema: { type: "object" },
      annotations: { readOnly: false, destructive: true, idempotent: false, openWorld: true },
      confirmation: "per_run",
      timeoutMs: 1_000,
    },
    parse: (value) => value,
    execute,
  };
}

async function* toolStream(turn: {
  content: string;
  toolCalls: readonly { id: string; name: string; arguments: Readonly<Record<string, unknown>> }[];
}) {
  if (turn.content) yield { type: "text" as const, text: turn.content };
  yield { type: "tool_calls" as const, toolCalls: turn.toolCalls };
  yield { type: "completed" as const };
}
