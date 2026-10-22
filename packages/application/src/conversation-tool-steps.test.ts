import { describe, expect, it, vi } from "vitest";
import type { AssistantStep, ConversationRepository, MessageId } from "@zimo/domain";

import { createConversationToolStepReporter } from "./conversation-tool-steps";

const MESSAGE_ID = "00000000-0000-4000-8000-000000000011" as MessageId;

describe("createConversationToolStepReporter", () => {
  it("persists and emits upserted steps without changing message timestamps", async () => {
    const conversations = {
      saveMessageSteps: vi.fn(async () => undefined),
    } as unknown as ConversationRepository;
    const emit = vi.fn();
    const reporter = createConversationToolStepReporter({
      messageId: MESSAGE_ID,
      conversations,
      emit,
    });
    const running = step("call-1", "running");
    await reporter.onStep(running);
    await reporter.onStep({ ...running, status: "completed" });
    expect(conversations.saveMessageSteps).toHaveBeenLastCalledWith(MESSAGE_ID, [
      { ...running, status: "completed" },
    ]);
    expect(emit).toHaveBeenLastCalledWith({
      type: "message.steps.updated",
      messageId: MESSAGE_ID,
      steps: [{ ...running, status: "completed" }],
    });
  });

  it("marks leftover running steps cancelled when the run stops", async () => {
    const conversations = {
      saveMessageSteps: vi.fn(async () => undefined),
    } as unknown as ConversationRepository;
    const emit = vi.fn();
    const reporter = createConversationToolStepReporter({
      messageId: MESSAGE_ID,
      conversations,
      emit,
    });
    await reporter.onStep(step("call-1", "completed"));
    await reporter.onStep(step("call-2", "running"));
    await reporter.cancelRunning();
    expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
      type: "message.steps.updated",
      steps: [step("call-1", "completed"), step("call-2", "cancelled")],
    });
  });
});

function step(id: string, status: AssistantStep["status"]): AssistantStep {
  return { id, kind: "file_read", title: `读取 ${id}`, status, resultTitle: `已读取 ${id}` };
}
