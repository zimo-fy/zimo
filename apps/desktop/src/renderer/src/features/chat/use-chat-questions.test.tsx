// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { AgentStreamEnvelopeView, PendingUserQuestionView } from "@zimo/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatQuestions } from "./use-chat-questions";

const pending: PendingUserQuestionView = {
  questionId: "00000000-0000-4000-8000-000000000001",
  conversationId: "00000000-0000-4000-8000-000000000002",
  runId: "00000000-0000-4000-8000-000000000003",
  expiresAt: "2026-09-23T00:30:00.000Z",
  questionNumber: 1,
  questionCount: 2,
  questions: [
    {
      id: "approach",
      header: "方案",
      question: "选择方案？",
      options: [{ label: "方案 A" }, { label: "方案 B" }],
    },
  ],
};

describe("useChatQuestions", () => {
  beforeEach(() => {
    Object.defineProperty(window, "zimo", {
      configurable: true,
      value: {
        userQuestions: {
          listPending: vi.fn(async () => ({ ok: true, requestId: "request", data: [] })),
          answer: vi.fn(async () => ({
            ok: true,
            requestId: "request",
            data: { accepted: true },
          })),
        },
      },
    });
  });

  it("removes the answered card as soon as Main accepts it", async () => {
    const { result } = renderHook(() => useChatQuestions(vi.fn()));
    act(() => {
      result.current.applyStream({
        runId: pending.runId,
        sequence: 0,
        emittedAt: "2026-09-23T00:00:00.000Z",
        event: { type: "question.requested", question: pending },
      } satisfies AgentStreamEnvelopeView);
    });
    expect(result.current.pending).toEqual([pending]);
    await act(async () => {
      await result.current.answer(pending, [{ id: "approach", selected: ["方案 A"] }]);
    });
    expect(result.current.pending).toEqual([]);
  });
});
