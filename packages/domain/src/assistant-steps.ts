import type { ActionKind } from "./approvals";

export const MAX_ASSISTANT_STEPS = 100;

export type AssistantStepKind = ActionKind | "tool";
export type AssistantStepStatus = "running" | "completed" | "denied" | "failed" | "cancelled";

export interface AssistantStep {
  id: string;
  kind: AssistantStepKind;
  title: string;
  status: AssistantStepStatus;
  resultTitle?: string;
  relativeTarget?: string;
}

export function upsertAssistantStep(
  steps: readonly AssistantStep[],
  incoming: AssistantStep,
): AssistantStep[] {
  const index = steps.findIndex((step) => step.id === incoming.id);
  if (index < 0) {
    if (steps.length >= MAX_ASSISTANT_STEPS) return [...steps];
    return [...steps, incoming];
  }
  return steps.map((step, stepIndex) => (stepIndex === index ? incoming : step));
}
