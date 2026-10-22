import { describe, expect, it, vi } from "vitest";

import { DesktopWebSearchGateway } from "./desktop-web-search-gateway";

const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];

describe("DesktopWebSearchGateway", () => {
  it("normalizes Brave search results", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        web: {
          results: [
            {
              title: "Shenzhen Metro",
              url: "https://www.szmc.net/page",
              description: "Official station facilities",
              page_age: "1 day ago",
            },
          ],
        },
      }),
    );
    const gateway = new DesktopWebSearchGateway(fetcher, publicDns);

    const results = await gateway.search(
      {
        provider: "brave",
        apiKey: "test-key",
        query: "深圳地铁厕所",
        count: 5,
        freshness: "week",
      },
      new AbortController().signal,
    );

    expect(results).toEqual([
      {
        title: "Shenzhen Metro",
        url: "https://www.szmc.net/page",
        snippet: "Official station facilities",
        source: "szmc.net",
        publishedAt: "1 day ago",
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/api\.search\.brave\.com.*freshness=pw/),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("extracts the main article text from HTML", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          "<html><head><title>设施</title></head><body><article><h1>地铁设施</h1><p>五号线车站设有卫生间。</p></article></body></html>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        ),
    );
    const gateway = new DesktopWebSearchGateway(fetcher, publicDns);

    const result = await gateway.fetch(
      { url: "https://example.com/facilities", maxCharacters: 20_000 },
      new AbortController().signal,
    );

    expect(result.content).toContain("五号线车站设有卫生间");
  });

  it("rejects private addresses before sending a request", async () => {
    const fetcher = vi.fn(async () => new Response("should not run"));
    const gateway = new DesktopWebSearchGateway(fetcher, async () => [
      { address: "127.0.0.1", family: 4 },
    ]);

    await expect(
      gateway.fetch(
        { url: "https://internal.example/data", maxCharacters: 20_000 },
        new AbortController().signal,
      ),
    ).rejects.toThrow("私有网络");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("revalidates redirect targets and blocks metadata endpoints", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        }),
    );
    const gateway = new DesktopWebSearchGateway(fetcher, publicDns);

    await expect(
      gateway.fetch(
        { url: "https://example.com/redirect", maxCharacters: 20_000 },
        new AbortController().signal,
      ),
    ).rejects.toThrow("私有网络");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
