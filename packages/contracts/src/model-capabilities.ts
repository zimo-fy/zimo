import { z } from "zod";

export const modelCapabilitiesSchema = z
  .object({
    streaming: z.boolean(),
    toolCalling: z.boolean(),
    structuredOutput: z.boolean(),
    vision: z.boolean(),
    reasoning: z.boolean(),
    promptCaching: z.boolean(),
    maxContextTokens: z.number().int().positive().max(10_000_000).optional(),
  })
  .strict();
