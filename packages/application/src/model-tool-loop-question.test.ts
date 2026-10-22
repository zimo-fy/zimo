import { describe, expect, it, vi } from "vitest";
import type { ModelGateway } from "@zimo/domain";

import { runModelToolLoop } from "./model-tool-loop";
import { ControlledToolService, type RegisteredTool } from "./tool-runtime";

describe("ask_user_question tool loop", () => {
  it("returns the answer in the same run and defers side-effect calls from the same batch", async () => {
    const turns = [
      [
        { id: "write", name: "mcp_0_write", arguments: { text: "early" } },
        {
          id: "ask",
          name: "ask_user_question",
          arguments: {
            questions: [
              {
                id: "choice",
                header: "选择",
                question: "使用哪种方案？",
                options: [{ label: "A" }, { label: "B" }],
              },
            ],
          },
        },
      ],
      [],
    ];
    const gateway: ModelGateway = {
      testConnection: vi.fn(async () => undefined),
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(async function* () {
        yield { type: "tool_calls" as const, toolCalls: turns.shift()! };
        yield { type: "completed" as const };
      }),
    };
    const execute = vi.fn(async () => ({ ok: true }));
    const tool: RegisteredTool = {
      definition: {
        id: "mcp.example.write",
        title: "Write",
        description: "Write",
        source: "mcp",
        permissions: [],
        inputSchema: { type: "object" },
        annotations: { readOnly: false, destructive: false, idempotent: false, openWorld: false },
        confirmation: "per_run",
        timeoutMs: 1_000,
      },
      parse: (value) => value,
      execute,
    };
    const tools = new ControlledToolService(
      [tool],
      { record: vi.fn(async () => undefined) },
      { now: () => new Date() },
    );
    const askUserQuestion = vi.fn(async () => ({ answers: [{ id: "choice", selected: ["A"] }] }));
    await runModelToolLoop({
      gateway,
      connection: { baseUrl: "https://model.example/v1", apiKey: "test", modelName: "test" },
      messages: [{ role: "user", content: "choose" }],
      mcpServerIds: ["example"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run", workflowId: "conversation", nodeId: "agent" },
      createToolCallId: () => "local-call",
      askUserQuestion,
    });
    expect(askUserQuestion).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
    const second = vi.mocked(gateway.streamWithTools!).mock.calls[1]?.[1];
    expect(second).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          toolCallId: "write",
          content: expect.stringContaining("QUESTION_BATCH_DEFERRED"),
        }),
        expect.objectContaining({
          role: "tool",
          toolCallId: "ask",
          content: expect.stringContaining('"selected":["A"]'),
        }),
      ]),
    );
  });
});
