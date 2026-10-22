import {
  IPC_CHANNELS,
  ipcResultSchema,
  pendingUserQuestionSchema,
  userQuestionAnswerRequestSchema,
  userQuestionAnswerResultSchema,
  userQuestionListPendingRequestSchema,
  type UserQuestionsDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer } from "electron";

export const userQuestionApi: UserQuestionsDesktopApi = {
  listPending: async (requestId, conversationId) => {
    const request = userQuestionListPendingRequestSchema.parse({
      requestId,
      payload: { conversationId },
    });
    return ipcResultSchema(pendingUserQuestionSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.userQuestionsListPending, request),
    );
  },
  answer: async (requestId, questionId, answers) => {
    const request = userQuestionAnswerRequestSchema.parse({
      requestId,
      payload: { questionId, answers },
    });
    return ipcResultSchema(userQuestionAnswerResultSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.userQuestionsAnswer, request),
    );
  },
};
