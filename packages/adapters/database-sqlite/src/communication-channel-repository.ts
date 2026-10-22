import type {
  CommunicationChannelBinding,
  CommunicationChannelKind,
  CommunicationChannelRepository,
  WeixinAssistantRepository,
} from "@zimo/domain";

import type { ZimoDatabase } from "./index";

interface BindingRow {
  owner_user_id: string;
  kind: CommunicationChannelKind;
  status: "unbound" | "bound";
  account_label: string | null;
  secret_ref: string | null;
  config_json: string;
  bound_at: string | null;
  updated_at: string;
}

export class SQLiteCommunicationChannelRepository implements CommunicationChannelRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async list(ownerUserId: string): Promise<readonly CommunicationChannelBinding[]> {
    const rows = this.database.sqlite
      .prepare("SELECT * FROM communication_channel_bindings WHERE owner_user_id = ? ORDER BY kind")
      .all(ownerUserId) as unknown as BindingRow[];
    return rows.map(mapBinding);
  }

  async get(
    ownerUserId: string,
    kind: CommunicationChannelKind,
  ): Promise<CommunicationChannelBinding | null> {
    const row = this.database.sqlite
      .prepare("SELECT * FROM communication_channel_bindings WHERE owner_user_id = ? AND kind = ?")
      .get(ownerUserId, kind) as unknown as BindingRow | undefined;
    return row ? mapBinding(row) : null;
  }

  async save(binding: CommunicationChannelBinding): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO communication_channel_bindings
          (owner_user_id, kind, status, account_label, secret_ref, config_json, bound_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(owner_user_id, kind) DO UPDATE SET
          status = excluded.status, account_label = excluded.account_label,
          secret_ref = excluded.secret_ref, config_json = excluded.config_json,
          bound_at = excluded.bound_at, updated_at = excluded.updated_at`,
      )
      .run(
        binding.ownerUserId,
        binding.kind,
        binding.status,
        binding.accountLabel ?? null,
        binding.secretRef ?? null,
        JSON.stringify(binding.config),
        binding.boundAt?.toISOString() ?? null,
        binding.updatedAt.toISOString(),
      );
  }

  async clear(ownerUserId: string, kind: CommunicationChannelKind, updatedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO communication_channel_bindings
          (owner_user_id, kind, status, account_label, secret_ref, config_json, bound_at, updated_at)
         VALUES (?, ?, 'unbound', NULL, NULL, '{}', NULL, ?)
         ON CONFLICT(owner_user_id, kind) DO UPDATE SET
          status = 'unbound', account_label = NULL, secret_ref = NULL,
          config_json = '{}', bound_at = NULL, updated_at = excluded.updated_at`,
      )
      .run(ownerUserId, kind, updatedAt.toISOString());
  }
}

export class SQLiteWeixinAssistantRepository implements WeixinAssistantRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async getConversationId(ownerUserId: string): Promise<string | null> {
    const row = this.database.sqlite
      .prepare("SELECT conversation_id FROM weixin_assistant_routes WHERE owner_user_id = ?")
      .get(ownerUserId) as { conversation_id: string } | undefined;
    return row?.conversation_id ?? null;
  }

  async saveConversationId(
    ownerUserId: string,
    conversationId: string,
    updatedAt: Date,
  ): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO weixin_assistant_routes (owner_user_id, conversation_id, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(owner_user_id) DO UPDATE SET
          conversation_id = excluded.conversation_id, updated_at = excluded.updated_at`,
      )
      .run(ownerUserId, conversationId, updatedAt.toISOString());
  }

  async claimInbound(ownerUserId: string, dedupeKey: string, receivedAt: Date): Promise<boolean> {
    const staleBefore = new Date(receivedAt.getTime() - 5 * 60_000).toISOString();
    const result = this.database.sqlite
      .prepare(
        `INSERT INTO weixin_inbound_receipts
          (owner_user_id, dedupe_key, status, received_at, finished_at, error_code)
         VALUES (?, ?, 'processing', ?, NULL, NULL)
         ON CONFLICT(owner_user_id, dedupe_key) DO UPDATE SET
          status = 'processing', received_at = excluded.received_at,
          finished_at = NULL, error_code = NULL
         WHERE weixin_inbound_receipts.status = 'processing'
           AND weixin_inbound_receipts.received_at < ?`,
      )
      .run(ownerUserId, dedupeKey, receivedAt.toISOString(), staleBefore);
    return result.changes > 0;
  }

  async finishInbound(
    ownerUserId: string,
    dedupeKey: string,
    status: "completed" | "failed",
    finishedAt: Date,
    errorCode?: string,
  ): Promise<void> {
    this.database.sqlite
      .prepare(
        `UPDATE weixin_inbound_receipts
         SET status = ?, finished_at = ?, error_code = ?
         WHERE owner_user_id = ? AND dedupe_key = ?`,
      )
      .run(status, finishedAt.toISOString(), errorCode ?? null, ownerUserId, dedupeKey);
  }
}

function mapBinding(row: BindingRow): CommunicationChannelBinding {
  return {
    ownerUserId: row.owner_user_id,
    kind: row.kind,
    status: row.status,
    ...(row.account_label ? { accountLabel: row.account_label } : {}),
    ...(row.secret_ref ? { secretRef: row.secret_ref } : {}),
    config: parseConfig(row.config_json),
    ...(row.bound_at ? { boundAt: new Date(row.bound_at) } : {}),
    updatedAt: new Date(row.updated_at),
  };
}

function parseConfig(value: string): Record<string, string | number | boolean> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid communication channel config");
  }
  const entries = Object.entries(parsed);
  if (entries.length > 20) throw new Error("Communication channel config is too large");
  for (const [key, item] of entries) {
    if (key.length > 80 || !["string", "number", "boolean"].includes(typeof item)) {
      throw new Error("Invalid communication channel config");
    }
  }
  return Object.fromEntries(entries) as Record<string, string | number | boolean>;
}
