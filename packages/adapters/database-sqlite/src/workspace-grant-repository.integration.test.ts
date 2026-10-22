import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { ConversationId, WorkspaceGrant } from "@zimo/domain";

import { ZimoDatabase } from "./index";
import {
  SQLiteWorkspaceApprovalModePreferenceRepository,
  SQLiteWorkspaceDirectoryAuthorizationRepository,
  SQLiteWorkspaceGrantRepository,
} from "./workspace-grant-repository";

describe("SQLiteWorkspaceGrantRepository", () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("persists grants and cascades them with the conversation", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-workspace-db-"));
    const migration = await readFile(
      new URL("../../../../migrations/0025_conversation_workspace_grants.sql", import.meta.url),
      "utf8",
    );
    const grantKindMigration = await readFile(
      new URL("../../../../migrations/0030_workspace_grant_kind.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      {
        version: 1,
        name: "conversation-fixture",
        sql: "CREATE TABLE conversations (id TEXT PRIMARY KEY NOT NULL);",
      },
      { version: 25, name: "conversation-workspace-grants", sql: migration },
      { version: 28, name: "workspace-grant-kind", sql: grantKindMigration },
    ]);
    const conversationId = "00000000-0000-4000-8000-000000000001" as ConversationId;
    database.sqlite.prepare("INSERT INTO conversations (id) VALUES (?)").run(conversationId);
    const repository = new SQLiteWorkspaceGrantRepository(database);
    const grant: WorkspaceGrant = {
      id: "00000000-0000-4000-8000-000000000002",
      conversationId,
      rootRef: "/private/project",
      displayName: "project",
      kind: "external",
      mode: "ask",
      status: "active",
      createdAt: new Date("2026-09-15T00:00:00.000Z"),
      updatedAt: new Date("2026-09-15T00:00:00.000Z"),
    };

    await repository.save(grant);
    expect(await repository.getById(grant.id)).toEqual(grant);
    expect(await repository.listByConversation(conversationId)).toEqual([grant]);

    await expect(repository.removeExternalByRoot(grant.rootRef)).resolves.toBe(1);
    expect(await repository.listByConversation(conversationId)).toEqual([]);
    await repository.save(grant);

    database.sqlite.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
    expect(await repository.getById(grant.id)).toBeNull();
    database.close();
  });

  it("migrates the legacy low-risk mode to full automatic approval", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-workspace-mode-db-"));
    const databasePath = join(directory, "zimo.sqlite");
    const workspaceMigration = await readFile(
      new URL("../../../../migrations/0025_conversation_workspace_grants.sql", import.meta.url),
      "utf8",
    );
    const grantKindMigration = await readFile(
      new URL("../../../../migrations/0030_workspace_grant_kind.sql", import.meta.url),
      "utf8",
    );
    const autoApproveMigration = await readFile(
      new URL("../../../../migrations/0033_workspace_auto_approve_mode.sql", import.meta.url),
      "utf8",
    );
    const baseMigrations = [
      {
        version: 1,
        name: "conversation-fixture",
        sql: "CREATE TABLE conversations (id TEXT PRIMARY KEY NOT NULL);",
      },
      { version: 25, name: "conversation-workspace-grants", sql: workspaceMigration },
      { version: 30, name: "workspace-grant-kind", sql: grantKindMigration },
    ];
    const conversationId = "00000000-0000-4000-8000-000000000001" as ConversationId;
    const legacy = new ZimoDatabase(databasePath, baseMigrations);
    legacy.sqlite.prepare("INSERT INTO conversations (id) VALUES (?)").run(conversationId);
    legacy.sqlite
      .prepare(
        `INSERT INTO conversation_workspace_grants
          (id, conversation_id, root_ref, display_name, mode, status, created_at, updated_at, kind)
         VALUES (?, ?, ?, ?, 'auto_low_risk', 'active', ?, ?, 'external')`,
      )
      .run(
        "00000000-0000-4000-8000-000000000002",
        conversationId,
        "/private/project",
        "project",
        "2026-09-18T00:00:00.000Z",
        "2026-09-18T00:00:00.000Z",
      );
    legacy.close();

    const upgraded = new ZimoDatabase(databasePath, [
      ...baseMigrations,
      { version: 33, name: "workspace-auto-approve-mode", sql: autoApproveMigration },
    ]);
    const repository = new SQLiteWorkspaceGrantRepository(upgraded);
    await expect(repository.listByConversation(conversationId)).resolves.toMatchObject([
      { mode: "auto_approve" },
    ]);
    expect(() =>
      upgraded.sqlite
        .prepare("UPDATE conversation_workspace_grants SET mode = 'auto_low_risk'")
        .run(),
    ).toThrow();
    upgraded.close();
  });

  it("persists remembered directory authorization per account", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-workspace-auth-db-"));
    const migration = await readFile(
      new URL(
        "../../../../migrations/0031_workspace_directory_authorizations.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 29, name: "workspace-directory-authorizations", sql: migration },
    ]);
    const repository = new SQLiteWorkspaceDirectoryAuthorizationRepository(database);
    const authorization = {
      id: "00000000-0000-4000-8000-000000000010",
      ownerUserId: "account-1",
      rootRef: "/private/project",
      displayName: "project",
      createdAt: new Date("2026-09-16T00:00:00.000Z"),
      updatedAt: new Date("2026-09-16T00:00:00.000Z"),
    };

    await repository.save(authorization);
    expect(await repository.listByOwner("account-1")).toEqual([authorization]);
    expect(await repository.listByOwner("account-2")).toEqual([]);
    await expect(repository.removeByOwnerAndRoot("account-1", authorization.rootRef)).resolves.toBe(
      true,
    );
    expect(await repository.listByOwner("account-1")).toEqual([]);
    database.close();
  });

  it("migrates and persists the latest approval mode per account", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-workspace-preference-db-"));
    const databasePath = join(directory, "zimo.sqlite");
    const workspaceMigration = await readFile(
      new URL("../../../../migrations/0025_conversation_workspace_grants.sql", import.meta.url),
      "utf8",
    );
    const grantKindMigration = await readFile(
      new URL("../../../../migrations/0030_workspace_grant_kind.sql", import.meta.url),
      "utf8",
    );
    const autoApproveMigration = await readFile(
      new URL("../../../../migrations/0033_workspace_auto_approve_mode.sql", import.meta.url),
      "utf8",
    );
    const preferenceMigration = await readFile(
      new URL(
        "../../../../migrations/0034_workspace_approval_mode_preferences.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const baseMigrations = [
      {
        version: 1,
        name: "preference-fixture",
        sql: `CREATE TABLE conversations (id TEXT PRIMARY KEY NOT NULL);
              CREATE TABLE user_sessions (external_user_id TEXT NOT NULL);`,
      },
      { version: 25, name: "conversation-workspace-grants", sql: workspaceMigration },
      { version: 30, name: "workspace-grant-kind", sql: grantKindMigration },
      { version: 33, name: "workspace-auto-approve-mode", sql: autoApproveMigration },
    ];
    const conversationId = "00000000-0000-4000-8000-000000000001" as ConversationId;
    const legacy = new ZimoDatabase(databasePath, baseMigrations);
    legacy.sqlite.prepare("INSERT INTO conversations (id) VALUES (?)").run(conversationId);
    legacy.sqlite
      .prepare("INSERT INTO user_sessions (external_user_id) VALUES (?)")
      .run("account-1");
    legacy.sqlite
      .prepare(
        `INSERT INTO conversation_workspace_grants
          (id, conversation_id, root_ref, display_name, mode, status, created_at, updated_at, kind)
         VALUES (?, ?, ?, ?, 'auto_approve', 'active', ?, ?, 'managed')`,
      )
      .run(
        "00000000-0000-4000-8000-000000000002",
        conversationId,
        "/private/workspace",
        "Zimo Workspace",
        "2026-09-18T01:00:00.000Z",
        "2026-09-18T01:00:00.000Z",
      );
    legacy.close();

    const upgraded = new ZimoDatabase(databasePath, [
      ...baseMigrations,
      { version: 34, name: "workspace-approval-mode-preferences", sql: preferenceMigration },
    ]);
    const repository = new SQLiteWorkspaceApprovalModePreferenceRepository(upgraded);
    await expect(repository.getByOwner("account-1")).resolves.toBe("auto_approve");
    await expect(repository.getByOwner("account-2")).resolves.toBeNull();
    await repository.save("account-2", "ask", new Date("2026-09-18T02:00:00.000Z"));
    await expect(repository.getByOwner("account-2")).resolves.toBe("ask");
    upgraded.close();
  });
});
