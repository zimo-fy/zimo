import { userQuestionAnswerSchema, userQuestionBatchSchema } from "@zimo/contracts";
import {
  AppError,
  type AgentStreamEvent,
  type Clock,
  type IdGenerator,
  type PendingUserQuestion,
  type UserQuestion,
  type UserQuestionAnswer,
} from "@zimo/domain";

interface PendingEntry {
  view: PendingUserQuestion;
  ownerId: string;
  accept(answer: UserQuestionAnswer): boolean;
  finish(
    answers: readonly UserQuestionAnswer[] | null,
    reason?: "cancelled" | "expired" | "unavailable",
  ): boolean;
}

export class UserQuestionService {
  private readonly pending = new Map<string, PendingEntry>();

  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly ttlMs = 30 * 60_000,
  ) {}

  listPending(conversationId: string, ownerId: string): readonly PendingUserQuestion[] {
    return [...this.pending.values()]
      .filter((entry) => entry.ownerId === ownerId && entry.view.conversationId === conversationId)
      .map((entry) => entry.view);
  }

  async ask(input: {
    rawQuestions: Readonly<Record<string, unknown>>;
    conversationId: string;
    runId: string;
    ownerId: string;
    signal: AbortSignal;
    emit(event: AgentStreamEvent): void;
  }): Promise<{ answers: readonly UserQuestionAnswer[] }> {
    const parsed = userQuestionBatchSchema.safeParse(input.rawQuestions);
    if (!parsed.success)
      throw new AppError({
        code: "USER_QUESTION_INVALID",
        category: "user",
        userMessage: "模型提交的问题格式不正确。",
      });
    if (input.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const questions: readonly UserQuestion[] = parsed.data.questions;
    const expiresAt = new Date(this.clock.now().getTime() + this.ttlMs).toISOString();
    return new Promise((resolve, reject) => {
      let settled = false;
      let currentView: PendingUserQuestion | undefined;
      const answers: UserQuestionAnswer[] = [];
      const clearCurrent = (): void => {
        if (!currentView) return;
        this.pending.delete(currentView.questionId);
        input.emit({ type: "question.resolved", questionId: currentView.questionId });
        currentView = undefined;
      };
      const finish = (
        completedAnswers: readonly UserQuestionAnswer[] | null,
        reason: "cancelled" | "expired" | "unavailable" = "cancelled",
      ): boolean => {
        if (settled) return false;
        settled = true;
        clearTimeout(timer);
        input.signal.removeEventListener("abort", onAbort);
        clearCurrent();
        if (completedAnswers) resolve({ answers: completedAnswers });
        else if (reason === "cancelled") reject(new DOMException("Aborted", "AbortError"));
        else
          reject(
            new AppError({
              code: reason === "expired" ? "USER_QUESTION_EXPIRED" : "USER_QUESTION_UNAVAILABLE",
              category: "user",
              userMessage:
                reason === "expired"
                  ? "等待回答已超时，请重新发送指令。"
                  : "提问窗口已关闭，请重新发送指令。",
            }),
          );
        return true;
      };
      const publish = (questionIndex: number): void => {
        const currentQuestion = questions[questionIndex];
        if (!currentQuestion) return;
        const view: PendingUserQuestion = {
          questionId: this.ids.create(),
          conversationId: input.conversationId,
          runId: input.runId,
          questionNumber: questionIndex + 1,
          questionCount: questions.length,
          questions: [currentQuestion],
          expiresAt,
        };
        currentView = view;
        const accept = (answer: UserQuestionAnswer): boolean => {
          if (settled || currentView?.questionId !== view.questionId) return false;
          clearCurrent();
          answers.push(answer);
          const nextIndex = questionIndex + 1;
          if (nextIndex < questions.length) publish(nextIndex);
          else finish(answers);
          return true;
        };
        this.pending.set(view.questionId, { view, ownerId: input.ownerId, accept, finish });
        input.emit({ type: "question.requested", question: view });
      };
      const onAbort = () => finish(null);
      const timer = setTimeout(() => finish(null, "expired"), this.ttlMs);
      input.signal.addEventListener("abort", onAbort, { once: true });
      publish(0);
      if (input.signal.aborted) onAbort();
    });
  }

  answer(input: {
    questionId: string;
    ownerId: string;
    answers: readonly UserQuestionAnswer[];
  }): boolean {
    const entry = this.pending.get(input.questionId);
    if (!entry || entry.ownerId !== input.ownerId) return false;
    if (Date.parse(entry.view.expiresAt) <= this.clock.now().getTime()) {
      entry.finish(null, "expired");
      return false;
    }
    const parsed = userQuestionAnswerSchema.array().length(1).safeParse(input.answers);
    const question = entry.view.questions[0];
    const answer = parsed.success ? parsed.data[0] : undefined;
    if (!question || !answer || answer.id !== question.id) return false;
    const allowed = new Set(question.options.map((option) => option.label));
    if (
      new Set(answer.selected).size !== answer.selected.length ||
      answer.selected.some((label) => !allowed.has(label))
    )
      return false;
    if (!question.multiSelect && answer.selected.length > 1) return false;
    if (!question.multiSelect && answer.custom && answer.selected.length > 0) return false;
    if (answer.selected.length === 0 && !answer.custom) return false;
    return entry.accept(answer);
  }

  cancelOwner(ownerId: string): void {
    for (const entry of [...this.pending.values()]) {
      if (entry.ownerId === ownerId) entry.finish(null, "unavailable");
    }
  }
}
