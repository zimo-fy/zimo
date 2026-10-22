import type { ApprovalService } from "@zimo/application";
import {
  IPC_CHANNELS,
  approvalListPendingRequestSchema,
  approvalResolveRequestSchema,
  approvalResolveResultSchema,
  pendingApprovalViewSchema,
} from "@zimo/contracts";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerApprovalIpcHandlers(
  register: RegisterIpcHandler,
  approvals: ApprovalService,
): void {
  register({
    channel: IPC_CHANNELS.approvalListPending,
    input: approvalListPendingRequestSchema,
    output: pendingApprovalViewSchema.array(),
    handle: ({ payload }, event) => [
      ...approvals.listPending(payload.conversationId, String(event.sender.id)),
    ],
  });
  register({
    channel: IPC_CHANNELS.approvalResolve,
    input: approvalResolveRequestSchema,
    output: approvalResolveResultSchema,
    handle: async ({ payload }, event) => ({
      accepted: await approvals.resolve({
        ...payload,
        ownerId: String(event.sender.id),
      }),
    }),
  });
}
