import { z } from "zod";

import type { IpcResult } from "./index";

export const securityAuditEventTypeSchema = z.enum([
  "action_policy_allowed",
  "action_policy_denied",
  "approval_requested",
  "approval_resolved",
  "approval_expired",
  "approval_cancelled",
  "tool_execution_started",
  "tool_execution_completed",
]);
export const securityAuditOutcomeSchema = z.enum([
  "allowed",
  "denied",
  "pending",
  "success",
  "failure",
  "cancelled",
  "timed_out",
]);
export const securityAuditEventViewSchema = z
  .object({
    id: z.uuid(),
    eventType: securityAuditEventTypeSchema,
    toolId: z.string().min(1).max(300).optional(),
    actionKind: z
      .enum(["file_read", "file_write", "file_delete", "command", "network", "external_app"])
      .optional(),
    risk: z.enum(["low", "medium", "high", "critical"]).optional(),
    decision: z.enum(["allowed_once", "denied", "expired", "cancelled"]).optional(),
    outcome: securityAuditOutcomeSchema,
    errorCode: z.string().min(1).max(100).optional(),
    durationMs: z.number().int().nonnegative().optional(),
    actionLabel: z.string().min(1).max(80).optional(),
    workspaceLabel: z.string().min(1).max(180).optional(),
    relativeTarget: z.string().min(1).max(1_000).optional(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type SecurityAuditEventView = z.infer<typeof securityAuditEventViewSchema>;

export const securityAuditListRequestSchema = z
  .object({
    requestId: z.uuid(),
    payload: z
      .object({
        eventType: securityAuditEventTypeSchema.optional(),
        risk: z.enum(["low", "medium", "high", "critical"]).optional(),
        outcome: securityAuditOutcomeSchema.optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .strict(),
  })
  .strict();
export type SecurityAuditListInput = z.input<typeof securityAuditListRequestSchema>["payload"];

export interface SecurityAuditDesktopApi {
  list(
    requestId: string,
    input?: SecurityAuditListInput,
  ): Promise<IpcResult<SecurityAuditEventView[]>>;
}
