import {
  upsertAssistantStep,
  type AssistantStep,
  type ConversationRepository,
  type MessageId,
} from "@zimo/domain";

export function createConversationToolStepReporter(input: {
  messageId: MessageId;
  conversations: ConversationRepository;
  emit(event: {
    type: "message.steps.updated";
    messageId: MessageId;
    steps: readonly AssistantStep[];
  }): void;
}): {
  onStep(step: AssistantStep): Promise<void>;
  cancelRunning(): Promise<void>;
  failRunning(): Promise<void>;
} {
  let steps: AssistantStep[] = [];

  const publish = async (next: readonly AssistantStep[]): Promise<void> => {
    steps = [...next];
    await input.conversations.saveMessageSteps(input.messageId, steps);
    input.emit({
      type: "message.steps.updated",
      messageId: input.messageId,
      steps,
    });
  };

  const finalizeRunning = async (status: "cancelled" | "failed"): Promise<void> => {
    const next = steps.map((step) => (step.status === "running" ? { ...step, status } : step));
    if (next.every((step, index) => step === steps[index])) return;
    await publish(next);
  };

  return {
    async onStep(step) {
      await publish(upsertAssistantStep(steps, step));
    },
    async cancelRunning() {
      await finalizeRunning("cancelled");
    },
    async failRunning() {
      await finalizeRunning("failed");
    },
  };
}
