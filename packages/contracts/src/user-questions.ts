import { z } from "zod";

import type { IpcResult } from "./index";

const request = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const userQuestionSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    header: z.string().trim().min(1).max(40),
    question: z.string().trim().min(1).max(500),
    options: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(80),
            description: z.string().trim().max(200).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(4),
    multiSelect: z.boolean().optional(),
  })
  .strict();

export const userQuestionBatchSchema = z
  .object({ questions: z.array(userQuestionSchema).min(1).max(3) })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const question of value.questions) {
      if (ids.has(question.id)) context.addIssue({ code: "custom", message: "问题 ID 不能重复。" });
      ids.add(question.id);
      if (
        new Set(question.options.map((option) => option.label)).size !== question.options.length
      ) {
        context.addIssue({ code: "custom", message: "选项不能重复。" });
      }
    }
  });

export const userQuestionAnswerSchema = z
  .object({
    id: z.string().min(1).max(40),
    selected: z.array(z.string().min(1).max(80)).max(4),
    custom: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const pendingUserQuestionSchema = z
  .object({
    questionId: z.uuid(),
    conversationId: z.uuid(),
    runId: z.uuid(),
    questionNumber: z.number().int().min(1).max(3),
    questionCount: z.number().int().min(1).max(3),
    questions: z.array(userQuestionSchema).length(1),
    expiresAt: z.iso.datetime(),
  })
  .strict()
  .refine((value) => value.questionNumber <= value.questionCount, {
    message: "当前题号不能大于题目总数。",
  });

export const userQuestionListPendingRequestSchema = request(
  z.object({ conversationId: z.uuid() }).strict(),
);
export const userQuestionAnswerRequestSchema = request(
  z
    .object({ questionId: z.uuid(), answers: z.array(userQuestionAnswerSchema).min(1).max(3) })
    .strict(),
);
export const userQuestionAnswerResultSchema = z.object({ accepted: z.boolean() }).strict();

export type UserQuestionBatch = z.infer<typeof userQuestionBatchSchema>;
export type UserQuestionAnswer = z.infer<typeof userQuestionAnswerSchema>;
export type PendingUserQuestionView = z.infer<typeof pendingUserQuestionSchema>;

export interface UserQuestionsDesktopApi {
  listPending(
    requestId: string,
    conversationId: string,
  ): Promise<IpcResult<PendingUserQuestionView[]>>;
  answer(
    requestId: string,
    questionId: string,
    answers: readonly UserQuestionAnswer[],
  ): Promise<IpcResult<{ accepted: boolean }>>;
}
