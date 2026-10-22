import { z } from "zod";

export const setConversationPinnedInputSchema = z
  .object({ conversationId: z.uuid(), pinned: z.boolean() })
  .strict();

export const setConversationPinnedRequestSchema = z
  .object({ requestId: z.uuid(), payload: setConversationPinnedInputSchema })
  .strict();
