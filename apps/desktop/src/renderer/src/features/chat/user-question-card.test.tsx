// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UserQuestionCard } from "./user-question-card";

const question = {
  questionId: "00000000-0000-4000-8000-000000000001",
  conversationId: "00000000-0000-4000-8000-000000000002",
  runId: "00000000-0000-4000-8000-000000000003",
  expiresAt: "2026-09-22T00:30:00.000Z",
  questionNumber: 1,
  questionCount: 1,
  questions: [
    {
      id: "approach",
      header: "方案",
      question: "选择哪些方案？",
      multiSelect: true,
      options: [{ label: "方案 A" }, { label: "方案 B" }],
    },
  ],
};

describe("UserQuestionCard", () => {
  it("submits multiple choices with custom text", () => {
    const onAnswer = vi.fn();
    render(<UserQuestionCard question={question} busy={false} onAnswer={onAnswer} />);
    const submit = screen.getByRole("button", { name: "提交回答" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("方案 A"));
    fireEvent.click(screen.getByLabelText("方案 B"));
    fireEvent.change(screen.getByLabelText("其他（可自行输入）"), {
      target: { value: "补充说明" },
    });
    fireEvent.click(submit);
    expect(onAnswer).toHaveBeenCalledWith([
      { id: "approach", selected: ["方案 A", "方案 B"], custom: "补充说明" },
    ]);
  });
});
