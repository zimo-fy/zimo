import type { WebAccessService } from "@zimo/application";
import {
  emptyRequestSchema,
  IPC_CHANNELS,
  saveWebSearchConfigurationRequestSchema,
  webSearchConfigurationViewSchema,
  webSearchTestResultSchema,
} from "@zimo/contracts";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerWebAccessIpcHandlers(
  register: RegisterIpcHandler,
  service: WebAccessService,
): void {
  register({
    channel: IPC_CHANNELS.webSearchGetConfiguration,
    input: emptyRequestSchema,
    output: webSearchConfigurationViewSchema,
    handle: () => service.getConfiguration(),
  });
  register({
    channel: IPC_CHANNELS.webSearchTestConfiguration,
    input: saveWebSearchConfigurationRequestSchema,
    output: webSearchTestResultSchema,
    handle: async ({ payload }) => ({
      ok: true as const,
      latencyMs: await service.testConfiguration(payload),
    }),
  });
  register({
    channel: IPC_CHANNELS.webSearchSaveConfiguration,
    input: saveWebSearchConfigurationRequestSchema,
    output: webSearchConfigurationViewSchema,
    handle: ({ payload }) => service.saveConfiguration(payload),
  });
}
