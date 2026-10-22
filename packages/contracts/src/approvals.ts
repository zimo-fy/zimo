import { z } from "zod";

import type { IpcResult } from "./index";
import { approvalRequestedSchema } from "./conversation-stream";

const request = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const pendingApprovalViewSchema = z
  .object({
    runId: z.uuid(),
    event: approvalRequestedSchema,
  })
  .strict();
export type PendingApprovalView = z.infer<typeof pendingApprovalViewSchema>;

export const approvalListPendingRequestSchema = request(
  z.object({ conversationId: z.uuid() }).strict(),
);
export const approvalResolveRequestSchema = request(
  z
    .object({
      approvalId: z.uuid(),
      actionDigest: z.string().regex(/^[a-f0-9]{64}$/),
      decision: z.enum(["allowed_once", "denied"]),
    })
    .strict(),
);
export const approvalResolveResultSchema = z.object({ accepted: z.boolean() }).strict();

export interface ApprovalsDesktopApi {
  listPending(requestId: string, conversationId: string): Promise<IpcResult<PendingApprovalView[]>>;
  resolve(
    requestId: string,
    approvalId: string,
    actionDigest: string,
    decision: "allowed_once" | "denied",
  ): Promise<IpcResult<{ accepted: boolean }>>;
}
