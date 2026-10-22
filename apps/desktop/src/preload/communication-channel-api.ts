import {
  bindEmailChannelRequestSchema,
  cancelWeixinLoginRequestSchema,
  communicationChannelViewSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  ipcResultSchema,
  pollWeixinLoginRequestSchema,
  successViewSchema,
  unbindCommunicationChannelRequestSchema,
  weixinLoginStartViewSchema,
  weixinLoginStatusViewSchema,
  type CommunicationChannelsDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer } from "electron";

export const communicationChannelsApi: CommunicationChannelsDesktopApi = {
  list: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(communicationChannelViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.communicationChannelsList, request),
    );
  },
  bindEmail: async (requestId, input) => {
    const request = bindEmailChannelRequestSchema.parse({ requestId, payload: input });
    return ipcResultSchema(communicationChannelViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.communicationChannelsBindEmail, request),
    );
  },
  startWeixin: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(weixinLoginStartViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.communicationChannelsStartWeixin, request),
    );
  },
  pollWeixin: async (requestId, sessionId, verifyCode) => {
    const request = pollWeixinLoginRequestSchema.parse({
      requestId,
      payload: { sessionId, ...(verifyCode ? { verifyCode } : {}) },
    });
    return ipcResultSchema(weixinLoginStatusViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.communicationChannelsPollWeixin, request),
    );
  },
  cancelWeixin: async (requestId, sessionId) => {
    const request = cancelWeixinLoginRequestSchema.parse({ requestId, payload: { sessionId } });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.communicationChannelsCancelWeixin, request),
    );
  },
  unbind: async (requestId, kind) => {
    const request = unbindCommunicationChannelRequestSchema.parse({
      requestId,
      payload: { kind },
    });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.communicationChannelsUnbind, request),
    );
  },
  sendWeixinTest: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.communicationChannelsSendWeixinTest, request),
    );
  },
};
