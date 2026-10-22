import type {
  ModelCatalogService,
  ModelConfigurationService,
  WebAccessService,
} from "@zimo/application";
import {
  catalogModelViewSchema,
  defaultModelViewSchema,
  deleteProviderRequestSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  modelProviderViewSchema,
  modelTestResultSchema,
  saveProviderRequestSchema,
  setDefaultModelRequestSchema,
  successViewSchema,
  testProviderRequestSchema,
} from "@zimo/contracts";
import type { StructuredLogger } from "@zimo/logging";

import { toProviderView } from "./catalog-view-mappers";
import type { RegisterIpcHandler } from "./ipc-handler";

export function registerModelIpcHandlers(
  register: RegisterIpcHandler,
  options: {
    models: ModelConfigurationService;
    catalog: ModelCatalogService;
    webAccess: WebAccessService;
    logger: StructuredLogger | null;
  },
): void {
  register({
    channel: IPC_CHANNELS.modelsList,
    input: emptyRequestSchema,
    output: modelProviderViewSchema.array(),
    handle: async () => (await options.models.list()).map(toProviderView),
  });
  register({
    channel: IPC_CHANNELS.modelsListCatalog,
    input: emptyRequestSchema,
    output: catalogModelViewSchema.array(),
    handle: async () => {
      const startedAt = performance.now();
      const entries = await options.catalog.list();
      options.logger?.log({
        level: "info",
        category: "model",
        event: "model.catalog.listed",
        message: "Cloud model catalog listed",
        context: {
          durationMs: Math.round(performance.now() - startedAt),
          modelCount: entries.length,
          outcome: "success",
        },
      });
      return entries.map((entry) => ({ ...entry }));
    },
  });
  register({
    channel: IPC_CHANNELS.modelsSaveProvider,
    input: saveProviderRequestSchema,
    output: modelProviderViewSchema,
    handle: async ({ payload }) => {
      const saved = await options.models.save(payload);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: payload.providerId ? "model.provider.updated" : "model.provider.created",
        message: "Model provider configuration saved",
        context: { providerId: saved.provider.id, outcome: "success" },
      });
      return toProviderView(saved);
    },
  });
  register({
    channel: IPC_CHANNELS.modelsDeleteProvider,
    input: deleteProviderRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.models.delete(payload.providerId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "model.provider.deleted",
        message: "Model provider configuration deleted",
        context: { providerId: payload.providerId, outcome: "success" },
      });
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.modelsTestProvider,
    input: testProviderRequestSchema,
    output: modelTestResultSchema,
    handle: async ({ payload }) => {
      if (payload.mode === "native_search") {
        const result = await options.webAccess.testNativeSearch(
          await options.models.getSavedConnection(payload.providerId),
        );
        options.logger?.log({
          level: "info",
          category: "model",
          event: "model.native_search.tested",
          message: "Model native search test completed",
          context: {
            durationMs: result.latencyMs,
            sourceCount: result.sourceCount,
            errorCount: result.errorCount,
            outcome: "success",
          },
        });
        return { ok: true as const, ...result };
      }
      const startedAt = performance.now();
      await options.models.test(
        payload.mode === "saved"
          ? { providerId: payload.providerId }
          : {
              baseUrl: payload.baseUrl,
              apiKey: payload.apiKey,
              modelName: payload.modelName,
            },
      );
      const latencyMs = Math.round(performance.now() - startedAt);
      options.logger?.log({
        level: "info",
        category: "model",
        event: "model.connection.tested",
        message: "Model connection test completed",
        context: { durationMs: latencyMs, outcome: "success" },
      });
      return { ok: true as const, latencyMs };
    },
  });
  register({
    channel: IPC_CHANNELS.modelsGetDefault,
    input: emptyRequestSchema,
    output: defaultModelViewSchema,
    handle: async () => ({ modelId: await options.models.getDefaultModelId() }),
  });
  register({
    channel: IPC_CHANNELS.modelsSetDefault,
    input: setDefaultModelRequestSchema,
    output: defaultModelViewSchema,
    handle: async ({ payload }) => {
      const modelId = await options.models.setDefault(payload.modelId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "model.default.changed",
        message: "Default model changed",
        context: { outcome: "success" },
      });
      return { modelId };
    },
  });
}
