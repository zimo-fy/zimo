import {
  IPC_CHANNELS,
  ipcResultSchema,
  securityAuditEventViewSchema,
  securityAuditListRequestSchema,
  type SecurityAuditDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer } from "electron";

export const securityAuditApi: SecurityAuditDesktopApi = {
  list: async (requestId, input = { limit: 100 }) => {
    const request = securityAuditListRequestSchema.parse({ requestId, payload: input });
    return ipcResultSchema(securityAuditEventViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.securityAuditList, request),
    );
  },
};
