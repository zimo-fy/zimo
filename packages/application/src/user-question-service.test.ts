import { describe, expect, it, vi } from "vitest";

import { UserQuestionService } from "./user-question-service";

const question = {
  questions: [
    {
      id: "approach",
      header: "方案",
      question: "选择哪个方案？",
      options: [{ label: "方案 A" }, { label: "方案 B" }],
    },
  ],
};

describe("UserQuestionService", () => {
  function createService() {
    const emit = vi.fn();
    let sequence = 0;
    const service = new UserQuestionService(
      { now: () => new Date("2026-09-22T00:00:00.000Z") },
      { create: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` },
    );
    return { service, emit };
  }

  it("returns a structured answer to the same waiting call and accepts it once", async () => {
    const { service, emit } = createService();
    const result = service.ask({
      rawQuestions: question,
      conversationId: "conversation",
      runId: "run",
      ownerId: "window-1",
      signal: new AbortController().signal,
      emit,
    });
    const pending = service.listPending("conversation", "window-1");
    expect(pending).toHaveLength(1);
    expect(service.listPending("conversation", "window-2")).toHaveLength(0);
    expect(
      service.answer({
        questionId: pending[0]!.questionId,
        ownerId: "window-2",
        answers: [{ id: "approach", selected: ["方案 A"] }],
      }),
    ).toBe(false);
    expect(
      service.answer({
        questionId: pending[0]!.questionId,
        ownerId: "window-1",
        answers: [{ id: "approach", selected: ["伪造选项"] }],
      }),
    ).toBe(false);
    expect(
      service.answer({
        questionId: pending[0]!.questionId,
        ownerId: "window-1",
        answers: [{ id: "approach", selected: ["方案 A"] }],
      }),
    ).toBe(true);
    await expect(result).resolves.toEqual({ answers: [{ id: "approach", selected: ["方案 A"] }] });
    expect(
      service.answer({
        questionId: pending[0]!.questionId,
        ownerId: "window-1",
        answers: [{ id: "approach", selected: ["方案 B"] }],
      }),
    ).toBe(false);
    expect(emit.mock.calls.map(([event]) => event.type)).toEqual([
      "question.requested",
      "question.resolved",
    ]);
  });

  it("publishes a model batch one question at a time and resolves after the final answer", async () => {
    const { service, emit } = createService();
    const result = service.ask({
      rawQuestions: {
        questions: [
          question.questions[0],
          {
            id: "format",
            header: "格式",
            question: "选择输出格式？",
            options: [{ label: "表格" }, { label: "正文" }],
          },
        ],
      },
      conversationId: "conversation",
      runId: "run",
      ownerId: "window-1",
      signal: new AbortController().signal,
      emit,
    });
    const first = service.listPending("conversation", "window-1")[0]!;
    expect(first.questions.map((item) => item.id)).toEqual(["approach"]);
    expect(first.questionNumber).toBe(1);
    expect(first.questionCount).toBe(2);
    expect(
      service.answer({
        questionId: first.questionId,
        ownerId: "window-1",
        answers: [{ id: "approach", selected: ["方案 A"] }],
      }),
    ).toBe(true);
    const second = service.listPending("conversation", "window-1")[0]!;
    expect(second.questionId).not.toBe(first.questionId);
    expect(second.questions.map((item) => item.id)).toEqual(["format"]);
    expect(second.questionNumber).toBe(2);
    expect(
      service.answer({
        questionId: second.questionId,
        ownerId: "window-1",
        answers: [{ id: "format", selected: ["表格"] }],
      }),
    ).toBe(true);
    await expect(result).resolves.toEqual({
      answers: [
        { id: "approach", selected: ["方案 A"] },
        { id: "format", selected: ["表格"] },
      ],
    });
    expect(emit.mock.calls.map(([event]) => event.type)).toEqual([
      "question.requested",
      "question.resolved",
      "question.requested",
      "question.resolved",
    ]);
  });

  it("cancels the pending question when the run stops", async () => {
    const { service, emit } = createService();
    const controller = new AbortController();
    const result = service.ask({
      rawQuestions: question,
      conversationId: "conversation",
      runId: "run",
      ownerId: "window-1",
      signal: controller.signal,
      emit,
    });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(service.listPending("conversation", "window-1")).toHaveLength(0);
  });

  it("ends a pending question when its owning window closes", async () => {
    const { service, emit } = createService();
    const result = service.ask({
      rawQuestions: question,
      conversationId: "conversation",
      runId: "run",
      ownerId: "window-1",
      signal: new AbortController().signal,
      emit,
    });
    service.cancelOwner("window-2");
    expect(service.listPending("conversation", "window-1")).toHaveLength(1);
    service.cancelOwner("window-1");
    await expect(result).rejects.toMatchObject({ code: "USER_QUESTION_UNAVAILABLE" });
    expect(service.listPending("conversation", "window-1")).toHaveLength(0);
  });

  it("expires unanswered questions", async () => {
    vi.useFakeTimers();
    try {
      const { service, emit } = createService();
      const result = service.ask({
        rawQuestions: question,
        conversationId: "conversation",
        runId: "run",
        ownerId: "window-1",
        signal: new AbortController().signal,
        emit,
      });
      const rejection = expect(result).rejects.toMatchObject({ code: "USER_QUESTION_EXPIRED" });
      await vi.advanceTimersByTimeAsync(30 * 60_000);
      await rejection;
      expect(service.listPending("conversation", "window-1")).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects duplicate question IDs", async () => {
    const { service, emit } = createService();
    await expect(
      service.ask({
        rawQuestions: { questions: [question.questions[0], question.questions[0]] },
        conversationId: "conversation",
        runId: "run",
        ownerId: "window-1",
        signal: new AbortController().signal,
        emit,
      }),
    ).rejects.toMatchObject({ code: "USER_QUESTION_INVALID" });
  });
});
