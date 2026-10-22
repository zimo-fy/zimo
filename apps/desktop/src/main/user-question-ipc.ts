import type { UserQuestionService } from "@zimo/application";
import {
  IPC_CHANNELS,
  pendingUserQuestionSchema,
  userQuestionAnswerRequestSchema,
  userQuestionAnswerResultSchema,
  userQuestionListPendingRequestSchema,
} from "@zimo/contracts";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerUserQuestionIpcHandlers(
  register: RegisterIpcHandler,
  questions: UserQuestionService,
): void {
  register({
    channel: IPC_CHANNELS.userQuestionsListPending,
    input: userQuestionListPendingRequestSchema,
    output: pendingUserQuestionSchema.array(),
    handle: ({ payload }, event) =>
      questions.listPending(payload.conversationId, String(event.sender.id)).map((item) => ({
        ...item,
        questions: item.questions.map((question) => ({
          ...question,
          options: [...question.options],
        })),
      })),
  });
  register({
    channel: IPC_CHANNELS.userQuestionsAnswer,
    input: userQuestionAnswerRequestSchema,
    output: userQuestionAnswerResultSchema,
    handle: ({ payload }, event) => ({
      accepted: questions.answer({
        questionId: payload.questionId,
        ownerId: String(event.sender.id),
        answers: payload.answers,
      }),
    }),
  });
}
