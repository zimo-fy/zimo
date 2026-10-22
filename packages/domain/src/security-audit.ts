import type { ActionKind, ActionRisk, ApprovalStatus } from "./approvals";

export type SecurityAuditEventType =
  | "action_policy_allowed"
  | "action_policy_denied"
  | "approval_requested"
  | "approval_resolved"
  | "approval_expired"
  | "approval_cancelled"
  | "tool_execution_started"
  | "tool_execution_completed";

export type SecurityAuditOutcome =
  "allowed" | "denied" | "pending" | "success" | "failure" | "cancelled" | "timed_out";

export interface SecurityAuditEvent {
  id: string;
  eventType: SecurityAuditEventType;
  conversationId?: string;
  runId: string;
  approvalId?: string;
  toolCallId?: string;
  toolId?: string;
  actionKind?: ActionKind;
  risk?: ActionRisk;
  decision?: Exclude<ApprovalStatus, "pending">;
  outcome: SecurityAuditOutcome;
  ruleId?: string;
  errorCode?: string;
  durationMs?: number;
  metadata: Readonly<{
    permissionCount?: number;
    inputKeyCount?: number;
    actionLabel?: string;
    workspaceLabel?: string;
    relativeTarget?: string;
  }>;
  createdAt: Date;
}

export interface SecurityAuditFilter {
  eventType?: SecurityAuditEventType;
  risk?: ActionRisk;
  outcome?: SecurityAuditOutcome;
  before?: Date;
  limit: number;
}

export interface SecurityAuditEventRepository {
  append(event: SecurityAuditEvent): Promise<void>;
  list(filter: SecurityAuditFilter): Promise<readonly SecurityAuditEvent[]>;
}
