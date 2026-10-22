import type { DocumentArtifactService } from "@zimo/application";
import {
  documentArtifactViewSchema,
  documentExportRequestSchema,
  documentExportResultSchema,
  documentImportDroppedRequestSchema,
  documentImportResultViewSchema,
  documentImportSelectedRequestSchema,
  documentInspectRequestSchema,
  documentDigestViewSchema,
  documentListRequestSchema,
  documentReadRequestSchema,
  documentSliceViewSchema,
  documentRemoveDraftRequestSchema,
  IPC_CHANNELS,
  successViewSchema,
  type DocumentArtifactView,
} from "@zimo/contracts";
import { DOCUMENT_IMPORT_EXTENSIONS, type DocumentArtifact } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import { BrowserWindow, dialog } from "electron";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerDocumentArtifactIpcHandlers(
  register: RegisterIpcHandler,
  options: { documents: DocumentArtifactService; logger: StructuredLogger | null },
): void {
  register({
    channel: IPC_CHANNELS.documentList,
    input: documentListRequestSchema,
    output: documentArtifactViewSchema.array(),
    handle: async ({ payload }) =>
      (await options.documents.list(payload.conversationId)).map(toDocumentArtifactView),
  });
  register({
    channel: IPC_CHANNELS.documentInspect,
    input: documentInspectRequestSchema,
    output: documentDigestViewSchema,
    handle: async ({ payload }) => {
      const result = await options.documents.inspectRevision(
        payload.conversationId,
        payload.artifactId,
        payload.revisionId,
        AbortSignal.timeout(30_000),
      );
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "document.inspect.completed",
        message: "Document structure inspected",
        context: {
          conversationId: payload.conversationId,
          artifactId: payload.artifactId,
          format: result.format,
          unitCount: result.unitCount,
          outcome: "success",
        },
      });
      return result;
    },
  });
  register({
    channel: IPC_CHANNELS.documentRead,
    input: documentReadRequestSchema,
    output: documentSliceViewSchema,
    handle: ({ payload }) =>
      options.documents.read(
        payload.conversationId,
        payload.artifactId,
        {
          ...(payload.pageNumbers ? { pageNumbers: payload.pageNumbers } : {}),
          ...(payload.slideNumbers ? { slideNumbers: payload.slideNumbers } : {}),
          ...(payload.sheetName ? { sheetName: payload.sheetName } : {}),
          ...(payload.cursor === undefined ? {} : { cursor: payload.cursor }),
          ...(payload.maxCharacters === undefined
            ? { maxCharacters: 12_000 }
            : { maxCharacters: payload.maxCharacters }),
        },
        AbortSignal.timeout(30_000),
      ),
  });
  register({
    channel: IPC_CHANNELS.documentImportSelected,
    input: documentImportSelectedRequestSchema,
    output: documentImportResultViewSchema.nullable(),
    handle: async ({ payload }, event) => {
      const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const dialogOptions = {
        title: "添加文件到当前对话",
        properties: ["openFile", "multiSelections"] as ("openFile" | "multiSelections")[],
        filters: [{ name: "文档", extensions: [...DOCUMENT_IMPORT_EXTENSIONS] }],
      };
      const selection = parent
        ? await dialog.showOpenDialog(parent, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
      if (selection.canceled || selection.filePaths.length === 0) return null;
      return importFiles(options, payload.conversationId, selection.filePaths, "picker");
    },
  });
  register({
    channel: IPC_CHANNELS.documentImportDropped,
    input: documentImportDroppedRequestSchema,
    output: documentImportResultViewSchema,
    handle: async ({ payload }) =>
      importFiles(options, payload.conversationId, payload.sourcePaths, "drop"),
  });
  register({
    channel: IPC_CHANNELS.documentRemoveDraft,
    input: documentRemoveDraftRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.documents.removeDraft(payload.conversationId, payload.artifactId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "document.draft.removed",
        message: "Draft document artifact removed",
        context: { conversationId: payload.conversationId, artifactId: payload.artifactId },
      });
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.documentExport,
    input: documentExportRequestSchema,
    output: documentExportResultSchema,
    handle: async ({ payload }, event) => {
      const value = await options.documents.getRevision(
        payload.conversationId,
        payload.artifactId,
        payload.revisionId,
      );
      const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const dialogOptions = { title: "导出文件", defaultPath: value.artifact.displayName };
      const selection = parent
        ? await dialog.showSaveDialog(parent, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      if (selection.canceled || !selection.filePath) return { exported: false };
      await options.documents.exportArtifact(
        payload.conversationId,
        payload.artifactId,
        payload.revisionId,
        selection.filePath,
      );
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "document.export.completed",
        message: "Document artifact exported",
        context: { conversationId: payload.conversationId, artifactId: payload.artifactId },
      });
      return { exported: true };
    },
  });
}

async function importFiles(
  options: { documents: DocumentArtifactService; logger: StructuredLogger | null },
  conversationId: string,
  sourcePaths: readonly string[],
  source: "picker" | "drop",
) {
  const result = await options.documents.importFiles(conversationId, sourcePaths);
  options.logger?.log({
    level: result.rejected.length ? "warn" : "info",
    category: "audit",
    event: "document.import.completed",
    message: "Document artifact import completed",
    context: {
      conversationId,
      source,
      requestedCount: sourcePaths.length,
      importedCount: result.imported.length,
      rejectedCount: result.rejected.length,
      rejectionCodes: result.rejected.map((item) => item.code),
      hadRejections: result.rejected.length > 0,
      outcome: result.rejected.length ? "failure" : "success",
    },
  });
  return toImportResult(result);
}

function toImportResult(result: Awaited<ReturnType<DocumentArtifactService["importFiles"]>>) {
  return {
    imported: result.imported.map(toDocumentArtifactView),
    rejected: result.rejected.map((value) => ({ ...value })),
  };
}

function toDocumentArtifactView(value: DocumentArtifact): DocumentArtifactView {
  return {
    id: value.id,
    conversationId: value.conversationId,
    ...(value.messageId ? { messageId: value.messageId } : {}),
    displayName: value.displayName,
    mediaType: value.mediaType,
    format: value.format,
    sizeBytes: value.messageRevisionSizeBytes ?? value.sizeBytes,
    status: value.status,
    currentRevisionId: value.currentRevisionId,
    revisionId: value.messageRevisionId ?? value.currentRevisionId,
    ...(value.messageRelation ? { relation: value.messageRelation } : {}),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
