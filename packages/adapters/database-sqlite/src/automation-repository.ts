import type {
  AutomationDefinition,
  AutomationId,
  AutomationRepository,
  AutomationRunId,
  AutomationRunRecord,
  AutomationRunStatus,
  AutomationSchedule,
  ConversationId,
} from "@zimo/domain";

import type { ZimoDatabase } from "./index";

interface AutomationRow {
  id: string;
  owner_external_user_id: string;
  conversation_id: string;
  name: string;
  prompt: string;
  enabled: number;
  schedule_json: string;
  time_window_start: string;
  time_window_end: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: AutomationRunStatus | null;
  created_at: string;
  updated_at: string;
}

interface AutomationRunRow {
  id: string;
  automation_id: string;
  conversation_run_id: string | null;
  trigger: "scheduled" | "manual";
  status: AutomationRunStatus;
  scheduled_for: string;
  started_at: string;
  finished_at: string | null;
  error_code: string | null;
}

export class SQLiteAutomationRepository implements AutomationRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async list(ownerExternalUserId: string): Promise<readonly AutomationDefinition[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT * FROM automations
         WHERE owner_external_user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
      )
      .all(ownerExternalUserId) as unknown as AutomationRow[];
    return rows.map(mapAutomation);
  }

  async getById(
    ownerExternalUserId: string,
    id: AutomationId,
  ): Promise<AutomationDefinition | null> {
    const row = this.database.sqlite
      .prepare(
        `SELECT * FROM automations
         WHERE owner_external_user_id = ? AND id = ? AND deleted_at IS NULL`,
      )
      .get(ownerExternalUserId, id) as unknown as AutomationRow | undefined;
    return row ? mapAutomation(row) : null;
  }

  async save(value: AutomationDefinition): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO automations
          (id, owner_external_user_id, conversation_id, name, prompt, enabled, schedule_json,
           time_window_start, time_window_end, next_run_at, last_run_at, last_run_status,
           created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           prompt = excluded.prompt,
           enabled = excluded.enabled,
           schedule_json = excluded.schedule_json,
           time_window_start = excluded.time_window_start,
           time_window_end = excluded.time_window_end,
           next_run_at = excluded.next_run_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        value.id,
        value.ownerExternalUserId,
        value.conversationId,
        value.name,
        value.prompt,
        value.enabled ? 1 : 0,
        JSON.stringify(serializeSchedule(value.schedule)),
        value.timeWindow.startTime,
        value.timeWindow.endTime,
        value.nextRunAt?.toISOString() ?? null,
        value.lastRunAt?.toISOString() ?? null,
        value.lastRunStatus ?? null,
        value.createdAt.toISOString(),
        value.updatedAt.toISOString(),
      );
  }

  async softDelete(ownerExternalUserId: string, id: AutomationId, deletedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        `UPDATE automations SET enabled = 0, next_run_at = NULL, deleted_at = ?, updated_at = ?
         WHERE owner_external_user_id = ? AND id = ? AND deleted_at IS NULL`,
      )
      .run(deletedAt.toISOString(), deletedAt.toISOString(), ownerExternalUserId, id);
  }

  async listDue(
    ownerExternalUserId: string,
    now: Date,
    limit: number,
  ): Promise<readonly AutomationDefinition[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT * FROM automations
         WHERE owner_external_user_id = ? AND enabled = 1 AND deleted_at IS NULL
           AND next_run_at IS NOT NULL AND next_run_at <= ?
         ORDER BY next_run_at LIMIT ?`,
      )
      .all(ownerExternalUserId, now.toISOString(), limit) as unknown as AutomationRow[];
    return rows.map(mapAutomation);
  }

  async beginRun(
    ownerExternalUserId: string,
    run: AutomationRunRecord,
    nextRunAt: Date | undefined,
    expectedNextRunAt?: Date | undefined,
  ): Promise<boolean> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const condition = expectedNextRunAt ? "AND next_run_at = ? AND enabled = 1" : "";
      const parameters = [
        nextRunAt?.toISOString() ?? null,
        nextRunAt?.toISOString() ?? null,
        run.startedAt.toISOString(),
        run.startedAt.toISOString(),
        ownerExternalUserId,
        run.automationId,
        ...(expectedNextRunAt ? [expectedNextRunAt.toISOString()] : []),
      ];
      const updated = this.database.sqlite
        .prepare(
          `UPDATE automations
           SET next_run_at = ?, enabled = CASE WHEN ? IS NULL THEN 0 ELSE enabled END,
             last_run_at = ?, last_run_status = 'running', updated_at = ?
           WHERE owner_external_user_id = ? AND id = ? AND deleted_at IS NULL ${condition}
             AND NOT EXISTS (
               SELECT 1 FROM automation_runs
               WHERE automation_id = automations.id AND status = 'running'
             )`,
        )
        .run(...parameters);
      if (updated.changes !== 1) {
        this.database.sqlite.exec("COMMIT");
        return false;
      }
      this.database.sqlite
        .prepare(
          `INSERT INTO automation_runs
            (id, automation_id, conversation_run_id, trigger, status, scheduled_for,
             started_at, finished_at, error_code)
           VALUES (?, ?, NULL, ?, 'running', ?, ?, NULL, NULL)`,
        )
        .run(
          run.id,
          run.automationId,
          run.trigger,
          run.scheduledFor.toISOString(),
          run.startedAt.toISOString(),
        );
      this.database.sqlite.exec("COMMIT");
      return true;
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async attachConversationRun(id: AutomationRunId, conversationRunId: string): Promise<void> {
    this.database.sqlite
      .prepare(
        "UPDATE automation_runs SET conversation_run_id = ? WHERE id = ? AND status = 'running'",
      )
      .run(conversationRunId, id);
  }

  async finishRun(
    ownerExternalUserId: string,
    id: AutomationRunId,
    status: Exclude<AutomationRunStatus, "running">,
    finishedAt: Date,
    errorCode?: string | undefined,
  ): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const row = this.database.sqlite
        .prepare(
          `SELECT r.automation_id FROM automation_runs r
           JOIN automations a ON a.id = r.automation_id
           WHERE r.id = ? AND r.status = 'running' AND a.owner_external_user_id = ?`,
        )
        .get(id, ownerExternalUserId) as { automation_id: string } | undefined;
      if (!row) {
        this.database.sqlite.exec("COMMIT");
        return;
      }
      this.database.sqlite
        .prepare(
          "UPDATE automation_runs SET status = ?, finished_at = ?, error_code = ? WHERE id = ?",
        )
        .run(status, finishedAt.toISOString(), errorCode ?? null, id);
      this.database.sqlite
        .prepare("UPDATE automations SET last_run_status = ?, updated_at = ? WHERE id = ?")
        .run(status, finishedAt.toISOString(), row.automation_id);
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async listRuns(
    ownerExternalUserId: string,
    automationId: AutomationId,
    limit: number,
  ): Promise<readonly AutomationRunRecord[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT r.* FROM automation_runs r JOIN automations a ON a.id = r.automation_id
         WHERE a.owner_external_user_id = ? AND a.id = ?
         ORDER BY r.started_at DESC LIMIT ?`,
      )
      .all(ownerExternalUserId, automationId, limit) as unknown as AutomationRunRow[];
    return rows.map(mapRun);
  }

  async repairInterruptedRuns(updatedAt: Date): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      this.database.sqlite
        .prepare(
          `UPDATE automation_runs SET status = 'failed', finished_at = ?, error_code = 'RUN_INTERRUPTED'
           WHERE status = 'running'`,
        )
        .run(updatedAt.toISOString());
      this.database.sqlite
        .prepare(
          `UPDATE automations SET last_run_status = 'failed', updated_at = ?
           WHERE last_run_status = 'running'`,
        )
        .run(updatedAt.toISOString());
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

