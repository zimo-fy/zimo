import {
  connectMcpRequestSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  ipcResultSchema,
  mcpConnectionViewSchema,
  mcpProbeViewSchema,
  mcpServerRequestSchema,
  successViewSchema,
  type McpDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer } from "electron";

export const mcpApi: McpDesktopApi = {
  list: async (requestId) => {
    const request = emptyRequestSchema.parse({ requestId, payload: {} });
    return ipcResultSchema(mcpConnectionViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.mcpList, request),
    );
  },
  probe: async (requestId, input) => {
    const request = connectMcpRequestSchema.parse({ requestId, payload: input });
    return ipcResultSchema(mcpProbeViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.mcpProbe, request),
    );
  },
  connect: async (requestId, input) => {
    const request = connectMcpRequestSchema.parse({ requestId, payload: input });
    return ipcResultSchema(mcpConnectionViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.mcpConnect, request),
    );
  },
  refresh: async (requestId, serverId) => {
    const request = mcpServerRequestSchema.parse({ requestId, payload: { serverId } });
    return ipcResultSchema(mcpConnectionViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.mcpRefresh, request),
    );
  },
  disconnect: async (requestId, serverId) => {
    const request = mcpServerRequestSchema.parse({ requestId, payload: { serverId } });
    return ipcResultSchema(successViewSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.mcpDisconnect, request),
    );
  },
};
