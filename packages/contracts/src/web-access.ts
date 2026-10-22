import { z } from "zod";

import type { IpcResult } from "./index";

export const webSearchProviderSchema = z.enum(["brave", "tavily", "searxng", "model_native"]);
export const webSearchConfigurationViewSchema = z
  .object({
    enabled: z.boolean(),
    provider: webSearchProviderSchema,
    baseUrl: z.string().max(2_000),
    hasApiKey: z.boolean(),
  })
  .strict();
export type WebSearchConfigurationView = z.infer<typeof webSearchConfigurationViewSchema>;

export const saveWebSearchConfigurationInputSchema = z
  .object({
    enabled: z.boolean(),
    provider: webSearchProviderSchema,
    baseUrl: z.string().trim().max(2_000).optional(),
    apiKey: z.string().trim().min(1).max(4_096).optional(),
  })
  .strict();
export type SaveWebSearchConfigurationInput = z.infer<typeof saveWebSearchConfigurationInputSchema>;

export const webSearchTestResultSchema = z
  .object({ ok: z.literal(true), latencyMs: z.number().int().nonnegative() })
  .strict();
export type WebSearchTestResult = z.infer<typeof webSearchTestResultSchema>;

const request = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const saveWebSearchConfigurationRequestSchema = request(
  saveWebSearchConfigurationInputSchema,
);

export interface WebAccessDesktopApi {
  getConfiguration(requestId: string): Promise<IpcResult<WebSearchConfigurationView>>;
  testConfiguration(
    requestId: string,
    input: SaveWebSearchConfigurationInput,
  ): Promise<IpcResult<WebSearchTestResult>>;
  saveConfiguration(
    requestId: string,
    input: SaveWebSearchConfigurationInput,
  ): Promise<IpcResult<WebSearchConfigurationView>>;
}
