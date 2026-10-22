import type {
  KnowledgeCloudSyncService,
  KnowledgeDirectoryCatalogService,
  KnowledgeService,
  PrototypeCatalogService,
} from "@zimo/application";
import {
  embeddingModelViewSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  knowledgeBaseIdRequestSchema,
  knowledgeDeleteDocumentRequestSchema,
  knowledgeDocumentViewSchema,
  knowledgeDroppedImportRequestSchema,
  knowledgeImportResultViewSchema,
  knowledgeSearchHitViewSchema,
  knowledgeSearchRequestSchema,
  remoteKnowledgeDirectoryCatalogViewSchema,
  knowledgeCloudDirectoryBindingViewSchema,
  knowledgeCloudSyncDirectoryRequestSchema,
  knowledgeCloudSyncResultViewSchema,
  prototypeGetRequestSchema,
  prototypeDetailViewSchema,
  prototypeListRequestSchema,
  prototypeMutationRequestSchema,
  prototypeSummaryViewSchema,
  routeTargetListRequestSchema,
  routeTargetViewSchema,
  successViewSchema,
} from "@zimo/contracts";
import type { StructuredLogger } from "@zimo/logging";
import { BrowserWindow, dialog } from "electron";

import {
  toKnowledgeDocumentView,
  toPrototypeSummaryView,
  toPrototypeView,
  toRemoteKnowledgeDirectoryCatalogView,
} from "./catalog-view-mappers";
import type { RegisterIpcHandler } from "./ipc-handler";

export function registerPrototypeKnowledgeIpcHandlers(
  register: RegisterIpcHandler,
  options: {
    prototypes: PrototypeCatalogService;
    knowledge: KnowledgeService;
    knowledgeDirectoryCatalog: KnowledgeDirectoryCatalogService;
    knowledgeCloudSync: KnowledgeCloudSyncService;
    logger: StructuredLogger | null;
  },
): void {
  register({
    channel: IPC_CHANNELS.prototypeList,
    input: prototypeListRequestSchema,
    output: prototypeSummaryViewSchema.array(),
    handle: async ({ payload }) =>
      (await options.prototypes.list(payload.kind, payload.query, payload.status)).map(
        toPrototypeSummaryView,
      ),
  });
  register({
    channel: IPC_CHANNELS.prototypeGet,
    input: prototypeGetRequestSchema,
    output: prototypeDetailViewSchema,
    handle: async ({ payload }) =>
      toPrototypeView(await options.prototypes.get(payload.kind, payload.id)),
  });
  register({
    channel: IPC_CHANNELS.prototypeMutate,
    input: prototypeMutationRequestSchema,
    output: prototypeDetailViewSchema,
    handle: async ({ payload }) => {
      const result =
        payload.action === "delete" && payload.kind === "knowledge"
          ? await options.knowledge.deleteKnowledgeBase(payload.id)
          : await options.prototypes.mutate(payload);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: `prototype.${payload.action}`,
        message: "Prototype state changed",
        context: { [`${payload.kind}Id`]: result.id, outcome: "success" },
      });
      return toPrototypeView(result);
    },
  });
  register({
    channel: IPC_CHANNELS.knowledgeListDocuments,
    input: knowledgeBaseIdRequestSchema,
    output: knowledgeDocumentViewSchema.array(),
    handle: async ({ payload }) =>
      (await options.knowledge.listDocuments(payload.knowledgeBaseId)).map(toKnowledgeDocumentView),
  });
  register({
    channel: IPC_CHANNELS.knowledgeImportSelected,
    input: knowledgeBaseIdRequestSchema,
    output: knowledgeImportResultViewSchema.nullable(),
    handle: async ({ payload }, event) => {
      const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const dialogOptions = {
        title: "选择知识库文件",
        properties: ["openFile", "multiSelections"] as ("openFile" | "multiSelections")[],
        filters: [
          {
            name: "支持的知识文件",
            extensions: [
              "txt",
              "md",
              "markdown",
              "html",
              "htm",
              "json",
              "csv",
              "pdf",
              "docx",
              "xlsx",
              "pptx",
              "rtf",
              "odt",
              "ods",
              "odp",
              "epub",
            ],
          },
        ],
      };
      const selection = parent
        ? await dialog.showOpenDialog(parent, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
      if (selection.canceled || selection.filePaths.length === 0) return null;
      const result = await options.knowledge.importFiles(
        payload.knowledgeBaseId,
        selection.filePaths,
      );
      return {
        imported: result.imported.map(toKnowledgeDocumentView),
        duplicates: result.duplicates.map(toKnowledgeDocumentView),
      };
    },
  });
  register({
    channel: IPC_CHANNELS.knowledgeImportDropped,
    input: knowledgeDroppedImportRequestSchema,
    output: knowledgeImportResultViewSchema,
    handle: async ({ payload }) => {
      const result = await options.knowledge.importFiles(
        payload.knowledgeBaseId,
        payload.sourcePaths,
      );
      return {
        imported: result.imported.map(toKnowledgeDocumentView),
        duplicates: result.duplicates.map(toKnowledgeDocumentView),
      };
    },
  });
  register({
    channel: IPC_CHANNELS.knowledgeDeleteDocument,
    input: knowledgeDeleteDocumentRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.knowledge.deleteDocument(payload.knowledgeBaseId, payload.documentId);
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.knowledgeSearch,
    input: knowledgeSearchRequestSchema,
    output: knowledgeSearchHitViewSchema.array(),
    handle: ({ payload }) =>
      options.knowledge.search(payload.knowledgeBaseId, payload.query, payload.limit),
  });
  register({
    channel: IPC_CHANNELS.knowledgeGetEmbeddingModel,
    input: emptyRequestSchema,
    output: embeddingModelViewSchema,
    handle: () => options.knowledge.getEmbeddingModelStatus(),
  });
  register({
    channel: IPC_CHANNELS.knowledgeListRemoteDirectoryCatalog,
    input: emptyRequestSchema,
    output: remoteKnowledgeDirectoryCatalogViewSchema,
    handle: async () => {
      const startedAt = performance.now();
      const catalog = await options.knowledgeDirectoryCatalog.listTree();
      options.logger?.log({
        level: "info",
        category: "knowledge",
        event: "knowledge.remote_catalog.listed",
        message: "Remote knowledge directory catalog listed",
        context: {
          durationMs: Math.round(performance.now() - startedAt),
          directoryCount: catalog.directories.length,
          uncategorizedCount: catalog.uncategorizedDocuments.length,
          outcome: "success",
        },
      });
      return toRemoteKnowledgeDirectoryCatalogView(catalog);
    },
  });
  register({
    channel: IPC_CHANNELS.knowledgeListCloudSyncBindings,
    input: emptyRequestSchema,
    output: knowledgeCloudDirectoryBindingViewSchema.array(),
    handle: () => options.knowledgeCloudSync.listBindings(),
  });
  register({
    channel: IPC_CHANNELS.knowledgeSyncCloudDirectory,
    input: knowledgeCloudSyncDirectoryRequestSchema,
    output: knowledgeCloudSyncResultViewSchema,
    handle: ({ payload }) =>
      options.knowledgeCloudSync.syncDirectory(payload.catalogDirectoryId, payload.mode),
  });
  register({
    channel: IPC_CHANNELS.routerListTargets,
    input: routeTargetListRequestSchema,
    output: routeTargetViewSchema.array(),
    handle: async ({ payload }) => [...(await options.prototypes.listRouteTargets(payload.type))],
  });
}
