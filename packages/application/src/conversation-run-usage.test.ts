import { describe, expect, it, vi } from "vitest";
import type { ConversationRepository, MessageId, TokenUsage } from "@zimo/domain";

import { createDetachedStreamSignal, scheduleAssistantUsageMerge } from "./conversation-run-usage";

describe("scheduleAssistantUsageMerge", () => {
  it("merges delayed usage onto the assistant message and emits the snapshot", async () => {
    const merged: TokenUsage = { totalTokens: 13371 };
    const conversations = {
      mergeMessageUsage: vi.fn(async () => merged),
    } as unknown as ConversationRepository;
    const emit = vi.fn();
    const pending = Promise.resolve({ totalTokens: 1055 });
    scheduleAssistantUsageMerge({
      pending,
      messageId: "00000000-0000-4000-8000-000000000011" as MessageId,
      conversations,
      emit,
    });
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(conversations.mergeMessageUsage).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000011",
      { totalTokens: 1055 },
    );
    expect(emit).toHaveBeenCalledWith({
      type: "usage.updated",
      messageId: "00000000-0000-4000-8000-000000000011",
      usage: merged,
    });
  });
});

describe("createDetachedStreamSignal", () => {
  it("does not abort the stream when the run is cancelled, then aborts after the drain window", async () => {
    const parent = new AbortController();
    const drain = createDetachedStreamSignal(parent.signal, 20);
    parent.abort();
    expect(drain.signal.aborted).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(drain.signal.aborted).toBe(true);
    drain.dispose();
  });

  it("leaves the stream running until dispose when the run is not cancelled", async () => {
    const parent = new AbortController();
    const drain = createDetachedStreamSignal(parent.signal, 20);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(drain.signal.aborted).toBe(false);
    drain.dispose();
    expect(drain.signal.aborted).toBe(true);
  });
});
