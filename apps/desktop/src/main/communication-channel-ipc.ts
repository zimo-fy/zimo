import type {
  CommunicationChannelService,
  WeixinAssistantService,
  WeixinAssistantStatus,
} from "@zimo/application";
import {
  bindEmailChannelRequestSchema,
  cancelWeixinLoginRequestSchema,
  communicationChannelViewSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  pollWeixinLoginRequestSchema,
  successViewSchema,
  unbindCommunicationChannelRequestSchema,
  weixinLoginStartViewSchema,
  weixinLoginStatusViewSchema,
} from "@zimo/contracts";
import type { CommunicationChannelBinding } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerCommunicationChannelIpcHandlers(options: {
  register: RegisterIpcHandler;
  service: CommunicationChannelService;
  assistant: WeixinAssistantService;
  logger: StructuredLogger;
}): void {
  const { register, service, assistant, logger } = options;
  register({
    channel: IPC_CHANNELS.communicationChannelsList,
    input: emptyRequestSchema,
    output: communicationChannelViewSchema.array(),
    handle: async () => {
      const status = assistant.getStatus();
      return (await service.list()).map((binding) => toView(binding, status));
    },
  });
  register({
    channel: IPC_CHANNELS.communicationChannelsBindEmail,
    input: bindEmailChannelRequestSchema,
    output: communicationChannelViewSchema,
    handle: async ({ payload }) => {
      const binding = await service.bindEmail(payload.email);
      audit(logger, "communication-channel.email.bound", "email");
      return toView(binding, assistant.getStatus());
    },
  });
  register({
    channel: IPC_CHANNELS.communicationChannelsStartWeixin,
    input: emptyRequestSchema,
    output: weixinLoginStartViewSchema,
    handle: async () => {
      const result = await service.startWeixin();
      return {
        sessionId: result.sessionId,
        qrCodeDataUrl: result.qrCodeUrl,
        expiresAt: result.expiresAt.toISOString(),
      };
    },
  });
  register({
    channel: IPC_CHANNELS.communicationChannelsPollWeixin,
    input: pollWeixinLoginRequestSchema,
    output: weixinLoginStatusViewSchema,
    handle: async ({ payload }) => {
      const result = await service.pollWeixin(payload.sessionId, payload.verifyCode);
      if (result.status === "confirmed") {
        await assistant.start();
        audit(logger, "communication-channel.weixin.bound", "weixin");
        return { status: result.status, accountLabel: result.accountId };
      }
      return {
        status: result.status,
        ...("expiresAt" in result ? { expiresAt: result.expiresAt.toISOString() } : {}),
      };
    },
  });
  register({
    channel: IPC_CHANNELS.communicationChannelsCancelWeixin,
    input: cancelWeixinLoginRequestSchema,
    output: successViewSchema,
    handle: ({ payload }) => {
      service.cancelWeixin(payload.sessionId);
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.communicationChannelsUnbind,
    input: unbindCommunicationChannelRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      if (payload.kind === "weixin") await assistant.stop();
      await service.unbind(payload.kind);
      audit(logger, "communication-channel.unbound", payload.kind);
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.communicationChannelsSendWeixinTest,
    input: emptyRequestSchema,
    output: successViewSchema,
    handle: async () => {
      await assistant.sendTestMessage();
      audit(logger, "communication-channel.weixin.test-sent", "weixin");
      return { success: true as const };
    },
  });
}

function toView(binding: CommunicationChannelBinding, runtime: WeixinAssistantStatus) {
  return {
    kind: binding.kind,
    name: binding.kind === "weixin" ? "个人微信 Clawbot" : "邮箱",
    description:
      binding.kind === "weixin"
        ? "通过微信发送文本指令，并在专用微信助手会话中获得回复。"
        : "登记邮件地址，后续用于接收并处理发送到该地址的邮件。",
    status: binding.status,
    ...(binding.accountLabel ? { accountLabel: binding.accountLabel } : {}),
    ...(binding.boundAt ? { boundAt: binding.boundAt.toISOString() } : {}),
    capabilities:
      binding.kind === "weixin" ? ["扫码绑定", "文本指令", "即时回复"] : ["地址登记", "收件待接入"],
    ...(binding.kind === "weixin"
      ? {
          runtimeStatus: runtime.status,
          canSendTestMessage: runtime.canSendTestMessage,
          ...(runtime.lastInboundAt ? { lastInboundAt: runtime.lastInboundAt.toISOString() } : {}),
        }
      : {}),
  };
}

function audit(logger: StructuredLogger, event: string, kind: "weixin" | "email"): void {
  logger.log({
    level: "info",
    category: "audit",
    event,
    message: "Communication channel binding changed",
    context: { channelKind: kind, outcome: "success" },
  });
}
