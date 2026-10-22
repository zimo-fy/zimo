import type {
  AgentStreamEnvelopeView,
  PendingUserQuestionView,
  UserQuestionAnswer,
  ZimoDesktopApi,
} from "@zimo/contracts";
import { useCallback, useState } from "react";

type QuestionApi = ZimoDesktopApi["userQuestions"];

export function useChatQuestions(onError: (message: string | null) => void) {
  const [pending, setPending] = useState<readonly PendingUserQuestionView[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (conversationId: string): Promise<void> => {
      try {
        const result = await requireApi().listPending(crypto.randomUUID(), conversationId);
        if (result.ok) setPending(result.data);
        else onError(result.error.message);
      } catch {
        onError("提问功能尚未加载，请完全退出并重新启动 Zimo 后重试。");
      }
    },
    [onError],
  );

  const applyStream = useCallback((envelope: AgentStreamEnvelopeView): void => {
    if (envelope.event.type === "question.requested") {
      const question = envelope.event.question;
      setPending((current) => [
        ...current.filter((item) => item.questionId !== question.questionId),
        question,
      ]);
    } else if (envelope.event.type === "question.resolved") {
      const questionId = envelope.event.questionId;
      setPending((current) => current.filter((item) => item.questionId !== questionId));
    }
  }, []);

  async function answer(
    item: PendingUserQuestionView,
    answers: readonly UserQuestionAnswer[],
  ): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const result = await requireApi().answer(crypto.randomUUID(), item.questionId, answers);
      if (!result.ok) onError(result.error.message);
      else if (!result.data.accepted) onError("问题已失效或回答不符合选项，请重新检查。");
      else {
        setPending((current) => current.filter((entry) => entry.questionId !== item.questionId));
      }
    } catch {
      onError("回答未能提交，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return { pending, busy, refresh, applyStream, answer };
}

function requireApi(): QuestionApi {
  const api = (window.zimo as Partial<ZimoDesktopApi>).userQuestions;
  if (!api) throw new Error("User question bridge unavailable");
  return api;
}
