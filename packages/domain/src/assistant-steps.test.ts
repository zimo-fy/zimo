import { describe, expect, it } from "vitest";

import { MAX_ASSISTANT_STEPS, upsertAssistantStep, type AssistantStep } from "./assistant-steps";

describe("upsertAssistantStep", () => {
  it("appends a new step and replaces the matching id", () => {
    const first = step("a", "running");
    const second = step("b", "running");
    const next = upsertAssistantStep([first], second);
    expect(next).toEqual([first, second]);
    expect(upsertAssistantStep(next, { ...second, status: "completed" })).toEqual([
      first,
      { ...second, status: "completed" },
    ]);
  });

  it("does not append past the persisted cap", () => {
    const filled = Array.from({ length: MAX_ASSISTANT_STEPS }, (_, index) =>
      step(String(index), "completed"),
    );
    expect(upsertAssistantStep(filled, step("overflow", "running"))).toHaveLength(
      MAX_ASSISTANT_STEPS,
    );
    expect(upsertAssistantStep(filled, { ...filled[0]!, status: "failed" })[0]?.status).toBe(
      "failed",
    );
  });
});

function step(id: string, status: AssistantStep["status"]): AssistantStep {
  return { id, kind: "file_read", title: `读取 ${id}`, status };
}
