import {
  agentCatalogInstallRequestSchema,
  agentCatalogItemViewSchema,
  agentCatalogListRequestSchema,
  agentCatalogUninstallRequestSchema,
  IPC_CHANNELS,
  ipcResultSchema,
  successViewSchema,
  type ZimoDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer } from "electron";

export const agentApi: ZimoDesktopApi["agents"] = {
  listCatalog: async (requestId) => {
    const request = agentCatalogListRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(agentCatalogItemViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.agentCatalogList, request),
    );
  },
  install: async (requestId, catalogId) => {
    const request = agentCatalogInstallRequestSchema.parse({
      requestId,
      payload: { catalogId },
    });
    return ipcResultSchema(agentCatalogItemViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.agentCatalogInstall, request),
    );
  },
  uninstall: async (requestId, agentId) => {
    const request = agentCatalogUninstallRequestSchema.parse({
      requestId,
      payload: { agentId },
    });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.agentCatalogUninstall, request),
    );
  },
};
