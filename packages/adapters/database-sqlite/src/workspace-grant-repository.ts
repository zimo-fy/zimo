import type {
  ConversationId,
  WorkspaceGrant,
  WorkspaceGrantMode,
  WorkspaceGrantRepository,
  WorkspaceDirectoryAuthorization,
  WorkspaceDirectoryAuthorizationRepository,
  WorkspaceApprovalModePreferenceRepository,
} from "@zimo/domain";

import type { ZimoDatabase } from "./index";

type WorkspaceGrantRow = {
  id: string;
  conversation_id: string;
  root_ref: string;
  display_name: string;
  kind: WorkspaceGrant["kind"];
  mode: WorkspaceGrant["mode"];
  status: WorkspaceGrant["status"];
  created_at: string;
  updated_at: string;
};

export class SQLiteWorkspaceGrantRepository implements WorkspaceGrantRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async listByConversation(conversationId: ConversationId): Promise<readonly WorkspaceGrant[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT * FROM conversation_workspace_grants
         WHERE conversation_id = ? ORDER BY created_at, id`,
      )
      .all(conversationId) as unknown as WorkspaceGrantRow[];
    return rows.map(toGrant);
  }

  async getById(id: string): Promise<WorkspaceGrant | null> {
    const row = this.database.sqlite
      .prepare("SELECT * FROM conversation_workspace_grants WHERE id = ?")
      .get(id) as unknown as WorkspaceGrantRow | undefined;
    return row ? toGrant(row) : null;
  }

  async save(grant: WorkspaceGrant): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO conversation_workspace_grants
          (id, conversation_id, root_ref, display_name, kind, mode, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        grant.id,
        grant.conversationId,
        grant.rootRef,
        grant.displayName,
        grant.kind,
        grant.mode,
        grant.status,
        grant.createdAt.toISOString(),
        grant.updatedAt.toISOString(),
      );
  }

  async updateMode(
    conversationId: ConversationId,
    mode: WorkspaceGrantMode,
    at: Date,
  ): Promise<number> {
    return Number(
      this.database.sqlite
        .prepare(
          "UPDATE conversation_workspace_grants SET mode = ?, updated_at = ? WHERE conversation_id = ?",
        )
        .run(mode, at.toISOString(), conversationId).changes,
    );
  }

  async remove(conversationId: ConversationId, id: string): Promise<boolean> {
    return (
      this.database.sqlite
        .prepare("DELETE FROM conversation_workspace_grants WHERE conversation_id = ? AND id = ?")
        .run(conversationId, id).changes === 1
    );
  }

  async removeExternalByRoot(rootRef: string): Promise<number> {
    return Number(
      this.database.sqlite
        .prepare(
          "DELETE FROM conversation_workspace_grants WHERE root_ref = ? AND kind = 'external'",
        )
        .run(rootRef).changes,
    );
  }
}

type WorkspaceAuthorizationRow = {
  id: string;
  owner_user_id: string;
  root_ref: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

function toGrant(row: WorkspaceGrantRow): WorkspaceGrant {
  return {
    id: row.id,
    conversationId: row.conversation_id as ConversationId,
    rootRef: row.root_ref,
    displayName: row.display_name,
    kind: row.kind,
    mode: row.mode,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SQLiteWorkspaceDirectoryAuthorizationRepository implements WorkspaceDirectoryAuthorizationRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async listByOwner(ownerUserId: string): Promise<readonly WorkspaceDirectoryAuthorization[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT * FROM workspace_directory_authorizations
         WHERE owner_user_id = ? ORDER BY created_at, id`,
      )
      .all(ownerUserId) as unknown as WorkspaceAuthorizationRow[];
    return rows.map((row) => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      rootRef: row.root_ref,
      displayName: row.display_name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async save(value: WorkspaceDirectoryAuthorization): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO workspace_directory_authorizations
          (id, owner_user_id, root_ref, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(owner_user_id, root_ref) DO UPDATE SET
           display_name = excluded.display_name,
           updated_at = excluded.updated_at`,
      )
      .run(
        value.id,
        value.ownerUserId,
        value.rootRef,
        value.displayName,
        value.createdAt.toISOString(),
        value.updatedAt.toISOString(),
      );
  }

  async removeByOwnerAndRoot(ownerUserId: string, rootRef: string): Promise<boolean> {
    return (
      this.database.sqlite
        .prepare(
          "DELETE FROM workspace_directory_authorizations WHERE owner_user_id = ? AND root_ref = ?",
        )
        .run(ownerUserId, rootRef).changes > 0
    );
  }
}

export class SQLiteWorkspaceApprovalModePreferenceRepository implements WorkspaceApprovalModePreferenceRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async getByOwner(ownerUserId: string): Promise<WorkspaceGrantMode | null> {
    const row = this.database.sqlite
      .prepare("SELECT mode FROM workspace_approval_mode_preferences WHERE owner_user_id = ?")
      .get(ownerUserId) as { mode: WorkspaceGrantMode } | undefined;
    return row?.mode ?? null;
  }

  async save(ownerUserId: string, mode: WorkspaceGrantMode, updatedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO workspace_approval_mode_preferences (owner_user_id, mode, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(owner_user_id) DO UPDATE SET
           mode = excluded.mode,
           updated_at = excluded.updated_at`,
      )
      .run(ownerUserId, mode, updatedAt.toISOString());
  }
}
