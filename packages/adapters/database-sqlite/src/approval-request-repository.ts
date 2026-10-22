import type {
  ActionKind,
  ApprovalRequest,
  ApprovalRequestRepository,
  ApprovalStatus,
  ConversationId,
} from "@zimo/domain";

import type { ZimoDatabase } from "./index";

type ApprovalRow = {
  id: string;
  conversation_id: string;
  run_id: string;
  tool_call_id: string;
  action_kind: ActionKind;
  action_digest: string;
  risk: ApprovalRequest["risk"];
  policy_version: string;
  status: ApprovalStatus;
  expires_at: string;
  resolved_at: string | null;
  created_at: string;
};

export class SQLiteApprovalRequestRepository implements ApprovalRequestRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async save(request: ApprovalRequest): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO approval_requests
          (id, conversation_id, run_id, tool_call_id, action_kind, action_digest, risk,
           policy_version, status, expires_at, resolved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        request.id,
        request.conversationId,
        request.runId,
        request.toolCallId,
        request.actionKind,
        request.actionDigest,
        request.risk,
        request.policyVersion,
        request.status,
        request.expiresAt.toISOString(),
        request.resolvedAt?.toISOString() ?? null,
        request.createdAt.toISOString(),
      );
  }

  async resolvePending(
    id: string,
    status: Exclude<ApprovalStatus, "pending">,
    at: Date,
  ): Promise<boolean> {
    return (
      this.database.sqlite
        .prepare(
          `UPDATE approval_requests SET status = ?, resolved_at = ?
           WHERE id = ? AND status = 'pending'`,
        )
        .run(status, at.toISOString(), id).changes === 1
    );
  }

  async expirePending(at: Date): Promise<number> {
    return Number(
      this.database.sqlite
        .prepare(
          `UPDATE approval_requests SET status = 'expired', resolved_at = ?
         WHERE status = 'pending'`,
        )
        .run(at.toISOString()).changes,
    );
  }

  getById(id: string): ApprovalRequest | null {
    const row = this.database.sqlite
      .prepare("SELECT * FROM approval_requests WHERE id = ?")
      .get(id) as unknown as ApprovalRow | undefined;
    return row ? toApproval(row) : null;
  }
}

function toApproval(row: ApprovalRow): ApprovalRequest {
  return {
    id: row.id,
    conversationId: row.conversation_id as ConversationId,
    runId: row.run_id,
    toolCallId: row.tool_call_id,
    actionKind: row.action_kind,
    actionDigest: row.action_digest,
    risk: row.risk,
    policyVersion: row.policy_version,
    status: row.status,
    expiresAt: new Date(row.expires_at),
    ...(row.resolved_at ? { resolvedAt: new Date(row.resolved_at) } : {}),
    createdAt: new Date(row.created_at),
  };
}
