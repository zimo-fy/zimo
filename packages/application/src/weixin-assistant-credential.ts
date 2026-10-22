import type { CommunicationChannelBinding } from "@zimo/domain";
import { AppError } from "@zimo/domain";

export interface WeixinCredentialState {
  schemaVersion: 2;
  botToken: string;
  getUpdatesBuf: string;
  lastContextToken?: string;
  lastPeerUserId?: string;
  lastInboundAt?: string;
}

export function parseWeixinCredential(value: string | null): WeixinCredentialState {
  if (!value) throw invalidWeixinCredential();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw invalidWeixinCredential(error);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalidWeixinCredential();
  }
  const state = parsed as Record<string, unknown>;
  if (typeof state.botToken !== "string" || !state.botToken || state.botToken.length > 16_384) {
    throw invalidWeixinCredential();
  }
  return {
    schemaVersion: 2,
    botToken: state.botToken,
    getUpdatesBuf: typeof state.getUpdatesBuf === "string" ? state.getUpdatesBuf : "",
    ...(typeof state.lastContextToken === "string"
      ? { lastContextToken: state.lastContextToken }
      : {}),
    ...(typeof state.lastPeerUserId === "string" ? { lastPeerUserId: state.lastPeerUserId } : {}),
    ...(typeof state.lastInboundAt === "string" ? { lastInboundAt: state.lastInboundAt } : {}),
  };
}

export function requireWeixinBindingConfig(
  binding: CommunicationChannelBinding,
  key: string,
): string {
  const value = binding.config[key];
  if (typeof value !== "string" || !value) throw invalidWeixinCredential();
  return value;
}

export function invalidWeixinCredential(cause?: unknown): AppError {
  return new AppError({
    code: "WEIXIN_CREDENTIAL_INVALID",
    category: "security",
    userMessage: "微信绑定凭据不可用，请解绑后重新绑定。",
    cause,
  });
}
