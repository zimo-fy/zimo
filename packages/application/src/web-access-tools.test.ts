import { describe, expect, it, vi } from "vitest";
import {
  AppError,
  type AuthSession,
  type ModelGateway,
  type ModelGatewayToolMessage,
  type ModelNativeSearchGateway,
  type WebSearchConfigurationRepository,
  type WebSearchGateway,
} from "@zimo/domain";

import { runModelToolLoop } from "./model-tool-loop";
import { ControlledToolService } from "./tool-runtime";
import { WebAccessService } from "./web-access-service";
import { createWebAccessTools } from "./web-access-tools";

describe("web access tools", () => {
  it("lets the model fetch a known page after native search is unsupported", async () => {
    const webGateway: WebSearchGateway = {
      search: vi.fn(async () => []),
      fetch: vi.fn(async ({ url }) => ({ url, content: "已核实的公开网页正文" })),
    };
    const web = createNativeWebService(webGateway, async () => {
      throw new AppError({
        code: "MODEL_NATIVE_SEARCH_UNSUPPORTED",
        category: "network",
        userMessage: "当前模型未执行原生联网搜索，不能仅凭文本回答判定为支持。",
      });
    });
    const turns = [
      {
        content: "",
        toolCalls: [{ id: "search-1", name: "web_search", arguments: { query: "资料" } }],
      },
      {
        content: "",
        toolCalls: [
          {
            id: "fetch-1",
            name: "web_fetch",
            arguments: { url: "https://example.org/known-page" },
          },
        ],
      },
      { content: "根据已读取的页面回答", toolCalls: [] },
    ];
    const requests: ModelGatewayToolMessage[][] = [];
    const model: ModelGateway = {
      testConnection: async () => undefined,
      async *stream() {
        yield { type: "completed" as const };
      },
      async *streamWithTools(_connection, messages) {
        requests.push([...messages]);
        const turn = turns.shift();
        if (!turn) throw new Error("Unexpected model round");
        yield { type: "text" as const, text: turn.content };
        yield { type: "tool_calls" as const, toolCalls: turn.toolCalls };
        yield { type: "completed" as const };
      },
    };
    const tools = new ControlledToolService(
      createWebAccessTools(web),
      { record: async () => undefined },
      { now: () => new Date("2026-09-22T00:00:00.000Z") },
    );

    const result = await runModelToolLoop({
      gateway: model,
      connection: { baseUrl: "https://model.example/v1", apiKey: "fake-key", modelName: "test" },
      messages: [{ role: "user", content: "请查阅资料" }],
      toolIds: ["zimo.web.search", "zimo.web.fetch"],
      tools,
      signal: new AbortController().signal,
      context: { runId: "run-1", workflowId: "conversation-1", nodeId: "agent" },
      createToolCallId: () => "tool-call",
    });

    expect(result.content).toBe("根据已读取的页面回答");
    expect(requests).toHaveLength(3);
    expect(requests[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          name: "web_search",
          content: expect.stringContaining('"status":"unavailable"'),
        }),
      ]),
    );
    expect(requests[2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          name: "web_fetch",
          content: expect.stringContaining("已核实的公开网页正文"),
        }),
      ]),
    );
    expect(webGateway.fetch).toHaveBeenCalledWith(
      { url: "https://example.org/known-page", maxCharacters: 20_000 },
      expect.any(AbortSignal),
    );
  });

  it("still fails for native search transport errors", async () => {
    const web = createNativeWebService(
      {
        search: async () => [],
        fetch: async ({ url }) => ({ url, content: "content" }),
      },
      async () => {
        throw new AppError({
          code: "MODEL_NATIVE_SEARCH_FAILED",
          category: "network",
          userMessage: "当前模型的原生联网请求失败。",
        });
      },
    );
    const search = createWebAccessTools(web)[0]!;
    await expect(
      search.execute(search.parse({ query: "资料" }), {
        runId: "run-1",
        workflowId: "conversation-1",
        nodeId: "agent",
        toolCallId: "tool-call",
        signal: new AbortController().signal,
        modelConnection: {
          baseUrl: "https://model.example/v1",
          apiKey: "fake-key",
          modelName: "test",
        },
      }),
    ).rejects.toMatchObject({ code: "MODEL_NATIVE_SEARCH_FAILED" });
  });
});

function createNativeWebService(
  gateway: WebSearchGateway,
  nativeSearch: ModelNativeSearchGateway["search"],
): WebAccessService {
  return new WebAccessService(
    {
      get: async () => ({
        ownerUserId: "owner-1",
        provider: "model_native",
        updatedAt: new Date("2026-09-22T00:00:00.000Z"),
      }),
      save: async () => undefined,
      delete: async () => undefined,
    } satisfies WebSearchConfigurationRepository,
    { get: async () => ({ externalUserId: "owner-1" }) as AuthSession } as never,
    { get: async () => null } as never,
    gateway,
    { now: () => new Date("2026-09-22T00:00:00.000Z") },
    { create: () => "unused" },
    { search: nativeSearch },
  );
}
