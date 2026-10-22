import {
  appUpdateStateViewSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  ipcResultSchema,
  successViewSchema,
  type AppUpdatesDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer, type IpcRendererEvent } from "electron";

export const updateApi: AppUpdatesDesktopApi = {
  getState: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(appUpdateStateViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.updatesGetState, request),
    );
  },
  check: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(appUpdateStateViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.updatesCheck, request),
    );
  },
  install: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.updatesInstall, request),
    );
  },
  onState: (listener) => {
    const wrapped = (_event: IpcRendererEvent, raw: unknown) => {
      const parsed = appUpdateStateViewSchema.safeParse(raw);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.updatesState, wrapped);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.updatesState, wrapped);
  },
};
