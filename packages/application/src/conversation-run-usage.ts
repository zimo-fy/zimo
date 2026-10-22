import type { ConversationRepository, MessageId, TokenUsage } from "@zimo/domain";

export const STREAM_USAGE_DRAIN_MS = 15_000;

export function scheduleAssistantUsageMerge(input: {
  pending: Promise<TokenUsage | undefined> | undefined;
  messageId: MessageId;
  conversations: ConversationRepository;
  emit(event: { type: "usage.updated"; messageId: string; usage: TokenUsage }): void;
}): void {
  if (!input.pending) return;
  void input.pending
    .then(async (usage) => {
      if (!usage) return;
      const merged = await input.conversations.mergeMessageUsage(input.messageId, usage);
      if (!merged) return;
      input.emit({ type: "usage.updated", messageId: input.messageId, usage: merged });
    })
    .catch(() => undefined);
}

export function createDetachedStreamSignal(
  parent: AbortSignal,
  timeoutMs = STREAM_USAGE_DRAIN_MS,
): { signal: AbortSignal; dispose(): void } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abortChild = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (!controller.signal.aborted) controller.abort();
  };
  const onParentAbort = () => {
    if (timer !== undefined || controller.signal.aborted) return;
    timer = setTimeout(abortChild, timeoutMs);
    timer.unref?.();
  };
  if (parent.aborted) onParentAbort();
  else parent.addEventListener("abort", onParentAbort, { once: true });
  return {
    signal: controller.signal,
    dispose() {
      parent.removeEventListener("abort", onParentAbort);
      abortChild();
    },
  };
}
