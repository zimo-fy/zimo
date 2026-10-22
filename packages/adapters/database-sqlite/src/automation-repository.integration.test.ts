import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type {
  AutomationDefinition,
  AutomationId,
  AutomationRunId,
  ConversationId,
} from "@zimo/domain";

import { SQLiteAutomationRepository, ZimoDatabase } from "./index";

describe("SQLiteAutomationRepository", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("isolates accounts, claims due work once and restores run history", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-automation-db-test-"));
    const path = join(directory, "zimo.sqlite");
    const automationSql = await readFile(
      new URL("../../../../migrations/0026_automation_scheduler.sql", import.meta.url),
      "utf8",
    );
    const timeWindowSql = await readFile(
      new URL("../../../../migrations/0027_automation_daily_time_window.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(path, [
      {
        version: 1,
        name: "automation-test-base",
        sql: "CREATE TABLE conversations (id TEXT PRIMARY KEY NOT NULL);",
      },
      { version: 26, name: "automation-scheduler", sql: automationSql },
      { version: 27, name: "automation-daily-time-window", sql: timeWindowSql },
    ]);
    const repository = new SQLiteAutomationRepository(database);
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    database.sqlite
      .prepare("INSERT INTO conversations(id) VALUES (?)")
      .run(automation.conversationId);
    await repository.save(automation);

    await expect(repository.list("other-account")).resolves.toEqual([]);
    await expect(repository.getById("account-1", automation.id)).resolves.toMatchObject({
      timeWindow: { startTime: "00:00", endTime: "23:59" },
    });
    await expect(repository.listDue("account-1", now, 3)).resolves.toHaveLength(1);
    const run = {
      id: "00000000-0000-4000-8000-000000000003" as AutomationRunId,
      automationId: automation.id,
      trigger: "scheduled" as const,
      status: "running" as const,
      scheduledFor: now,
      startedAt: now,
    };
    await expect(
      repository.beginRun("account-1", run, new Date("2026-09-16T08:00:00.000Z"), now),
    ).resolves.toBe(true);
    await expect(repository.beginRun("account-1", run, undefined, now)).resolves.toBe(false);
    await repository.attachConversationRun(run.id, "00000000-0000-4000-8000-000000000004");
    await repository.finishRun("account-1", run.id, "completed", now);

    await expect(repository.listRuns("account-1", automation.id, 20)).resolves.toEqual([
      expect.objectContaining({ status: "completed", conversationRunId: expect.any(String) }),
    ]);
    database.close();
  });

  it("marks interrupted runs as failed during startup recovery", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-automation-repair-test-"));
    const path = join(directory, "zimo.sqlite");
    const automationSql = await readFile(
      new URL("../../../../migrations/0026_automation_scheduler.sql", import.meta.url),
      "utf8",
    );
    const timeWindowSql = await readFile(
      new URL("../../../../migrations/0027_automation_daily_time_window.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(path, [
      { version: 1, name: "base", sql: "CREATE TABLE conversations (id TEXT PRIMARY KEY);" },
      { version: 26, name: "automation-scheduler", sql: automationSql },
      { version: 27, name: "automation-daily-time-window", sql: timeWindowSql },
    ]);
    const repository = new SQLiteAutomationRepository(database);
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    database.sqlite
      .prepare("INSERT INTO conversations(id) VALUES (?)")
      .run(automation.conversationId);
    await repository.save(automation);
    const runId = "00000000-0000-4000-8000-000000000005" as AutomationRunId;
    await repository.beginRun(
      "account-1",
      {
        id: runId,
        automationId: automation.id,
        trigger: "manual",
        status: "running",
        scheduledFor: now,
        startedAt: now,
      },
      automation.nextRunAt,
    );
    await repository.repairInterruptedRuns(new Date("2026-09-15T08:05:00.000Z"));
    await expect(repository.listRuns("account-1", automation.id, 20)).resolves.toEqual([
      expect.objectContaining({ status: "failed", errorCode: "RUN_INTERRUPTED" }),
    ]);
    database.close();
  });

  it("upgrades existing automation rows to an all-day daily window", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-automation-window-upgrade-test-"));
    const path = join(directory, "zimo.sqlite");
    const automationSql = await readFile(
      new URL("../../../../migrations/0026_automation_scheduler.sql", import.meta.url),
      "utf8",
    );
    const timeWindowSql = await readFile(
      new URL("../../../../migrations/0027_automation_daily_time_window.sql", import.meta.url),
      "utf8",
    );
    const base = {
      version: 1,
      name: "base",
      sql: "CREATE TABLE conversations (id TEXT PRIMARY KEY NOT NULL);",
    };
    const database = new ZimoDatabase(path, [
      base,
      { version: 26, name: "automation-scheduler", sql: automationSql },
    ]);
    database.sqlite.prepare("INSERT INTO conversations(id) VALUES ('conversation-1')").run();
    database.sqlite
      .prepare(
        `INSERT INTO automations
          (id, owner_external_user_id, conversation_id, name, prompt, enabled, schedule_json,
           created_at, updated_at)
         VALUES ('automation-1', 'account-1', 'conversation-1', '日报', '生成日报', 1,
           '{"kind":"interval","anchorAt":"2026-09-15T00:00:00.000Z","everyMinutes":60}',
           '2026-09-15T00:00:00.000Z', '2026-09-15T00:00:00.000Z')`,
      )
      .run();
    database.close();

    const upgraded = new ZimoDatabase(path, [
      base,
      { version: 26, name: "automation-scheduler", sql: automationSql },
      { version: 27, name: "automation-daily-time-window", sql: timeWindowSql },
    ]);
    expect(
      upgraded.sqlite
        .prepare("SELECT time_window_start, time_window_end FROM automations WHERE id = ?")
        .get("automation-1"),
    ).toEqual({ time_window_start: "00:00", time_window_end: "23:59" });
    const restored = await new SQLiteAutomationRepository(upgraded).getById(
      "account-1",
      "automation-1" as AutomationId,
    );
    expect(restored).toMatchObject({
      schedule: { kind: "interval", everyMinutes: 60 },
      timeWindow: { startTime: "00:00", endTime: "23:59" },
    });
    upgraded.close();
  });
});

function createAutomation(now: Date): AutomationDefinition {
  return {
    id: "00000000-0000-4000-8000-000000000001" as AutomationId,
    ownerExternalUserId: "account-1",
    conversationId: "00000000-0000-4000-8000-000000000002" as ConversationId,
    name: "日报",
    prompt: "生成日报",
    enabled: true,
    schedule: { kind: "daily", time: "16:00" },
    timeWindow: { startTime: "00:00", endTime: "23:59" },
    nextRunAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
