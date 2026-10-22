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
  ipcResultSchema,
  successViewSchema,
  type DocumentArtifactsDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer, webUtils } from "electron";

export const documentArtifactApi: DocumentArtifactsDesktopApi = {
  list: async (requestId, conversationId) => {
    const request = documentListRequestSchema.parse({ requestId, payload: { conversationId } });
    return ipcResultSchema(documentArtifactViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.documentList, request),
    );
  },
  select: async (requestId, conversationId) => {
    const request = documentImportSelectedRequestSchema.parse({
      requestId,
      payload: { conversationId },
    });
    return ipcResultSchema(documentImportResultViewSchema.nullable()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.documentImportSelected, request),
    );
  },
  importDropped: async (requestId, conversationId, files) => {
    const sourcePaths = files
      .slice(0, 10)
      .map((file) =>
        webUtils.getPathForFile(file as Parameters<typeof webUtils.getPathForFile>[0]),
      );
    const request = documentImportDroppedRequestSchema.parse({
      requestId,
      payload: { conversationId, sourcePaths },
    });
    return ipcResultSchema(documentImportResultViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.documentImportDropped, request),
    );
  },
  removeDraft: async (requestId, conversationId, artifactId) => {
    const request = documentRemoveDraftRequestSchema.parse({
      requestId,
      payload: { conversationId, artifactId },
    });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.documentRemoveDraft, request),
    );
  },
  export: async (requestId, conversationId, artifactId, revisionId) => {
    const request = documentExportRequestSchema.parse({
      requestId,
      payload: { conversationId, artifactId, revisionId },
    });
    return ipcResultSchema(documentExportResultSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.documentExport, request),
    );
  },
  inspect: async (requestId, conversationId, artifactId, revisionId) => {
    const request = documentInspectRequestSchema.parse({
      requestId,
      payload: { conversationId, artifactId, revisionId },
    });
    return ipcResultSchema(documentDigestViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.documentInspect, request),
    );
  },
  read: async (requestId, conversationId, artifactId, selector = {}) => {
    const request = documentReadRequestSchema.parse({
      requestId,
      payload: { conversationId, artifactId, ...selector },
    });
    return ipcResultSchema(documentSliceViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.documentRead, request),
    );
  },
};
