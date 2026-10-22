import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { WeixinMessagingGateway, WeixinUpdatesResult } from "@zimo/domain";
import { AppError } from "@zimo/domain";
import { z } from "zod";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_TEXT_CHARACTERS = 8_000;

const responseStatusSchema = z
  .object({
    ret: z.number().int().optional(),
    errcode: z.number().int().optional(),
    errmsg: z.string().max(500).optional(),
  })
  .passthrough();
const messageItemSchema = z
  .object({
    type: z.number().int(),
    text_item: z
      .object({ text: z.string().max(MAX_TEXT_CHARACTERS) })
      .passthrough()
      .optional(),
  })
  .passthrough();
const inboundMessageSchema = z
  .object({
    message_id: z.union([z.string().max(200), z.number().int()]).optional(),
    client_id: z.string().max(200).optional(),
    seq: z.union([z.string().max(200), z.number().int()]).optional(),
    from_user_id: z.string().min(1).max(300).optional(),
    context_token: z.string().min(1).max(8_192).optional(),
    message_type: z.number().int().optional(),
    message_state: z.number().int().optional(),
    item_list: z.array(messageItemSchema).max(20).default([]),
  })
  .passthrough();
const updatesResponseSchema = z
  .object({
    get_updates_buf: z.string().max(200_000).default(""),
    msgs: z.array(inboundMessageSchema).max(100).default([]),
    ret: z.number().int().optional(),
    errcode: z.number().int().optional(),
    errmsg: z.string().max(500).optional(),
  })
  .passthrough();
const sendResponseSchema = responseStatusSchema.extend({ message_id: z.string().optional() });

export class TencentWeixinMessagingGateway implements WeixinMessagingGateway {
  async notifyStart(baseUrl: string, botToken: string, signal: AbortSignal): Promise<void> {
    await postAck(baseUrl, "/ilink/bot/msg/notifystart", botToken, signal);
  }

  async getUpdates(
    baseUrl: string,
    botToken: string,
    cursor: string,
    signal: AbortSignal,
  ): Promise<WeixinUpdatesResult> {
    const raw = await post(
      baseUrl,
      "/ilink/bot/getupdates",
      botToken,
      { get_updates_buf: cursor, base_info: baseInfo() },
      signal,
    );
    const parsed = updatesResponseSchema.safeParse(raw);
    if (!parsed.success) throw protocolError("微信消息服务返回了无效数据。");
    assertBusinessSuccess(parsed.data);
    return {
      nextCursor: parsed.data.get_updates_buf || cursor,
      messages: parsed.data.msgs.flatMap((message) => {
        if (
          message.message_type !== 1 ||
          !message.from_user_id ||
          !message.context_token ||
          (message.message_state && message.message_state !== 2)
        ) {
          return [];
        }
        const text = message.item_list
          .filter((item) => item.type === 1 && item.text_item?.text)
          .map((item) => item.text_item!.text)
          .join("\n")
          .trim();
        if (!text || text.length > MAX_TEXT_CHARACTERS) return [];
        return [
          {
            dedupeKey: dedupeKey(message),
            peerUserId: message.from_user_id,
            contextToken: message.context_token,
            text,
          },
        ];
      }),
    };
  }

  async sendText(
    baseUrl: string,
    botToken: string,
    input: Readonly<{ recipientUserId: string; contextToken: string; text: string }>,
    signal: AbortSignal,
  ): Promise<void> {
    const raw = await post(
      baseUrl,
      "/ilink/bot/sendmessage",
      botToken,
      {
        msg: {
          to_user_id: input.recipientUserId,
          from_user_id: "",
          client_id: randomUUID(),
          message_type: 2,
          message_state: 2,
          item_list: [{ type: 1, text_item: { text: input.text.slice(0, MAX_TEXT_CHARACTERS) } }],
          context_token: input.contextToken,
        },
        base_info: baseInfo(),
      },
      signal,
    );
    const parsed = sendResponseSchema.safeParse(raw);
    if (!parsed.success) throw protocolError("微信消息服务返回了无效数据。");
    assertBusinessSuccess(parsed.data);
  }

  async notifyStop(baseUrl: string, botToken: string, signal: AbortSignal): Promise<void> {
    await postAck(baseUrl, "/ilink/bot/msg/notifystop", botToken, signal);
  }
}

