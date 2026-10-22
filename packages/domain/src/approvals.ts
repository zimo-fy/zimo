import type { ConversationId } from "./index";

export type ActionKind =
  "file_read" | "file_write" | "file_delete" | "command" | "network" | "external_app";
export type ActionRisk = "low" | "medium" | "high" | "critical";
export type ActionPolicyMode = "ask" | "auto_approve";
export type ActionPolicyOutcome = "allow" | "ask" | "deny";
export type ApprovalStatus = "pending" | "allowed_once" | "denied" | "expired" | "cancelled";

export interface PlannedAction {
  kind: ActionKind;
  risk: ActionRisk;
  summary: string;
  workspaceId?: string;
  workspaceLabel?: string;
  relativeTarget?: string;
  command?: string;
  reversible: boolean;
  sandboxed: boolean;
}

export interface ActionPolicyDecision {
  outcome: ActionPolicyOutcome;
  ruleId: string;
  policyVersion: string;
}

export interface ApprovalRequest {
  id: string;
  conversationId: ConversationId;
  runId: string;
  toolCallId: string;
  actionKind: ActionKind;
  actionDigest: string;
  risk: Exclude<ActionRisk, "critical">;
  policyVersion: string;
  status: ApprovalStatus;
  expiresAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ApprovalRequestRepository {
  save(request: ApprovalRequest): Promise<void>;
  resolvePending(
    id: string,
    status: Exclude<ApprovalStatus, "pending">,
    at: Date,
  ): Promise<boolean>;
  expirePending(at: Date): Promise<number>;
}
