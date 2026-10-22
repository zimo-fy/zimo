import { describe, expect, it, vi } from "vitest";

import { DesktopModelNativeSearchGateway } from "./model-native-search-gateway";

const connection = {
  baseUrl: "https://gateway.example/v1",
  modelName: "test-model",
  apiKey: "secret-canary",
};

describe("DesktopModelNativeSearchGateway", () => {
  it("uses the configured messages endpoint and extracts only cited sources", async () => {
    const fetcher = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            content: [
              { type: "server_tool_use", name: "web_search" },
              {
                type: "web_search_tool_result",
                content: [
                  {
                    type: "web_search_result",
                    title: "Official",
                    url: "https://example.org/line5",
                  },
                  { type: "web_search_result", title: "Private", url: "file:///etc/passwd" },
                  { type: "web_search_result", title: "Local", url: "http://127.0.0.1/private" },
                ],
              },
              {
                type: "web_search_tool_result",
                content: [{ type: "web_search_tool_result_error", error_code: "unavailable" }],
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const gateway = new DesktopModelNativeSearchGateway(fetcher);
    const output = await gateway.search(
      connection,
      { query: "line 5", count: 3 },
      new AbortController().signal,
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://gateway.example/v1/messages",
      expect.objectContaining({ method: "POST", redirect: "manual" }),
    );
    const init = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "test-model",
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      tool_choice: { type: "any" },
    });
    expect(output).toEqual({
      results: [
        {
          title: "Official",
          url: "https://example.org/line5",
          snippet: "原生搜索未提供摘要；请使用 web_fetch 核实来源。",
          source: "example.org",
        },
      ],
      errorCount: 1,
    });
  });

  it("does not treat a plain text answer as a successful search", async () => {
    const gateway = new DesktopModelNativeSearchGateway(
      async () =>
        new Response(JSON.stringify({ content: [{ type: "text", text: "I searched the web" }] })),
    );
    await expect(
      gateway.search(connection, { query: "query", count: 1 }, new AbortController().signal),
    ).rejects.toMatchObject({ code: "MODEL_NATIVE_SEARCH_UNSUPPORTED" });
  });

  it("reports a search failure when the gateway returns only array-wrapped tool errors", async () => {
    const gateway = new DesktopModelNativeSearchGateway(
      async () =>
        new Response(
          JSON.stringify({
            content: [
              { type: "server_tool_use", name: "web_search" },
              {
                type: "web_search_tool_result",
                content: [{ type: "web_search_tool_result_error", error_code: "unavailable" }],
              },
            ],
          }),
        ),
    );
    await expect(
      gateway.search(connection, { query: "query", count: 1 }, new AbortController().signal),
    ).rejects.toMatchObject({ code: "MODEL_NATIVE_SEARCH_FAILED" });
  });

  it("rejects redirects so the bearer key cannot be forwarded", async () => {
    const gateway = new DesktopModelNativeSearchGateway(
      async () =>
        new Response(null, { status: 302, headers: { location: "https://elsewhere.example/" } }),
    );
    await expect(
      gateway.search(connection, { query: "query", count: 1 }, new AbortController().signal),
    ).rejects.toMatchObject({ code: "MODEL_NATIVE_SEARCH_FAILED" });
  });
});
