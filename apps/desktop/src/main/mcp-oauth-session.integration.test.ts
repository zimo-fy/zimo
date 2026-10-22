import { describe, expect, it, vi } from "vitest";

import { McpOAuthSession } from "./mcp-oauth-session";

describe("McpOAuthSession", () => {
  it("opens the authorization page, validates the loopback callback and resumes", async () => {
    const holder: { session?: McpOAuthSession } = {};
    const session = new McpOAuthSession(undefined, async () => {
      if (!holder.session) throw new Error("OAuth test session unavailable");
      const callback = new URL(String(holder.session.authProvider.redirectUrl));
      callback.searchParams.set("code", "test-code");
      callback.searchParams.set("state", String(await holder.session.authProvider.state?.()));
      await fetch(callback);
    });
    holder.session = session;
    let finishedCode: string | null = null;
    const finishAuth = vi.fn(async (params: URLSearchParams) => {
      finishedCode = params.get("code");
    });
    let attempts = 0;

    await session.connect(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          await session.authProvider.redirectToAuthorization(
            new URL("https://auth.example.com/authorize"),
          );
          throw new Error("authorization required");
        }
      },
      { finishAuth },
      new AbortController().signal,
    );

    expect(attempts).toBe(2);
    expect(finishAuth).toHaveBeenCalledOnce();
    expect(finishedCode).toBe("test-code");
  });

  it("rejects a callback with the wrong state", async () => {
    const holder: { session?: McpOAuthSession } = {};
    const session = new McpOAuthSession(undefined, async () => {
      if (!holder.session) throw new Error("OAuth test session unavailable");
      const callback = new URL(String(holder.session.authProvider.redirectUrl));
      callback.searchParams.set("code", "test-code");
      callback.searchParams.set("state", "wrong-state");
      await fetch(callback);
    });
    holder.session = session;

    await expect(
      session.connect(
        async () => {
          await session.authProvider.redirectToAuthorization(
            new URL("https://auth.example.com/authorize"),
          );
          throw new Error("authorization required");
        },
        { finishAuth: vi.fn(async () => undefined) },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "MCP_OAUTH_FAILED" });
  });
});
