import type {
  ActionKind,
  ActionRisk,
  ApprovalStatus,
  SecurityAuditEvent,
  SecurityAuditEventRepository,
  SecurityAuditEventType,
  SecurityAuditFilter,
  SecurityAuditOutcome,
} from "@zimo/domain";

import type { ZimoDatabase } from "./index";

type AuditRow = {
  id: string;
  event_type: SecurityAuditEventType;
  conversation_id: string | null;
  run_id: string;
  approval_id: string | null;
  tool_call_id: string | null;
  tool_id: string | null;
  action_kind: ActionKind | null;
  risk: ActionRisk | null;
  decision: Exclude<ApprovalStatus, "pending"> | null;
  outcome: SecurityAuditOutcome;
  rule_id: string | null;
  error_code: string | null;
  duration_ms: number | null;
  metadata_json: string;
  created_at: string;
};

export class SQLiteSecurityAuditEventRepository implements SecurityAuditEventRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async append(event: SecurityAuditEvent): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO security_audit_events
          (id, event_type, conversation_id, run_id, approval_id, tool_call_id, tool_id,
           action_kind, risk, decision, outcome, rule_id, error_code, duration_ms,
           metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.eventType,
        event.conversationId ?? null,
        event.runId,
        event.approvalId ?? null,
        event.toolCallId ?? null,
        event.toolId ?? null,
        event.actionKind ?? null,
        event.risk ?? null,
        event.decision ?? null,
        event.outcome,
        event.ruleId ?? null,
        event.errorCode ?? null,
        event.durationMs ?? null,
        JSON.stringify(event.metadata),
        event.createdAt.toISOString(),
      );
  }

  async list(filter: SecurityAuditFilter): Promise<readonly SecurityAuditEvent[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT * FROM security_audit_events
         WHERE (? IS NULL OR event_type = ?)
           AND (? IS NULL OR risk = ?)
           AND (? IS NULL OR outcome = ?)
           AND (? IS NULL OR created_at < ?)
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(
        filter.eventType ?? null,
        filter.eventType ?? null,
        filter.risk ?? null,
        filter.risk ?? null,
        filter.outcome ?? null,
        filter.outcome ?? null,
        filter.before?.toISOString() ?? null,
        filter.before?.toISOString() ?? null,
        filter.limit,
      ) as unknown as AuditRow[];
    return rows.map(toEvent);
  }
}

function toEvent(row: AuditRow): SecurityAuditEvent {
  const metadata = JSON.parse(row.metadata_json) as SecurityAuditEvent["metadata"];
  return {
    id: row.id,
    eventType: row.event_type,
    ...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
    runId: row.run_id,
    ...(row.approval_id ? { approvalId: row.approval_id } : {}),
    ...(row.tool_call_id ? { toolCallId: row.tool_call_id } : {}),
    ...(row.tool_id ? { toolId: row.tool_id } : {}),
    ...(row.action_kind ? { actionKind: row.action_kind } : {}),
    ...(row.risk ? { risk: row.risk } : {}),
    ...(row.decision ? { decision: row.decision } : {}),
    outcome: row.outcome,
    ...(row.rule_id ? { ruleId: row.rule_id } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
    metadata,
    createdAt: new Date(row.created_at),
  };
}
