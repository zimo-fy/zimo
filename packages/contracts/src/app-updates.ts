import { z } from "zod";

import type { IpcResult } from "./index";

export const appUpdateStatusSchema = z.enum([
  "disabled",
  "idle",
  "checking",
  "downloading",
  "ready",
  "up-to-date",
  "error",
]);

export const appUpdateStateViewSchema = z
  .object({
    status: appUpdateStatusSchema,
    currentVersion: z.string().min(1).max(64),
    availableVersion: z.string().min(1).max(64).optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    releaseNotes: z.string().max(8_000).optional(),
    errorMessage: z.string().min(1).max(300).optional(),
    userInitiated: z.boolean(),
  })
  .strict();

export type AppUpdateStateView = z.infer<typeof appUpdateStateViewSchema>;

export interface AppUpdatesDesktopApi {
  getState(requestId: string): Promise<IpcResult<AppUpdateStateView>>;
  check(requestId: string): Promise<IpcResult<AppUpdateStateView>>;
  install(requestId: string): Promise<IpcResult<{ success: true }>>;
  onState(listener: (state: AppUpdateStateView) => void): () => void;
}
