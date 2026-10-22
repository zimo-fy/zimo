export type CommunicationChannelKind = "weixin" | "email";
export type CommunicationChannelStatus = "unbound" | "bound";

export interface CommunicationChannelBinding {
  ownerUserId: string;
  kind: CommunicationChannelKind;
  status: CommunicationChannelStatus;
  accountLabel?: string | undefined;
  secretRef?: string | undefined;
  config: Readonly<Record<string, string | number | boolean>>;
  boundAt?: Date | undefined;
  updatedAt: Date;
}

export interface CommunicationChannelRepository {
  list(ownerUserId: string): Promise<readonly CommunicationChannelBinding[]>;
  get(
    ownerUserId: string,
    kind: CommunicationChannelKind,
  ): Promise<CommunicationChannelBinding | null>;
  save(binding: CommunicationChannelBinding): Promise<void>;
  clear(ownerUserId: string, kind: CommunicationChannelKind, updatedAt: Date): Promise<void>;
}

export type WeixinLoginStatus =
  | { status: "waiting" | "scanned"; expiresAt: Date }
  | { status: "verification_required"; expiresAt: Date }
  | { status: "expired" }
  | {
      status: "confirmed";
      accountId: string;
      userId?: string | undefined;
      baseUrl: string;
      botToken: string;
    };

export interface WeixinLoginStart {
  sessionId: string;
  qrCodeUrl: string;
  expiresAt: Date;
}

export interface WeixinBindingGateway {
  start(signal: AbortSignal): Promise<WeixinLoginStart>;
  poll(
    sessionId: string,
    verifyCode: string | undefined,
    signal: AbortSignal,
  ): Promise<WeixinLoginStatus>;
  cancel(sessionId: string): void;
}

export interface WeixinInboundTextMessage {
  dedupeKey: string;
  peerUserId: string;
  contextToken: string;
  text: string;
}

export interface WeixinUpdatesResult {
  nextCursor: string;
  messages: readonly WeixinInboundTextMessage[];
}

export interface WeixinMessagingGateway {
  notifyStart(baseUrl: string, botToken: string, signal: AbortSignal): Promise<void>;
  getUpdates(
    baseUrl: string,
    botToken: string,
    cursor: string,
    signal: AbortSignal,
  ): Promise<WeixinUpdatesResult>;
  sendText(
    baseUrl: string,
    botToken: string,
    input: Readonly<{ recipientUserId: string; contextToken: string; text: string }>,
    signal: AbortSignal,
  ): Promise<void>;
  notifyStop(baseUrl: string, botToken: string, signal: AbortSignal): Promise<void>;
}

export interface WeixinAssistantRepository {
  getConversationId(ownerUserId: string): Promise<string | null>;
  saveConversationId(ownerUserId: string, conversationId: string, updatedAt: Date): Promise<void>;
  claimInbound(ownerUserId: string, dedupeKey: string, receivedAt: Date): Promise<boolean>;
  finishInbound(
    ownerUserId: string,
    dedupeKey: string,
    status: "completed" | "failed",
    finishedAt: Date,
    errorCode?: string,
  ): Promise<void>;
}

export interface NotificationMessage {
  title: string;
  body: string;
}

export interface NotificationChannel {
  readonly kind: CommunicationChannelKind;
  send(
    binding: CommunicationChannelBinding,
    bindingSecret: string | null,
    message: NotificationMessage,
    signal: AbortSignal,
  ): Promise<void>;
}
