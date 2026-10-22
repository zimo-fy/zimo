import { AppError, type ModelGateway } from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import { createBrowserTools } from "./browser-tools";
import { runModelToolLoop } from "./model-tool-loop";
import { ControlledToolService, type RegisteredTool } from "./tool-runtime";

describe("browser target recovery", () => {
  it("returns an unknown target to the model so it can list tabs and retry", async () => {
    const turns = [
      {
        toolCalls: [
          { id: "snapshot-1", name: "browser_snapshot", arguments: { targetId: "invented" } },
        ],
      },
      { toolCalls: [{ id: "tabs-1", name: "browser_tabs", arguments: {} }] },
      {
        toolCalls: [
          { id: "snapshot-2", name: "browser_snapshot", arguments: { targetId: "real" } },
        ],
      },
      { content: "已确认页面", toolCalls: [] },
    ];
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream(turns.shift()!)),
    };
    const snapshot = vi.fn(async (value: Readonly<Record<string, unknown>>) => {
      if (value.targetId === "invented") {
        throw new AppError({
          code: "BROWSER_TARGET_NOT_FOUND",
          category: "user",
          userMessage: "指定的浏览器标签页不存在。",
        });
      }
      return { targetId: "real", content: "已加载页面" };
    });
    const tabs = vi.fn(async () => [{ id: "real", url: "https://example.com/" }]);
    const tools = new ControlledToolService(
      [tool("zimo.browser.snapshot", snapshot), tool("zimo.browser.tabs", tabs)],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-10-09T00:00:00.000Z") },
    );

    const result = await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "查看页面" }],
      toolIds: ["zimo.browser.snapshot", "zimo.browser.tabs"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "agent" },
      createToolCallId: () => "local-call",
    });

    expect(result.content).toBe("已确认页面");
    expect(tabs).toHaveBeenCalledOnce();
    expect(snapshot).toHaveBeenCalledTimes(2);
    const retryMessages = vi.mocked(gateway.streamWithTools!).mock.calls[1]?.[1];
    expect(retryMessages?.find((message) => message.role === "tool")?.content).toContain(
      "BROWSER_TARGET_NOT_FOUND",
    );
  });

  it("returns an invalid ref to the model for a bounded fresh-snapshot retry", async () => {
    const turns = [
      {
        toolCalls: [
          {
            id: "type-1",
            name: "browser_type",
            arguments: {
              targetId: "real",
              snapshotId: "current",
              ref: "[contenteditable]",
              text: "",
            },
          },
        ],
      },
      {
        toolCalls: [
          { id: "snapshot-1", name: "browser_snapshot", arguments: { targetId: "real" } },
        ],
      },
      { content: "已重新定位输入框", toolCalls: [] },
    ];
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream(turns.shift()!)),
    };
    const type = vi.fn(async () => {
      throw new AppError({
        code: "BROWSER_REF_NOT_FOUND",
        category: "user",
        userMessage: "最新网页结构中没有该元素。",
      });
    });
    const snapshot = vi.fn(async () => ({ snapshotId: "fresh", content: "[ref_1] textbox" }));
    const tools = new ControlledToolService(
      [tool("zimo.browser.type", type), tool("zimo.browser.snapshot", snapshot)],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-10-09T00:00:00.000Z") },
    );

    const result = await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "回复消息" }],
      toolIds: ["zimo.browser.type", "zimo.browser.snapshot"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "agent" },
      createToolCallId: () => "local-call",
    });

    expect(result.content).toBe("已重新定位输入框");
    expect(snapshot).toHaveBeenCalledOnce();
    expect(
      vi.mocked(gateway.streamWithTools!).mock.calls[1]?.[1].find((m) => m.role === "tool")
        ?.content,
    ).toContain("BROWSER_REF_NOT_FOUND");
  });

  it("lets the model correct a missing Enter target without pressing or typing twice", async () => {
    const turns = [
      {
        toolCalls: [
          { id: "press-1", name: "browser_press", arguments: { targetId: "real", key: "Enter" } },
        ],
      },
      {
        toolCalls: [
          { id: "snapshot-1", name: "browser_snapshot", arguments: { targetId: "real" } },
        ],
      },
      {
        toolCalls: [
          {
            id: "press-2",
            name: "browser_press",
            arguments: { targetId: "real", snapshotId: "fresh", ref: "ref_1", key: "Enter" },
          },
        ],
      },
      { content: "已执行按键", toolCalls: [] },
    ];
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream(turns.shift()!)),
    };
    const press = vi.fn(async () => undefined);
    const snapshot = vi.fn(async () => ({
      targetId: "real",
      snapshotId: "fresh",
      title: "Chat",
      url: "https://example.com/chat",
      content: "[ref_1] textbox",
      elementCount: 1,
      truncated: false,
    }));
    const browser = {
      listTabs: vi.fn(async () => []),
      open: vi.fn(async (url: string) => ({ id: "new-target", title: "", url, active: true })),
      focus: vi.fn(async () => undefined),
      snapshot,
      screenshot: vi.fn(async () => ({
        targetId: "real",
        fileName: "capture.png",
        mediaType: "image/png" as const,
      })),
      navigate: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      type: vi.fn(async () => undefined),
      press,
      scroll: vi.fn(async () => undefined),
      wait: vi.fn(async () => snapshot()),
      close: vi.fn(async () => undefined),
    };
    const tools = new ControlledToolService(
      createBrowserTools(browser),
      {
        record: vi.fn(async () => undefined),
      },
      { now: () => new Date("2026-10-10T00:00:00.000Z") },
    );

    const result = await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "回复消息" }],
      toolIds: ["zimo.browser.press", "zimo.browser.snapshot"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "agent" },
      createToolCallId: () => "local-call",
    });

    expect(result.content).toBe("已执行按键");
    expect(press).toHaveBeenCalledTimes(1);
    expect(press).toHaveBeenCalledWith("real", "fresh", "ref_1", "Enter", expect.any(AbortSignal));
    expect(snapshot).toHaveBeenCalledOnce();
    expect(
      vi.mocked(gateway.streamWithTools!).mock.calls[1]?.[1].find((m) => m.role === "tool")
        ?.content,
    ).toContain("TOOL_ARGUMENTS_INVALID");
  });

  it("stops after a second incomplete Enter call", async () => {
    const invalidPress = { targetId: "real", key: "Enter" };
    const turns = [
      { toolCalls: [{ id: "press-1", name: "browser_press", arguments: invalidPress }] },
      { toolCalls: [{ id: "press-2", name: "browser_press", arguments: invalidPress }] },
    ];
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(() => toolStream(turns.shift()!)),
    };
    const press = vi.fn(async () => undefined);
    const pressTool: RegisteredTool = {
      ...tool("zimo.browser.press", press),
      parse: (value) => {
        if (!value.snapshotId || !value.ref) throw new Error("target required");
        return value;
      },
    };
    const tools = new ControlledToolService(
      [pressTool],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date("2026-10-10T00:00:00.000Z") },
    );

    await expect(
      runModelToolLoop({
        gateway,
        connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
        messages: [{ role: "user", content: "回复消息" }],
        toolIds: ["zimo.browser.press"],
        tools,
        signal: new AbortController().signal,
        context: { runId: "run", workflowId: "conversation", nodeId: "agent" },
        createToolCallId: () => "local-call",
      }),
    ).rejects.toMatchObject({ code: "TOOL_ARGUMENTS_INVALID" });
    expect(press).not.toHaveBeenCalled();
  });
});

function tool(id: string, execute: RegisteredTool["execute"]): RegisteredTool {
  return {
    definition: {
      id,
      title: id,
      description: id,
      source: "builtin",
      permissions: [
        { id: "browser:observe", title: "observe", description: "observe", risk: "low" },
      ],
      inputSchema: { type: "object" },
      annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
      confirmation: "per_run",
      timeoutMs: 1_000,
    },
    parse: (value) => value,
    execute,
  };
}

async function* toolStream(turn: {
  content?: string;
  toolCalls: readonly { id: string; name: string; arguments: Readonly<Record<string, unknown>> }[];
}) {
  if (turn.content) yield { type: "text" as const, text: turn.content };
  yield { type: "tool_calls" as const, toolCalls: turn.toolCalls };
  yield { type: "completed" as const };
}
