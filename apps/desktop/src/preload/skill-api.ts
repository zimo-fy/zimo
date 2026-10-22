import {
  emptyRequestSchema,
  IPC_CHANNELS,
  ipcResultSchema,
  prototypeDetailViewSchema,
  skillCatalogInstallRequestSchema,
  skillCatalogItemViewSchema,
  skillCatalogListRequestSchema,
  skillCatalogUninstallRequestSchema,
  successViewSchema,
  type ZimoDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer } from "electron";

export const skillApi: ZimoDesktopApi["skills"] = {
  listCatalog: async (requestId) => {
    const request = skillCatalogListRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(skillCatalogItemViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.skillCatalogList, request),
    );
  },
  install: async (requestId, catalogId) => {
    const request = skillCatalogInstallRequestSchema.parse({ requestId, payload: { catalogId } });
    return ipcResultSchema(skillCatalogItemViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.skillCatalogInstall, request),
    );
  },
  uninstall: async (requestId, skillId) => {
    const request = skillCatalogUninstallRequestSchema.parse({ requestId, payload: { skillId } });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.skillCatalogUninstall, request),
    );
  },
  installLocal: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(prototypeDetailViewSchema.nullable()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.skillInstallLocal, request),
    );
  },
};
