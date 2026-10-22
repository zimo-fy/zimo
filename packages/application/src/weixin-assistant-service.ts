import type {
  Clock,
  CommunicationChannelBinding,
  CommunicationChannelRepository,
  SecretStore,
  SessionStore,
  WeixinAssistantRepository,
  WeixinInboundTextMessage,
  WeixinMessagingGateway,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import type { ConversationService } from "./conversation-service";
import {
  invalidWeixinCredential,
  parseWeixinCredential,
  requireWeixinBindingConfig,
  type WeixinCredentialState,
} from "./weixin-assistant-credential";
import { abortableDelay, withParentTimeout } from "./weixin-assistant-timing";
import type {
  WeixinAssistantRuntimeStatus,
  WeixinAssistantStatus,
} from "./weixin-assistant-status";
import { WeixinConversationResponder } from "./weixin-conversation-responder";

const POLL_TIMEOUT_MS = 45_000;
const SEND_TIMEOUT_MS = 20_000;
const MAX_REPLY_CHARACTERS = 8_000;

interface ActiveRuntime {
  ownerUserId: string;
  controller: AbortController;
  task: Promise<void>;
  binding: CommunicationChannelBinding;
  credential: WeixinCredentialState;
}

export class WeixinAssistantService {
  private active: ActiveRuntime | undefined;
  private currentStatus: WeixinAssistantStatus = {
    status: "stopped",
    canSendTestMessage: false,
  };
  private readonly responder: WeixinConversationResponder;

  constructor(
    private readonly bindings: CommunicationChannelRepository,
    private readonly assistant: WeixinAssistantRepository,
    private readonly sessions: SessionStore,
    private readonly secrets: SecretStore,
    private readonly gateway: WeixinMessagingGateway,
    conversations: ConversationService,
    private readonly clock: Clock,
    private readonly report: (event: Readonly<Record<string, string | number | boolean>>) => void,
  ) {
    this.responder = new WeixinConversationResponder(conversations, assistant, clock);
  }

  getStatus(): WeixinAssistantStatus {
    return { ...this.currentStatus };
  }

  async start(): Promise<void> {
    await this.stop();
    const session = await this.sessions.get();
    if (!session?.externalUserId) return;
    const binding = await this.bindings.get(session.externalUserId, "weixin");
    if (binding?.status !== "bound" || !binding.secretRef) return;
    let credential: WeixinCredentialState;
    try {
      credential = parseWeixinCredential(await this.secrets.get(binding.secretRef));
    } catch (error) {
      this.currentStatus = {
        status: "reauthentication_required",
        canSendTestMessage: false,
        errorCode: errorCode(error),
      };
      throw error;
    }
    const controller = new AbortController();
    this.setStatus("starting", credential);
    const runtime: ActiveRuntime = {
      ownerUserId: session.externalUserId,
      controller,
      binding,
      credential,
      task: Promise.resolve(),
    };
    this.active = runtime;
    runtime.task = this.run(runtime)
      .catch((error: unknown) => {
        if (!runtime.controller.signal.aborted) {
          const code = errorCode(error);
          this.setStatus("degraded", runtime.credential, code);
          this.report({ event: "weixin.runtime.failed", errorCode: code });
        }
      })
      .finally(() => {
        if (this.active === runtime) this.active = undefined;
      });
  }

  async stop(): Promise<void> {
    const runtime = this.active;
    if (!runtime) {
      this.currentStatus = { status: "stopped", canSendTestMessage: false };
      return;
    }
    runtime.controller.abort();
    await runtime.task.catch(() => undefined);
    if (this.active === runtime) this.active = undefined;
    this.currentStatus = { status: "stopped", canSendTestMessage: false };
  }

  async sendTestMessage(): Promise<void> {
    const runtime = await this.requireActiveRuntime();
    const { lastContextToken, lastPeerUserId } = runtime.credential;
    if (!lastContextToken || !lastPeerUserId) {
      throw new AppError({
        code: "WEIXIN_ACTIVATION_REQUIRED",
        category: "user",
        userMessage: "请先从已绑定的微信向助手发送一条消息，再发送测试消息。",
      });
    }
    try {
      await withParentTimeout(
        undefined,
        (signal) =>
          this.gateway.sendText(
            requireWeixinBindingConfig(runtime.binding, "baseUrl"),
            runtime.credential.botToken,
            {
              recipientUserId: lastPeerUserId,
              contextToken: lastContextToken,
              text: "Zimo 微信助手连接正常，可以开始发送指令了。",
            },
            signal,
          ),
        SEND_TIMEOUT_MS,
      );
    } catch (error) {
      if (errorCode(error) === "WEIXIN_ACTIVATION_REQUIRED") {
        await this.clearActivation(runtime);
      }
      throw error;
    }
  }

  private async run(runtime: ActiveRuntime): Promise<void> {
    const baseUrl = requireWeixinBindingConfig(runtime.binding, "baseUrl");
    try {
      await withParentTimeout(
        runtime.controller.signal,
        (signal) => this.gateway.notifyStart(baseUrl, runtime.credential.botToken, signal),
        SEND_TIMEOUT_MS,
      );
      this.setStatus(
        runtime.credential.lastContextToken ? "listening" : "awaiting_activation",
        runtime.credential,
      );
      let failures = 0;
      while (!runtime.controller.signal.aborted) {
        try {
          const updates = await withParentTimeout(
            runtime.controller.signal,
            (signal) =>
              this.gateway.getUpdates(
                baseUrl,
                runtime.credential.botToken,
                runtime.credential.getUpdatesBuf,
                signal,
              ),
            POLL_TIMEOUT_MS,
          );
          failures = 0;
          for (const message of updates.messages) {
            if (runtime.controller.signal.aborted) break;
            await this.handleInbound(runtime, message);
          }
          runtime.credential.getUpdatesBuf = updates.nextCursor;
          await this.persistCredential(runtime);
          this.setStatus(
            runtime.credential.lastContextToken ? "listening" : "awaiting_activation",
            runtime.credential,
          );
        } catch (error) {
          if (runtime.controller.signal.aborted) break;
          const code = errorCode(error);
          if (code === "WEIXIN_REAUTHENTICATION_REQUIRED") {
            this.setStatus("reauthentication_required", runtime.credential, code);
            return;
          }
          if (code === "WEIXIN_ACTIVATION_REQUIRED") {
            await this.clearActivation(runtime);
            continue;
          }
          failures += 1;
          this.setStatus("degraded", runtime.credential, code);
          this.report({ event: "weixin.poll.failed", errorCode: code, failureCount: failures });
          await abortableDelay(
            Math.min(30_000, 1_000 * 2 ** Math.min(failures - 1, 5)),
            runtime.controller.signal,
          );
        }
      }
    } finally {
      if (runtime.controller.signal.aborted) {
        const stopController = new AbortController();
        const timer = setTimeout(() => stopController.abort(), 5_000);
        await this.gateway
          .notifyStop(baseUrl, runtime.credential.botToken, stopController.signal)
          .catch(() => undefined);
        clearTimeout(timer);
      }
    }
  }

  private async handleInbound(
    runtime: ActiveRuntime,
    message: WeixinInboundTextMessage,
  ): Promise<void> {
    const receivedAt = this.clock.now();
    const claimed = await this.assistant.claimInbound(
      runtime.ownerUserId,
      message.dedupeKey,
      receivedAt,
    );
    if (!claimed) return;
    runtime.credential.lastContextToken = message.contextToken;
    runtime.credential.lastPeerUserId = message.peerUserId;
    runtime.credential.lastInboundAt = receivedAt.toISOString();
    await this.persistCredential(runtime);
    this.setStatus("replying", runtime.credential);
    try {
      let generationErrorCode: string | undefined;
      let reply: string;
      try {
        reply = await this.responder.generate(
          runtime.ownerUserId,
          message.text,
          runtime.controller.signal,
        );
      } catch (error) {
        if (runtime.controller.signal.aborted) throw error;
        generationErrorCode = errorCode(error);
        reply =
          error instanceof AppError
            ? `处理指令失败：${error.userMessage}`
            : "处理指令失败，请稍后重试。";
      }
      await withParentTimeout(
        runtime.controller.signal,
        (signal) =>
          this.gateway.sendText(
            requireWeixinBindingConfig(runtime.binding, "baseUrl"),
            runtime.credential.botToken,
            {
              recipientUserId: message.peerUserId,
              contextToken: message.contextToken,
              text: reply.slice(0, MAX_REPLY_CHARACTERS),
            },
            signal,
          ),
        SEND_TIMEOUT_MS,
      );
      await this.assistant.finishInbound(
        runtime.ownerUserId,
        message.dedupeKey,
        "completed",
        this.clock.now(),
        generationErrorCode,
      );
      this.report({
        event: "weixin.inbound.completed",
        outcome: generationErrorCode ? "failure" : "success",
        ...(generationErrorCode ? { errorCode: generationErrorCode } : {}),
      });
    } catch (error) {
      await this.assistant.finishInbound(
        runtime.ownerUserId,
        message.dedupeKey,
        "failed",
        this.clock.now(),
        errorCode(error),
      );
      throw error;
    }
  }

  private async persistCredential(runtime: ActiveRuntime): Promise<void> {
    if (!runtime.binding.secretRef) throw invalidWeixinCredential();
    await this.secrets.set(runtime.binding.secretRef, JSON.stringify(runtime.credential));
  }

  private async clearActivation(runtime: ActiveRuntime): Promise<void> {
    delete runtime.credential.lastContextToken;
    delete runtime.credential.lastPeerUserId;
    await this.persistCredential(runtime);
    this.setStatus("awaiting_activation", runtime.credential, "WEIXIN_ACTIVATION_REQUIRED");
  }

  private async requireActiveRuntime(): Promise<ActiveRuntime> {
    const session = await this.sessions.get();
    if (!session?.externalUserId || this.active?.ownerUserId !== session.externalUserId) {
      throw new AppError({
        code: "WEIXIN_CHANNEL_NOT_RUNNING",
        category: "user",
        userMessage: "微信助手当前未连接，请重新绑定或稍后重试。",
      });
    }
    return this.active;
  }

  private setStatus(
    status: WeixinAssistantRuntimeStatus,
    credential: WeixinCredentialState,
    errorCodeValue?: string,
  ): void {
    this.currentStatus = {
      status,
      canSendTestMessage:
        status !== "reauthentication_required" &&
        Boolean(credential.lastContextToken && credential.lastPeerUserId),
      ...(credential.lastInboundAt ? { lastInboundAt: new Date(credential.lastInboundAt) } : {}),
      ...(errorCodeValue ? { errorCode: errorCodeValue } : {}),
    };
  }
}

function errorCode(error: unknown): string {
  return error instanceof AppError ? error.code : "INTERNAL_UNEXPECTED";
}