async function postAck(
  baseUrl: string,
  path: string,
  botToken: string,
  signal: AbortSignal,
): Promise<void> {
  const raw = await post(baseUrl, path, botToken, { base_info: baseInfo() }, signal);
  const parsed = sendResponseSchema.safeParse(raw);
  if (!parsed.success) throw protocolError("微信消息服务返回了无效数据。");
  assertBusinessSuccess(parsed.data);
}

async function post(
  rawBaseUrl: string,
  path: string,
  botToken: string,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  const baseUrl = trustedBaseUrl(rawBaseUrl);
  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    redirect: "error",
    headers: { ...headers(), Authorization: `Bearer ${botToken}` },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 401 || response.status === 403) {
    throw new AppError({
      code: "WEIXIN_REAUTHENTICATION_REQUIRED",
      category: "user",
      userMessage: "微信登录已失效，请重新扫码绑定。",
    });
  }
  if (!response.ok) throw protocolError("微信消息服务暂时不可用，请稍后重试。");
  const text = await readBoundedText(response);
  try {
    return parseProtocolJson(text);
  } catch (error) {
    throw protocolError("微信消息服务返回了无效响应。", error);
  }
}

async function readBoundedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw protocolError("微信消息服务响应过大。");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw protocolError("微信消息服务响应过大。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseProtocolJson(text: string): unknown {
  return JSON.parse(quoteLosslessMessageIds(text)) as unknown;
}

function quoteLosslessMessageIds(text: string): string {
  const keys = new Set(["message_id", "msg_id", "svr_id"]);
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] !== '"') {
      output += text[index];
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') break;
    }
    const token = text.slice(start, index);
    output += token;
    let cursor = index;
    while (/\s/.test(text[cursor] ?? "")) cursor += 1;
    if (text[cursor] !== ":") continue;
    let key: unknown;
    try {
      key = JSON.parse(token) as unknown;
    } catch {
      continue;
    }
    if (typeof key !== "string" || !keys.has(key)) continue;
    output += text.slice(index, cursor + 1);
    cursor += 1;
    while (/\s/.test(text[cursor] ?? "")) {
      output += text[cursor];
      cursor += 1;
    }
    const numberStart = cursor;
    if (text[cursor] === "-") cursor += 1;
    while (/\d/.test(text[cursor] ?? "")) cursor += 1;
    if (cursor > numberStart && text.slice(numberStart, cursor) !== "-") {
      output += `"${text.slice(numberStart, cursor)}"`;
      index = cursor;
    } else {
      index = numberStart;
    }
  }
  return output;
}

function trustedBaseUrl(value: string): URL {
  const url = new URL(value);
  const allowed =
    url.protocol === "https:" &&
    (url.hostname === "ilinkai.weixin.qq.com" || url.hostname.endsWith(".weixin.qq.com"));
  if (!allowed || url.username || url.password || url.port) {
    throw protocolError("微信消息服务地址不受信任。");
  }
  return url;
}

function headers(): Record<string, string> {
  return {
    "content-type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": Buffer.from(String(randomBytes(4).readUInt32BE(0))).toString("base64"),
    "iLink-App-Id": "bot",
    "iLink-App-ClientVersion": "132104",
  };
}

function baseInfo() {
  return { channel_version: "2.4.8" };
}

function assertBusinessSuccess(value: z.infer<typeof responseStatusSchema>): void {
  const code = value.errcode ?? value.ret ?? 0;
  if (code === -14) {
    throw new AppError({
      code: "WEIXIN_REAUTHENTICATION_REQUIRED",
      category: "user",
      userMessage: "微信登录已失效，请重新扫码绑定。",
    });
  }
  if (code === -2) {
    throw new AppError({
      code: "WEIXIN_ACTIVATION_REQUIRED",
      category: "user",
      userMessage: "微信会话上下文已过期，请先从微信再发送一条消息。",
    });
  }
  if (code !== 0) throw protocolError("微信消息服务拒绝了本次操作。");
}

function dedupeKey(message: z.infer<typeof inboundMessageSchema>): string {
  const stable = message.message_id ?? message.client_id ?? message.seq;
  if (stable !== undefined) return String(stable).slice(0, 200);
  return createHash("sha256")
    .update(
      `${message.from_user_id}\u0000${message.context_token}\u0000${message.item_list.length}`,
    )
    .digest("hex");
}

function protocolError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: "WEIXIN_MESSAGING_FAILED",
    category: "network",
    userMessage: message,
    retryable: true,
    cause,
  });
}
