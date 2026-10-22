import type { UserMemory, UserMemoryRepository } from "@zimo/domain";

import type { ZimoDatabase } from "./index";

interface UserMemoryRow {
  id: string;
  owner_user_id: string;
  kind: UserMemory["kind"];
  content: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function mapMemory(row: UserMemoryRow): UserMemory {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    kind: row.kind,
    content: row.content,
    enabled: row.enabled === 1,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SQLiteUserMemoryRepository implements UserMemoryRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async list(ownerUserId: string): Promise<readonly UserMemory[]> {
    const rows = this.database.sqlite
      .prepare(
        "SELECT * FROM user_memories WHERE owner_user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 100",
      )
      .all(ownerUserId) as unknown as UserMemoryRow[];
    return rows.map(mapMemory);
  }

  async get(ownerUserId: string, id: string): Promise<UserMemory | null> {
    const row = this.database.sqlite
      .prepare("SELECT * FROM user_memories WHERE owner_user_id = ? AND id = ?")
      .get(ownerUserId, id) as UserMemoryRow | undefined;
    return row ? mapMemory(row) : null;
  }

  async create(value: UserMemory): Promise<void> {
    this.database.sqlite
      .prepare(
        "INSERT INTO user_memories (id, owner_user_id, kind, content, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        value.id,
        value.ownerUserId,
        value.kind,
        value.content,
        Number(value.enabled),
        value.createdAt.toISOString(),
        value.updatedAt.toISOString(),
      );
  }

  async update(
    ownerUserId: string,
    id: string,
    value: Pick<UserMemory, "kind" | "content" | "enabled" | "updatedAt">,
  ): Promise<boolean> {
    const result = this.database.sqlite
      .prepare(
        "UPDATE user_memories SET kind = ?, content = ?, enabled = ?, updated_at = ? WHERE owner_user_id = ? AND id = ?",
      )
      .run(
        value.kind,
        value.content,
        Number(value.enabled),
        value.updatedAt.toISOString(),
        ownerUserId,
        id,
      );
    return result.changes === 1;
  }

  async delete(ownerUserId: string, id: string): Promise<boolean> {
    return (
      this.database.sqlite
        .prepare("DELETE FROM user_memories WHERE owner_user_id = ? AND id = ?")
        .run(ownerUserId, id).changes === 1
    );
  }
}
