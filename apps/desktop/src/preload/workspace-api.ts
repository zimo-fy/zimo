import {
  IPC_CHANNELS,
  ipcResultSchema,
  successViewSchema,
  workspaceAttachDroppedRequestSchema,
  workspaceAuthorizationListRequestSchema,
  workspaceAuthorizationRevokeRequestSchema,
  workspaceAuthorizationViewSchema,
  workspaceChangeModeRequestSchema,
  workspaceGrantViewSchema,
  workspaceListRequestSchema,
  workspaceRemoveRequestSchema,
  workspaceSelectRequestSchema,
  type WorkspacesDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer, webUtils } from "electron";

export const workspaceApi: WorkspacesDesktopApi = {
  list: async (requestId, conversationId) => {
    const request = workspaceListRequestSchema.parse({ requestId, payload: { conversationId } });
    return ipcResultSchema(workspaceGrantViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.workspaceList, request),
    );
  },
  select: async (requestId, conversationId) => {
    const request = workspaceSelectRequestSchema.parse({ requestId, payload: { conversationId } });
    return ipcResultSchema(workspaceGrantViewSchema.nullable()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.workspaceSelect, request),
    );
  },
  attachDropped: async (requestId, conversationId, file) => {
    const sourcePath = webUtils.getPathForFile(
      file as Parameters<typeof webUtils.getPathForFile>[0],
    );
    const request = workspaceAttachDroppedRequestSchema.parse({
      requestId,
      payload: { conversationId, sourcePath },
    });
    return ipcResultSchema(workspaceGrantViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.workspaceAttachDropped, request),
    );
  },
  remove: async (requestId, conversationId, workspaceId) => {
    const request = workspaceRemoveRequestSchema.parse({
      requestId,
      payload: { conversationId, workspaceId },
    });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.workspaceRemove, request),
    );
  },
  changeMode: async (requestId, conversationId, mode) => {
    const request = workspaceChangeModeRequestSchema.parse({
      requestId,
      payload: { conversationId, mode },
    });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.workspaceChangeMode, request),
    );
  },
  listAuthorizations: async (requestId) => {
    const request = workspaceAuthorizationListRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(workspaceAuthorizationViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.workspaceAuthorizationList, request),
    );
  },
  revokeAuthorization: async (requestId, authorizationId) => {
    const request = workspaceAuthorizationRevokeRequestSchema.parse({
      requestId,
      payload: { authorizationId },
    });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.workspaceAuthorizationRevoke, request),
    );
  },
};
