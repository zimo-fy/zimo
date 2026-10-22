import {
  automationDeleteRequestSchema,
  automationDetailViewSchema,
  automationGetRequestSchema,
  automationListRequestSchema,
  automationRunAcceptedSchema,
  automationRunNowRequestSchema,
  automationSaveRequestSchema,
  automationSetEnabledRequestSchema,
  automationSummaryViewSchema,
  automationTaskListChangedSchema,
  IPC_CHANNELS,
  ipcResultSchema,
  successViewSchema,
  type AutomationDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer, type IpcRendererEvent } from "electron";

export const automationApi: AutomationDesktopApi = {
  list: async (requestId) => {
    const request = automationListRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(automationSummaryViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.automationsList, request),
    );
  },
  get: async (requestId, id) => {
    const request = automationGetRequestSchema.parse({ requestId, payload: { id } });
    return ipcResultSchema(automationDetailViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.automationsGet, request),
    );
  },
  save: async (requestId, input) => {
    const request = automationSaveRequestSchema.parse({ requestId, payload: input });
    return ipcResultSchema(automationDetailViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.automationsSave, request),
    );
  },
  delete: async (requestId, id) => {
    const request = automationDeleteRequestSchema.parse({ requestId, payload: { id } });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.automationsDelete, request),
    );
  },
  setEnabled: async (requestId, id, enabled) => {
    const request = automationSetEnabledRequestSchema.parse({
      requestId,
      payload: { id, enabled },
    });
    return ipcResultSchema(automationSummaryViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.automationsSetEnabled, request),
    );
  },
  runNow: async (requestId, id) => {
    const request = automationRunNowRequestSchema.parse({ requestId, payload: { id } });
    return ipcResultSchema(automationRunAcceptedSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.automationsRunNow, request),
    );
  },
  onTaskListChanged: (listener) => {
    const wrapped = (_event: IpcRendererEvent, raw: unknown) => {
      if (automationTaskListChangedSchema.safeParse(raw).success) listener();
    };
    ipcRenderer.on(IPC_CHANNELS.automationsTaskListChanged, wrapped);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.automationsTaskListChanged, wrapped);
  },
};
