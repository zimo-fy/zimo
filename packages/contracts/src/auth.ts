import { z } from "zod";

export const loginInputSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .refine((value) =>
        [...value].every((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return codePoint > 31 && codePoint !== 127;
        }),
      ),
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginInputDto = z.infer<typeof loginInputSchema>;

export const authSessionViewSchema = z
  .object({
    id: z.uuid(),
    externalUserId: z.string().min(1).max(128),
    account: z.string().min(1).max(128),
    email: z.email().max(254).optional(),
    displayName: z.string().min(1).max(80),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export type AuthSessionView = z.infer<typeof authSessionViewSchema>;
