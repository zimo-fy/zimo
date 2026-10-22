import {
  IPC_CHANNELS,
  approvalListPendingRequestSchema,
  approvalResolveRequestSchema,
  approvalResolveResultSchema,
  ipcResultSchema,
  pendingApprovalViewSchema,
  type ApprovalsDesktopApi,
} from "@zimo/contracts";
import { ipcRenderer } from "electron";

export const approvalApi: ApprovalsDesktopApi = {
  listPending: async (requestId, conversationId) => {
    const request = approvalListPendingRequestSchema.parse({
      requestId,
      payload: { conversationId },
    });
    return ipcResultSchema(pendingApprovalViewSchema.array()).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.approvalListPending, request),
    );
  },
  resolve: async (requestId, approvalId, actionDigest, decision) => {
    const request = approvalResolveRequestSchema.parse({
      requestId,
      payload: { approvalId, actionDigest, decision },
    });
    return ipcResultSchema(approvalResolveResultSchema).parse(
      await ipcRenderer.invoke(IPC_CHANNELS.approvalResolve, request),
    );
  },
};
