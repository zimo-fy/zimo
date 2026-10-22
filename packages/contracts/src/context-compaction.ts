import { z } from "zod";

export const contextCompactionStatusSchema = z.enum(["running", "completed", "failed"]);
export const contextCompactionTriggerSchema = z.enum(["threshold", "overflow_recovery", "manual"]);

export const contextCompactionViewSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    version: z.number().int().positive(),
    status: contextCompactionStatusSchema,
    trigger: contextCompactionTriggerSchema,
    sourceFromMessageId: z.uuid(),
    sourceToMessageId: z.uuid(),
    coveredThroughPosition: z.number().int().nonnegative(),
    retainedFromPosition: z.number().int().nonnegative(),
    summary: z.string().min(1).max(200_000).optional(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative().optional(),
    errorCode: z.string().min(1).max(80).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type ContextCompactionView = z.infer<typeof contextCompactionViewSchema>;
