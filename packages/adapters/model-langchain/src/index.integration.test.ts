import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { LangChainOpenAICompatibleGateway } from "./index";

describe("LangChainOpenAICompatibleGateway", () => {
  let server: Server | null = null;

  afterEach(
    () =>
      new Promise<void>((resolve) => {
        if (!server) return resolve();
        server.close(() => resolve());
      }),
  );

  it("maps OpenAI-compatible responses into stable text events", async () => {
    const seenAuthorization: string[] = [];
    const baseUrl = await listen((request, response) => {
      seenAuthorization.push(String(request.headers.authorization));
      let body = "";
      request.on("data", (chunk) => (body += String(chunk)));
      request.on("end", () => {
        const input = JSON.parse(body) as { stream?: boolean };
        if (!input.stream) {
          response.setHeader("content-type", "application/json");
          response.end(
            JSON.stringify({
              id: "chatcmpl-test",
              object: "chat.completion",
              created: 1,
              model: "fake-model",
              choices: [
                { index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          );
          return;
        }
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write(chunk("你"));
        response.write(chunk("好"));
        response.end("data: [DONE]\n\n");
      });
    });
    const gateway = new LangChainOpenAICompatibleGateway();
    const connection = { baseUrl, apiKey: "sk-phase-two-canary", modelName: "fake-model" };

    await gateway.testConnection(connection);
    const events = [];
    for await (const event of gateway.stream(
      connection,
      [{ role: "user", content: "hello" }],
      new AbortController().signal,
    )) {
      events.push(event);
    }

    expect(events.filter((event) => event.type === "text")).toEqual([
      { type: "text", text: "你" },
      { type: "text", text: "好" },
    ]);
    expect(events.at(-1)).toEqual({ type: "completed" });
    expect(seenAuthorization).toEqual(["Bearer sk-phase-two-canary", "Bearer sk-phase-two-canary"]);
  });

  it("maps authentication failures without exposing provider bodies", async () => {
    const baseUrl = await listen((_request, response) => {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "secret response body" } }));
    });

    const gateway = new LangChainOpenAICompatibleGateway();
    await expect(
      gateway.testConnection({ baseUrl, apiKey: "bad-key", modelName: "fake-model" }),
    ).rejects.toMatchObject({
      code: "MODEL_AUTH_FAILED",
      userMessage: "模型服务拒绝了 API Key，请检查后重试。",
    });
  });

  it("reports safe provider failure metadata without exposing response content", async () => {
    const diagnostics: unknown[] = [];
    const baseUrl = await listen((_request, response) => {
      response.writeHead(504, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ error: { message: "secret provider response", token: "secret-token" } }),
      );
    });

    const gateway = new LangChainOpenAICompatibleGateway((diagnostic) => {
      diagnostics.push(diagnostic);
    });
    await expect(
      collect(
        gateway.streamWithTools!(
          { baseUrl, apiKey: "secret-api-key", modelName: "fake-model" },
          [
            { role: "user", content: "secret user text" },
            {
              role: "assistant",
              content: "",
              toolCalls: [{ id: "call-1", name: "mcp_0_inspect", arguments: {} }],
            },
            {
              role: "tool",
              content: "secret tool output",
              toolCallId: "call-1",
              name: "mcp_0_inspect",
            },
          ],
          [],
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ code: "MODEL_PROVIDER_ERROR", safeDetails: { status: 504 } });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        operation: "tool_followup",
        status: 504,
        errorName: expect.any(String),
        durationMs: expect.any(Number),
        requestMessageCount: 3,
        requestToolCount: 0,
        requestToolResultCharacters: "secret tool output".length,
      }),
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("secret");
  });

  it("returns parsed structured intent classification", async () => {
    const targetId = "00000000-0000-4000-8000-000000000101";
    const baseUrl = await listen((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          id: "chatcmpl-router",
          object: "chat.completion",
          created: 1,
          model: "fake-model",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  intent: "agent",
                  targetId,
                  confidence: 0.91,
                  parameters: {},
                  shouldExecute: false,
                }),
              },
              finish_reason: "stop",
            },
          ],
        }),
      );
    });
    const gateway = new LangChainOpenAICompatibleGateway();
    await expect(
      gateway.classify(
        { baseUrl, apiKey: "router-key", modelName: "fake-model" },
        {
          text: "help me research",
          targets: [
            { id: targetId, type: "agent", name: "Research", description: "", enabled: true },
          ],
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      value: { intent: "agent", targetId, shouldExecute: false },
    });
  });

  it("sends tool definitions and maps an OpenAI tool call", async () => {
    let received: unknown;
    const baseUrl = await listen((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += String(chunk)));
      request.on("end", () => {
        received = JSON.parse(body) as unknown;
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write(toolChunk({ role: "assistant", content: "我来查询。" }, null));
        response.write(
          toolChunk(
            {
              tool_calls: [
                {
                  index: 0,
                  id: "call-1",
                  type: "function",
                  function: { name: "mcp_0_search", arguments: '{"query":' },
                },
              ],
            },
            null,
          ),
        );
        response.write(
          toolChunk(
            {
              tool_calls: [{ index: 0, function: { name: null, arguments: '"mcp"}' } }],
            },
            null,
          ),
        );
        response.write(toolChunk({}, "tool_calls"));
        response.end("data: [DONE]\n\n");
      });
    });
    const gateway = new LangChainOpenAICompatibleGateway();
    const events = await collect(
      gateway.streamWithTools!(
        { baseUrl, apiKey: "tool-key", modelName: "fake-model" },
        [{ role: "user", content: "find mcp" }],
        [
          {
            name: "mcp_0_search",
            description: "Search repositories",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
            },
          },
        ],
        new AbortController().signal,
      ),
    );

    expect(events).toContainEqual({ type: "text", text: "我来查询。" });
    expect(events).toContainEqual({
      type: "tool_calls",
      toolCalls: [{ id: "call-1", name: "mcp_0_search", arguments: { query: "mcp" } }],
    });
    expect(events.at(-1)).toEqual({ type: "completed" });
    expect(received).toMatchObject({
      tools: [{ type: "function", function: { name: "mcp_0_search" } }],
    });
  });

  it("forwards OpenAI multimodal image_url content to the provider", async () => {
    let body = "";
    const baseUrl = await listen((request, response) => {
      request.on("data", (chunk) => (body += String(chunk)));
      request.on("end", () => {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write(chunk("图"));
        response.end("data: [DONE]\n\n");
      });
    });
    const gateway = new LangChainOpenAICompatibleGateway();
    const events = [];
    for await (const event of gateway.stream(
      { baseUrl, apiKey: "sk-vision", modelName: "fake-vision" },
      [
        {
          role: "user",
          content: [
            { type: "text", text: "这张图片里有什么？" },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
          ],
        },
      ],
      new AbortController().signal,
    )) {
      events.push(event);
    }

    expect(events.filter((event) => event.type === "text")).toEqual([{ type: "text", text: "图" }]);
    expect(JSON.parse(body).messages[0].content).toEqual([
      { type: "text", text: "这张图片里有什么？" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
    ]);
  });

  async function listen(
    handler: (request: IncomingMessage, response: ServerResponse) => void,
  ): Promise<string> {
    server = createServer(handler);
    await new Promise<void>((resolve, reject) => {
      const current = server;
      if (!current) return reject(new Error("Fake server is unavailable"));
      const onError = (error: Error) => reject(error);
      current.once("error", onError);
      current.listen(0, "127.0.0.1", () => {
        current.off("error", onError);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fake server did not start");
    return `http://127.0.0.1:${address.port}/v1`;
  }
});

function chunk(text: string): string {
  return `data: ${JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 1,
    model: "fake-model",
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
  })}\n\n`;
}

function toolChunk(
  delta: Readonly<Record<string, unknown>>,
  finishReason: "tool_calls" | null,
): string {
  return `data: ${JSON.stringify({
    id: "chatcmpl-tool",
    object: "chat.completion.chunk",
    created: 1,
    model: "fake-model",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of stream) values.push(value);
  return values;
}
