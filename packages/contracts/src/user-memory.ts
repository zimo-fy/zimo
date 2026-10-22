import { z } from "zod";

export const userMemoryKindSchema = z.enum(["preference", "goal", "open_issue"]);
export const userMemoryViewSchema = z
  .object({
    id: z.uuid(),
    kind: userMemoryKindSchema,
    content: z.string().min(1).max(500),
    enabled: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type UserMemoryView = z.infer<typeof userMemoryViewSchema>;

export const saveUserMemoryInputSchema = z
  .object({
    id: z.uuid().optional(),
    kind: userMemoryKindSchema,
    content: z.string().trim().min(1).max(500),
    enabled: z.boolean(),
  })
  .strict();
export type SaveUserMemoryInput = z.infer<typeof saveUserMemoryInputSchema>;
