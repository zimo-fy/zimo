import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeMigrationSql(sql: string): string {
  return sql.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function equivalentLegacyChecksums(normalizedSql: string): ReadonlySet<string> {
  const lineEndingVariants = [
    normalizedSql,
    normalizedSql.replace(/\n/g, "\r\n"),
    normalizedSql.replace(/\n/g, "\r"),
  ];
  return new Set(
    lineEndingVariants.flatMap((variant) => [sha256(variant), sha256(`\uFEFF${variant}`)]),
  );
}

function reconcileDocumentMigrationVersionCollision(sqlite: DatabaseSync): void {
  const rows = sqlite
    .prepare(
      "SELECT version, name FROM schema_migrations WHERE version BETWEEN 21 AND 24 ORDER BY version",
    )
    .all() as Array<{ version: number; name: string }>;
  const isLegacyDocumentSequence =
    rows.length === 3 &&
    rows[0]?.version === 21 &&
    rows[0].name === "document-artifacts" &&
    rows[1]?.version === 22 &&
    rows[1].name === "document-revision-creators" &&
    rows[2]?.version === 23 &&
    rows[2].name === "document-message-revisions";
  if (!isLegacyDocumentSequence) return;

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.exec("UPDATE schema_migrations SET version = 24 WHERE version = 23");
    sqlite.exec("UPDATE schema_migrations SET version = 23 WHERE version = 22");
    sqlite.exec("UPDATE schema_migrations SET version = 22 WHERE version = 21");
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

function reconcileWorkspaceAutomationMigrationVersionCollision(
  sqlite: DatabaseSync,
  migrations: readonly Migration[],
): void {
  const migrationsByVersion = new Map(
    migrations.map((migration) => [migration.version, migration] as const),
  );
  const workspaceMigration = migrationsByVersion.get(25);
  const automationMigration = migrationsByVersion.get(26);
  const automationWindowMigration = migrationsByVersion.get(27);
  if (
    workspaceMigration?.name !== "conversation-workspace-grants" ||
    automationMigration?.name !== "automation-scheduler" ||
    automationWindowMigration?.name !== "automation-daily-time-window"
  ) {
    return;
  }

  const rows = sqlite
    .prepare(
      "SELECT version, name, checksum FROM schema_migrations WHERE version BETWEEN 25 AND 27 ORDER BY version",
    )
    .all() as Array<{ version: number; name: string; checksum: string }>;
  const legacyAutomation = rows.find((row) => row.version === 25);
  const legacyAutomationWindow = rows.find((row) => row.version === 26);
  const occupiedVersion27 = rows.some((row) => row.version === 27);
  if (
    legacyAutomation?.name !== automationMigration.name ||
    occupiedVersion27 ||
    !equivalentLegacyChecksums(normalizeMigrationSql(automationMigration.sql)).has(
      legacyAutomation.checksum,
    )
  ) {
    return;
  }
  if (
    legacyAutomationWindow &&
    (legacyAutomationWindow.name !== automationWindowMigration.name ||
      !equivalentLegacyChecksums(normalizeMigrationSql(automationWindowMigration.sql)).has(
        legacyAutomationWindow.checksum,
      ))
  ) {
    return;
  }

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    if (legacyAutomationWindow) {
      sqlite.exec("UPDATE schema_migrations SET version = 27 WHERE version = 26");
    }
    sqlite.exec("UPDATE schema_migrations SET version = 26 WHERE version = 25");
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

function reconcileWorkspaceApprovalMigrationVersionCollision(
  sqlite: DatabaseSync,
  migrations: readonly Migration[],
): void {
  const migrationsByVersion = new Map(
    migrations.map((migration) => [migration.version, migration] as const),
  );
  const expectedMigrations = [
    migrationsByVersion.get(28),
    migrationsByVersion.get(29),
    migrationsByVersion.get(30),
    migrationsByVersion.get(31),
  ];
  const expectedNames = [
    "action-approval-requests",
    "security-audit-events",
    "workspace-grant-kind",
    "workspace-directory-authorizations",
  ];
  if (
    expectedMigrations.some(
      (migration, index) => !migration || migration.name !== expectedNames[index],
    )
  ) {
    return;
  }

  const rows = sqlite
    .prepare(
      "SELECT version, name, checksum FROM schema_migrations WHERE version BETWEEN 26 AND 31 ORDER BY version",
    )
    .all() as Array<{ version: number; name: string; checksum: string }>;
  const rowsByVersion = new Map(rows.map((row) => [row.version, row] as const));
  const legacyRows: Array<{ version: number; name: string; checksum: string }> = [];
  for (let index = 0; index < expectedMigrations.length; index += 1) {
    const row = rowsByVersion.get(26 + index);
    if (!row) break;
    const migration = expectedMigrations[index];
    if (
      !migration ||
      row.name !== migration.name ||
      !equivalentLegacyChecksums(normalizeMigrationSql(migration.sql)).has(row.checksum)
    ) {
      return;
    }
    legacyRows.push(row);
  }
  if (legacyRows.length === 0) return;

  const sourceVersions = new Set(legacyRows.map((row) => row.version));
  const hasOccupiedTarget = legacyRows.some((row) => {
    const targetVersion = row.version + 2;
    return rowsByVersion.has(targetVersion) && !sourceVersions.has(targetVersion);
  });
  if (hasOccupiedTarget) return;

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const moveMigration = sqlite.prepare(
      "UPDATE schema_migrations SET version = ? WHERE version = ?",
    );
    for (const row of [...legacyRows].reverse()) {
      moveMigration.run(row.version + 2, row.version);
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

function reconcileBrowserCatalogMigrationVersionCollision(
  sqlite: DatabaseSync,
  migrations: readonly Migration[],
): void {
  const browser = migrations.find((migration) => migration.version === 38);
  const catalog = migrations.find((migration) => migration.version === 39);
  if (
    browser?.name !== "conversation-browser-capability" ||
    catalog?.name !== "conversation-catalog-model"
  ) {
    return;
  }

  const rows = sqlite
    .prepare(
      "SELECT version, name, checksum FROM schema_migrations WHERE version IN (-38, 38, 39, 40) ORDER BY version",
    )
    .all() as Array<{ version: number; name: string; checksum: string }>;
  const byVersion = new Map(rows.map((row) => [row.version, row] as const));
  const legacyCatalog = byVersion.get(38);
  const legacyBrowser = byVersion.get(39);
  if (
    byVersion.has(-38) ||
    legacyCatalog?.name !== catalog.name ||
    !equivalentLegacyChecksums(normalizeMigrationSql(catalog.sql)).has(legacyCatalog.checksum) ||
    (legacyBrowser &&
      (legacyBrowser.name !== browser.name ||
        !equivalentLegacyChecksums(normalizeMigrationSql(browser.sql)).has(
          legacyBrowser.checksum,
        ))) ||
    (!legacyBrowser && byVersion.has(40))
  ) {
    return;
  }

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const move = sqlite.prepare("UPDATE schema_migrations SET version = ? WHERE version = ?");
    move.run(-38, 38);
    if (legacyBrowser) move.run(38, 39);
    move.run(39, -38);
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

function reconcileKnowledgeCloudDefaultBrowserMigrationVersionCollision(
  sqlite: DatabaseSync,
  migrations: readonly Migration[],
): void {
  const defaultBrowser = migrations.find((migration) => migration.version === 40);
  const knowledgeCloud = migrations.find((migration) => migration.version === 41);
  if (
    defaultBrowser?.name !== "default-browser-capability" ||
    knowledgeCloud?.name !== "knowledge-cloud-links"
  ) {
    return;
  }

  const rows = sqlite
    .prepare(
      "SELECT version, name, checksum FROM schema_migrations WHERE version IN (40, 41) ORDER BY version",
    )
    .all() as Array<{ version: number; name: string; checksum: string }>;
  const at40 = rows.find((row) => row.version === 40);
  const at41 = rows.find((row) => row.version === 41);
  if (!at40 || at40.name !== "knowledge-cloud-links" || at41) return;

  const normalizedKnowledgeSql = normalizeMigrationSql(knowledgeCloud.sql);
  if (
    at40.checksum !== sha256(normalizedKnowledgeSql) &&
    !equivalentLegacyChecksums(normalizedKnowledgeSql).has(at40.checksum)
  ) {
    return;
  }

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.prepare("UPDATE schema_migrations SET version = 41 WHERE version = 40").run();
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

export function applyDatabaseMigrations(
  sqlite: DatabaseSync,
  migrations: readonly Migration[],
): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  reconcileDocumentMigrationVersionCollision(sqlite);
  reconcileWorkspaceAutomationMigrationVersionCollision(sqlite, migrations);
  reconcileWorkspaceApprovalMigrationVersionCollision(sqlite, migrations);
  reconcileBrowserCatalogMigrationVersionCollision(sqlite, migrations);
  reconcileKnowledgeCloudDefaultBrowserMigrationVersionCollision(sqlite, migrations);

  const findMigration = sqlite.prepare("SELECT checksum FROM schema_migrations WHERE version = ?");
  const insertMigration = sqlite.prepare(
    "INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
  );
  const updateChecksum = sqlite.prepare(
    "UPDATE schema_migrations SET checksum = ? WHERE version = ? AND checksum = ?",
  );

  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    const normalizedSql = normalizeMigrationSql(migration.sql);
    const checksum = sha256(normalizedSql);
    const existing = findMigration.get(migration.version) as { checksum: string } | undefined;
    if (existing) {
      if (existing.checksum === checksum) continue;
      if (!equivalentLegacyChecksums(normalizedSql).has(existing.checksum)) {
        throw new Error(`Migration checksum mismatch for version ${migration.version}`);
      }
      updateChecksum.run(checksum, migration.version, existing.checksum);
      continue;
    }

    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.exec(normalizedSql);
      insertMigration.run(migration.version, migration.name, checksum, new Date().toISOString());
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}
