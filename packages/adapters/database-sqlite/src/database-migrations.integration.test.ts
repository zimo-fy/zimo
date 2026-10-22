import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { applyDatabaseMigrations } from "./database-migrations";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("database migration checksums", () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("reconciles legacy line-ending and BOM checksums to the canonical checksum", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-db-checksum-test-"));
    const sqlite = new DatabaseSync(join(directory, "zimo.sqlite"));
    const sql = "CREATE TABLE example (\n  id TEXT NOT NULL\n);\n";
    const migration = [{ version: 1, name: "example", sql }] as const;
    applyDatabaseMigrations(sqlite, migration);

    const legacySqlVariants = [
      sql.replace(/\n/g, "\r\n"),
      sql.replace(/\n/g, "\r"),
      `\uFEFF${sql}`,
      `\uFEFF${sql.replace(/\n/g, "\r\n")}`,
    ];
    for (const legacySql of legacySqlVariants) {
      sqlite
        .prepare("UPDATE schema_migrations SET checksum = ? WHERE version = 1")
        .run(sha256(legacySql));
      applyDatabaseMigrations(sqlite, migration);
      const row = sqlite
        .prepare("SELECT checksum FROM schema_migrations WHERE version = 1")
        .get() as { checksum: string };
      expect(row.checksum).toBe(sha256(sql));
    }

    sqlite.close();
  });

  it("still rejects a checksum from different SQL content", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-db-checksum-rejection-test-"));
    const sqlite = new DatabaseSync(join(directory, "zimo.sqlite"));
    const migration = [
      { version: 1, name: "example", sql: "CREATE TABLE example (id TEXT);\n" },
    ] as const;
    applyDatabaseMigrations(sqlite, migration);
    sqlite
      .prepare("UPDATE schema_migrations SET checksum = ? WHERE version = 1")
      .run(sha256("CREATE TABLE changed (id TEXT);\n"));

    expect(() => applyDatabaseMigrations(sqlite, migration)).toThrowError(
      "Migration checksum mismatch for version 1",
    );
    sqlite.close();
  });

  it.each([false, true])(
    "reconciles the legacy automation migration sequence when the daily window was applied: %s",
    async (dailyWindowApplied) => {
      directory = await mkdtemp(join(tmpdir(), "zimo-db-version-collision-test-"));
      const sqlite = new DatabaseSync(join(directory, "zimo.sqlite"));
      const workspaceSql = "CREATE TABLE conversation_workspace_grants (id TEXT PRIMARY KEY);\n";
      const automationSql = "CREATE TABLE automations (id TEXT PRIMARY KEY);\n";
      const automationWindowSql = "ALTER TABLE automations ADD COLUMN time_window_start TEXT;\n";
      const legacyMigrations = [
        { version: 25, name: "automation-scheduler", sql: automationSql },
        ...(dailyWindowApplied
          ? [
              {
                version: 26,
                name: "automation-daily-time-window",
                sql: automationWindowSql,
              },
            ]
          : []),
      ];
      applyDatabaseMigrations(sqlite, legacyMigrations);

      applyDatabaseMigrations(sqlite, [
        { version: 25, name: "conversation-workspace-grants", sql: workspaceSql },
        { version: 26, name: "automation-scheduler", sql: automationSql },
        { version: 27, name: "automation-daily-time-window", sql: automationWindowSql },
      ]);

      expect(
        sqlite
          .prepare(
            "SELECT version, name FROM schema_migrations WHERE version BETWEEN 25 AND 27 ORDER BY version",
          )
          .all(),
      ).toEqual([
        { version: 25, name: "conversation-workspace-grants" },
        { version: 26, name: "automation-scheduler" },
        { version: 27, name: "automation-daily-time-window" },
      ]);
      expect(
        sqlite
          .prepare(
            "SELECT name FROM pragma_table_info('automations') WHERE name = 'time_window_start'",
          )
          .get(),
      ).toEqual({ name: "time_window_start" });
      sqlite.close();
    },
  );

  it("does not reconcile a legacy automation entry whose SQL checksum differs", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-db-version-collision-rejection-test-"));
    const sqlite = new DatabaseSync(join(directory, "zimo.sqlite"));
    applyDatabaseMigrations(sqlite, [
      {
        version: 25,
        name: "automation-scheduler",
        sql: "CREATE TABLE unexpected_automations (id TEXT PRIMARY KEY);\n",
      },
    ]);

    expect(() =>
      applyDatabaseMigrations(sqlite, [
        {
          version: 25,
          name: "conversation-workspace-grants",
          sql: "CREATE TABLE conversation_workspace_grants (id TEXT PRIMARY KEY);\n",
        },
        {
          version: 26,
          name: "automation-scheduler",
          sql: "CREATE TABLE automations (id TEXT PRIMARY KEY);\n",
        },
        {
          version: 27,
          name: "automation-daily-time-window",
          sql: "ALTER TABLE automations ADD COLUMN time_window_start TEXT;\n",
        },
      ]),
    ).toThrowError("Migration checksum mismatch for version 25");
    sqlite.close();
  });

  it.each([1, 2, 3, 4])(
    "reconciles %s legacy workspace approval migrations that started at version 26",
    async (legacyMigrationCount) => {
      directory = await mkdtemp(join(tmpdir(), "zimo-db-workspace-approval-collision-test-"));
      const sqlite = new DatabaseSync(join(directory, "zimo.sqlite"));
      const workspaceSql = "CREATE TABLE conversation_workspace_grants (id TEXT PRIMARY KEY);\n";
      const automationSql = "CREATE TABLE automations (id TEXT PRIMARY KEY);\n";
      const automationWindowSql = "ALTER TABLE automations ADD COLUMN time_window_start TEXT;\n";
      const approvalSql = "CREATE TABLE approval_requests (id TEXT PRIMARY KEY);\n";
      const auditSql = "CREATE TABLE security_audit_events (id TEXT PRIMARY KEY);\n";
      const grantKindSql =
        "ALTER TABLE conversation_workspace_grants ADD COLUMN kind TEXT DEFAULT 'external';\n";
      const authorizationSql =
        "CREATE TABLE workspace_directory_authorizations (id TEXT PRIMARY KEY);\n";
      const workspaceApprovalMigrations = [
        { version: 28, name: "action-approval-requests", sql: approvalSql },
        { version: 29, name: "security-audit-events", sql: auditSql },
        { version: 30, name: "workspace-grant-kind", sql: grantKindSql },
        {
          version: 31,
          name: "workspace-directory-authorizations",
          sql: authorizationSql,
        },
      ] as const;
      applyDatabaseMigrations(sqlite, [
        { version: 25, name: "conversation-workspace-grants", sql: workspaceSql },
        ...workspaceApprovalMigrations
          .slice(0, legacyMigrationCount)
          .map((migration) => ({ ...migration, version: migration.version - 2 })),
      ]);

      applyDatabaseMigrations(sqlite, [
        { version: 25, name: "conversation-workspace-grants", sql: workspaceSql },
        { version: 26, name: "automation-scheduler", sql: automationSql },
        { version: 27, name: "automation-daily-time-window", sql: automationWindowSql },
        ...workspaceApprovalMigrations,
      ]);

      expect(
        sqlite
          .prepare(
            "SELECT version, name FROM schema_migrations WHERE version BETWEEN 25 AND 31 ORDER BY version",
          )
          .all(),
      ).toEqual([
        { version: 25, name: "conversation-workspace-grants" },
        { version: 26, name: "automation-scheduler" },
        { version: 27, name: "automation-daily-time-window" },
        { version: 28, name: "action-approval-requests" },
        { version: 29, name: "security-audit-events" },
        { version: 30, name: "workspace-grant-kind" },
        { version: 31, name: "workspace-directory-authorizations" },
      ]);
      sqlite.close();
    },
  );

  it("does not shift a legacy workspace approval entry whose checksum differs", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-db-workspace-approval-rejection-test-"));
    const sqlite = new DatabaseSync(join(directory, "zimo.sqlite"));
    applyDatabaseMigrations(sqlite, [
      {
        version: 26,
        name: "action-approval-requests",
        sql: "CREATE TABLE unexpected_approval_requests (id TEXT PRIMARY KEY);\n",
      },
    ]);

    expect(() =>
      applyDatabaseMigrations(sqlite, [
        {
          version: 26,
          name: "automation-scheduler",
          sql: "CREATE TABLE automations (id TEXT PRIMARY KEY);\n",
        },
        {
          version: 27,
          name: "automation-daily-time-window",
          sql: "ALTER TABLE automations ADD COLUMN time_window_start TEXT;\n",
        },
        {
          version: 28,
          name: "action-approval-requests",
          sql: "CREATE TABLE approval_requests (id TEXT PRIMARY KEY);\n",
        },
        {
          version: 29,
          name: "security-audit-events",
          sql: "CREATE TABLE security_audit_events (id TEXT PRIMARY KEY);\n",
        },
        {
          version: 30,
          name: "workspace-grant-kind",
          sql: "ALTER TABLE workspace ADD COLUMN kind TEXT;\n",
        },
        {
          version: 31,
          name: "workspace-directory-authorizations",
          sql: "CREATE TABLE workspace_directory_authorizations (id TEXT PRIMARY KEY);\n",
        },
      ]),
    ).toThrowError("Migration checksum mismatch for version 26");
    sqlite.close();
  });
});
