import { randomBytes, randomUUID } from "node:crypto";

import type { WeixinBindingGateway, WeixinLoginStart, WeixinLoginStatus } from "@zimo/domain";
import { AppError } from "@zimo/domain";
import QRCode from "qrcode";

const API_BASE = "https://ilinkai.weixin.qq.com";
const LOGIN_TTL_MS = 5 * 60_000;

interface LoginSession {
  qrCode: string;
  expiresAt: Date;
  baseUrl: string;
  activePoll?: AbortController | undefined;
}

interface QrResponse {
  qrcode?: unknown;
  qrcode_img_content?: unknown;
}

interface StatusResponse {
  status?: unknown;
  bot_token?: unknown;
  ilink_bot_id?: unknown;
  ilink_user_id?: unknown;
  baseurl?: unknown;
  redirect_host?: unknown;
}

export class TencentWeixinBindingGateway implements WeixinBindingGateway {
  private readonly sessions = new Map<string, LoginSession>();

  async start(signal: AbortSignal): Promise<WeixinLoginStart> {
    this.purgeExpired();
    const response = await fetch(`${API_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`, {
      method: "POST",
      headers: weixinHeaders(),
      body: JSON.stringify({ local_token_list: [] }),
      signal,
    });
    const payload = (await parseJson(response)) as QrResponse;
    if (typeof payload.qrcode !== "string" || typeof payload.qrcode_img_content !== "string") {
      throw channelError("微信服务未返回有效二维码，请稍后重试。");
    }
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + LOGIN_TTL_MS);
    this.sessions.set(sessionId, { qrCode: payload.qrcode, expiresAt, baseUrl: API_BASE });
    return {
      sessionId,
      qrCodeUrl: await QRCode.toDataURL(payload.qrcode_img_content, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 280,
      }),
      expiresAt,
    };
  }

  async poll(
    sessionId: string,
    verifyCode: string | undefined,
    signal: AbortSignal,
  ): Promise<WeixinLoginStatus> {
    const session = this.sessions.get(sessionId);
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(sessionId);
      return { status: "expired" };
    }
    const query = new URLSearchParams({ qrcode: session.qrCode });
    if (verifyCode) query.set("verify_code", verifyCode);
    const pollController = new AbortController();
    session.activePoll?.abort();
    session.activePoll = pollController;
    const abortPoll = () => pollController.abort();
    signal.addEventListener("abort", abortPoll, { once: true });
    try {
      const response = await fetch(`${session.baseUrl}/ilink/bot/get_qrcode_status?${query}`, {
        headers: weixinHeaders(),
        signal: pollController.signal,
      });
      const payload = (await parseJson(response)) as StatusResponse;
      switch (payload.status) {
        case "wait":
          return { status: "waiting", expiresAt: session.expiresAt };
        case "scaned":
          return { status: "scanned", expiresAt: session.expiresAt };
        case "need_verifycode":
          return { status: "verification_required", expiresAt: session.expiresAt };
        case "expired":
        case "verify_code_blocked":
          this.sessions.delete(sessionId);
          return { status: "expired" };
        case "scaned_but_redirect":
          session.baseUrl = validateRedirectHost(payload.redirect_host);
          return { status: "scanned", expiresAt: session.expiresAt };
        case "confirmed": {
          if (typeof payload.bot_token !== "string" || typeof payload.ilink_bot_id !== "string") {
            throw channelError("微信确认成功，但未返回完整的绑定凭据。");
          }
          this.sessions.delete(sessionId);
          return {
            status: "confirmed",
            accountId: payload.ilink_bot_id,
            ...(typeof payload.ilink_user_id === "string" ? { userId: payload.ilink_user_id } : {}),
            baseUrl: validateBaseUrl(payload.baseurl, session.baseUrl),
            botToken: payload.bot_token,
          };
        }
        default:
          throw channelError("微信返回了无法识别的登录状态，请重新生成二维码。");
      }
    } finally {
      signal.removeEventListener("abort", abortPoll);
      if (session.activePoll === pollController) session.activePoll = undefined;
    }
  }

  cancel(sessionId: string): void {
    this.sessions.get(sessionId)?.activePoll?.abort();
    this.sessions.delete(sessionId);
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt.getTime() <= now) this.sessions.delete(id);
    }
  }
}

function weixinHeaders(): Record<string, string> {
  const uin = Buffer.from(String(randomUInt32()), "utf8").toString("base64");
  return {
    "content-type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": uin,
    "iLink-App-Id": "bot",
    "iLink-App-ClientVersion": "132104",
  };
}

function randomUInt32(): number {
  return randomBytes(4).readUInt32BE(0);
}

async function parseJson(response: Response): Promise<unknown> {
  if (!response.ok) throw channelError("微信服务暂时不可用，请稍后重试。");
  try {
    return await response.json();
  } catch (error) {
    throw channelError("微信服务返回了无效响应。", error);
  }
}

function validateRedirectHost(value: unknown): string {
  if (typeof value !== "string" || !isAllowedHost(value)) {
    throw channelError("微信登录返回了不受信任的跳转地址。");
  }
  return `https://${value}`;
}

function validateBaseUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname)) throw new Error("untrusted");
    return url.origin;
  } catch (error) {
    throw channelError("微信登录返回了不受信任的服务地址。", error);
  }
}

function isAllowedHost(host: string): boolean {
  return host === "ilinkai.weixin.qq.com" || host.endsWith(".weixin.qq.com");
}

function channelError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: "WEIXIN_BINDING_FAILED",
    category: "network",
    userMessage: message,
    retryable: true,
    cause,
  });
}
