import { afterEach, describe, expect, it, vi } from "vitest";

import { TencentWeixinMessagingGateway } from "./weixin-messaging-gateway";

describe("TencentWeixinMessagingGateway", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("validates inbound text and sends replies with the supplied context token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            get_updates_buf: "cursor-next",
            msgs: [
              {
                message_id: "message-1",
                from_user_id: "peer-1",
                context_token: "context-1",
                message_type: 1,
                item_list: [{ type: 1, text_item: { text: "你好" } }],
              },
            ],
            ret: 0,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ret: 0, message_id: "server-message-1" }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new TencentWeixinMessagingGateway();

    await expect(
      gateway.getUpdates(
        "https://ilinkai.weixin.qq.com",
        "bot-token",
        "cursor-old",
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      nextCursor: "cursor-next",
      messages: [
        {
          dedupeKey: "message-1",
          peerUserId: "peer-1",
          contextToken: "context-1",
          text: "你好",
        },
      ],
    });
    await gateway.sendText(
      "https://ilinkai.weixin.qq.com",
      "bot-token",
      { recipientUserId: "peer-1", contextToken: "context-1", text: "回复" },
      new AbortController().signal,
    );

    const request = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(request[0].pathname).toBe("/ilink/bot/sendmessage");
    expect(request[1].headers).toMatchObject({ Authorization: "Bearer bot-token" });
    expect(JSON.parse(String(request[1].body))).toMatchObject({
      msg: {
        to_user_id: "peer-1",
        context_token: "context-1",
        item_list: [{ type: 1, text_item: { text: "回复" } }],
      },
    });
  });

  it("rejects untrusted service hosts before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new TencentWeixinMessagingGateway();

    await expect(
      gateway.getUpdates(
        "https://weixin.qq.com.attacker.example",
        "bot-token",
        "",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "WEIXIN_MESSAGING_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an expired context response to activation required", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ret: -2 }), { status: 200 })),
    );
    const gateway = new TencentWeixinMessagingGateway();

    await expect(
      gateway.sendText(
        "https://ilinkai.weixin.qq.com",
        "bot-token",
        { recipientUserId: "peer-1", contextToken: "expired", text: "测试" },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "WEIXIN_ACTIVATION_REQUIRED" });
  });

  it("preserves uint64 message IDs without rewriting text content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            `{"ret":0,"get_updates_buf":"next","msgs":[{"message_id":9223372036854775807,"from_user_id":"peer","context_token":"context","message_type":1,"item_list":[{"type":1,"text_item":{"text":"保留 \\"message_id\\":123"}}]}]}`,
            { status: 200 },
          ),
      ),
    );
    const gateway = new TencentWeixinMessagingGateway();

    const result = await gateway.getUpdates(
      "https://ilinkai.weixin.qq.com",
      "bot-token",
      "",
      new AbortController().signal,
    );

    expect(result.messages[0]).toMatchObject({
      dedupeKey: "9223372036854775807",
      text: '保留 "message_id":123',
    });
  });
});
