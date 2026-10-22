import { afterEach, describe, expect, it, vi } from "vitest";

import { TencentWeixinBindingGateway } from "./weixin-binding-gateway";

describe("TencentWeixinBindingGateway", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the fixed Tencent endpoint and maps a confirmed login", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ qrcode: "qr-secret", qrcode_img_content: "https://example.invalid/qr" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "confirmed",
            bot_token: "bot-secret",
            ilink_bot_id: "bot-1",
            ilink_user_id: "user-1",
            baseurl: "https://ilinkai.weixin.qq.com",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new TencentWeixinBindingGateway();

    const started = await gateway.start(new AbortController().signal);
    expect(started.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
    expect(started.expiresAt.getTime()).toBeGreaterThan(Date.now() + 290_000);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe(
      "https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3",
    );
    expect(firstCall?.[1]?.headers).toMatchObject({
      AuthorizationType: "ilink_bot_token",
      "iLink-App-Id": "bot",
    });

    await expect(
      gateway.poll(started.sessionId, undefined, new AbortController().signal),
    ).resolves.toEqual({
      status: "confirmed",
      accountId: "bot-1",
      userId: "user-1",
      baseUrl: "https://ilinkai.weixin.qq.com",
      botToken: "bot-secret",
    });
  });

  it("aborts an active long poll when the login is cancelled", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ qrcode: "qr-secret", qrcode_img_content: "https://example.invalid/qr" }),
          { status: 200 },
        ),
      )
      .mockImplementationOnce(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new TencentWeixinBindingGateway();
    const started = await gateway.start(new AbortController().signal);
    const poll = gateway.poll(started.sessionId, undefined, new AbortController().signal);

    gateway.cancel(started.sessionId);

    await expect(poll).rejects.toMatchObject({ name: "AbortError" });
  });
});