function serializeSchedule(schedule: AutomationSchedule): Record<string, unknown> {
  if (schedule.kind === "once") return { kind: schedule.kind, runAt: schedule.runAt.toISOString() };
  if (schedule.kind === "interval") {
    return { kind: schedule.kind, everyMinutes: schedule.everyMinutes };
  }
  return { ...schedule, weekdays: schedule.kind === "weekly" ? [...schedule.weekdays] : undefined };
}

function parseSchedule(value: string): AutomationSchedule {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  if (parsed.kind === "once" && typeof parsed.runAt === "string") {
    return { kind: "once", runAt: new Date(parsed.runAt) };
  }
  if (parsed.kind === "interval" && typeof parsed.everyMinutes === "number") {
    return { kind: "interval", everyMinutes: parsed.everyMinutes };
  }
  if (parsed.kind === "daily" && typeof parsed.time === "string") {
    return { kind: "daily", time: parsed.time };
  }
  if (
    parsed.kind === "weekly" &&
    typeof parsed.time === "string" &&
    Array.isArray(parsed.weekdays) &&
    parsed.weekdays.every((day) => typeof day === "number")
  ) {
    return { kind: "weekly", time: parsed.time, weekdays: parsed.weekdays };
  }
  throw new Error("Invalid automation schedule in storage");
}

function mapAutomation(row: AutomationRow): AutomationDefinition {
  return {
    id: row.id as AutomationId,
    ownerExternalUserId: row.owner_external_user_id,
    conversationId: row.conversation_id as ConversationId,
    name: row.name,
    prompt: row.prompt,
    enabled: row.enabled === 1,
    schedule: parseSchedule(row.schedule_json),
    timeWindow: { startTime: row.time_window_start, endTime: row.time_window_end },
    ...(row.next_run_at ? { nextRunAt: new Date(row.next_run_at) } : {}),
    ...(row.last_run_at ? { lastRunAt: new Date(row.last_run_at) } : {}),
    ...(row.last_run_status ? { lastRunStatus: row.last_run_status } : {}),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRun(row: AutomationRunRow): AutomationRunRecord {
  return {
    id: row.id as AutomationRunId,
    automationId: row.automation_id as AutomationId,
    ...(row.conversation_run_id ? { conversationRunId: row.conversation_run_id } : {}),
    trigger: row.trigger,
    status: row.status,
    scheduledFor: new Date(row.scheduled_for),
    startedAt: new Date(row.started_at),
    ...(row.finished_at ? { finishedAt: new Date(row.finished_at) } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
  };
}
