import {
  emptyRequestSchema,
  IPC_CHANNELS,
  ipcResultSchema,
  saveWebSearchConfigurationRequestSchema,
  webSearchConfigurationViewSchema,
  webSearchTestResultSchema,
  type WebAccessDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer } from "electron";

export const webAccessApi: WebAccessDesktopApi = {
  getConfiguration: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(webSearchConfigurationViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.webSearchGetConfiguration, request),
    );
  },
  testConfiguration: async (requestId, input) => {
    const request = saveWebSearchConfigurationRequestSchema.parse({ requestId, payload: input });
    return ipcResultSchema(webSearchTestResultSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.webSearchTestConfiguration, request),
    );
  },
  saveConfiguration: async (requestId, input) => {
    const request = saveWebSearchConfigurationRequestSchema.parse({ requestId, payload: input });
    return ipcResultSchema(webSearchConfigurationViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.webSearchSaveConfiguration, request),
    );
  },
};
