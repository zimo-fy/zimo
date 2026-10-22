import { z } from "zod";

export const logLevelSchema = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]);

export const appSettingsViewSchema = z
  .object({
    appearance: z.literal("light"),
    logLevel: logLevelSchema,
    reduceMotion: z.boolean(),
  })
  .strict();
export type AppSettingsView = z.infer<typeof appSettingsViewSchema>;

export const updateSettingsInputSchema = appSettingsViewSchema.partial().strict();
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

export const appInfoViewSchema = z
  .object({
    name: z.literal("Zimo"),
    version: z.string().min(1),
    platform: z.enum(["darwin", "win32", "linux"]),
    dataLocationLabel: z.string().min(1),
    phase: z.literal("Phase 10"),
  })
  .strict();
export type AppInfoView = z.infer<typeof appInfoViewSchema>;

export const secretStoreStatusViewSchema = z
  .object({
    available: z.boolean(),
    backend: z.string().min(1),
    persistent: z.boolean(),
    reason: z.string().max(300).optional(),
  })
  .strict();
export type SecretStoreStatusView = z.infer<typeof secretStoreStatusViewSchema>;
