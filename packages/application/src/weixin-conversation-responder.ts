import type { Clock, WeixinAssistantRepository } from "@zimo/domain";
import { AppError } from "@zimo/domain";

import type { ConversationService } from "./conversation-service";

const ASSISTANT_TIMEOUT_MS = 90_000;

export class WeixinConversationResponder {
  constructor(
    private readonly conversations: ConversationService,
    private readonly routes: WeixinAssistantRepository,
    private readonly clock: Clock,
  ) {}

  async generate(ownerUserId: string, text: string, signal: AbortSignal): Promise<string> {
    const conversationId = await this.requireConversation(ownerUserId);
    let failure: AppError | undefined;
    let resolveRun!: () => void;
    const terminal = new Promise<void>((resolve) => {
      resolveRun = resolve;
    });
    const accepted = await this.conversations.send(
      { conversationId, content: text },
      {
        emit: (envelope) => {
          if (envelope.event.type === "run.failed") {
            failure = new AppError({
              code: envelope.event.error.code,
              category: envelope.event.error.category,
              userMessage: envelope.event.error.message,
              retryable: envelope.event.error.retryable,
            });
            resolveRun();
          } else if (
            envelope.event.type === "run.completed" ||
            envelope.event.type === "run.cancelled"
          ) {
            resolveRun();
          }
        },
      },
    );
    const cancel = () => this.conversations.cancel(accepted.runId);
    let timedOut = false;
    const generationTimer = setTimeout(() => {
      timedOut = true;
      cancel();
    }, ASSISTANT_TIMEOUT_MS);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    await terminal.finally(() => {
      clearTimeout(generationTimer);
      signal.removeEventListener("abort", cancel);
    });
    if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    if (failure) throw failure;
    if (timedOut) {
      throw new AppError({
        code: "WEIXIN_ASSISTANT_TIMEOUT",
        category: "model",
        userMessage: "处理时间过长，请缩短指令后重试。",
        retryable: true,
      });
    }
    const conversation = await this.conversations.get(conversationId);
    const reply = conversation.messages.find(
      (message) => message.id === accepted.assistantMessageId,
    );
    if (!reply?.content) {
      throw new AppError({
        code: "WEIXIN_ASSISTANT_EMPTY_REPLY",
        category: "model",
        userMessage: "模型没有生成可发送的回复。",
        retryable: true,
      });
    }
    return reply.content;
  }

  private async requireConversation(ownerUserId: string): Promise<string> {
    const routedId = await this.routes.getConversationId(ownerUserId);
    if (routedId) {
      const existing = await this.conversations.get(routedId).catch(() => null);
      if (existing) return routedId;
    }
    const created = await this.conversations.create();
    await this.conversations.rename(created.id, "微信助手");
    await this.routes.saveConversationId(ownerUserId, created.id, this.clock.now());
    return created.id;
  }
}
