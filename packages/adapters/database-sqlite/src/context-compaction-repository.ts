import type {
  ContextCompaction,
  ContextCompactionRepository,
  ConversationId,
  MessageId,
} from "@zimo/domain";

import type { ZimoDatabase } from "./index";

interface ContextCompactionRow {
  id: string;
  conversation_id: string;
  version: number;
  status: ContextCompaction["status"];
  trigger: ContextCompaction["trigger"];
  source_from_message_id: string;
  source_to_message_id: string;
  covered_through_position: number;
  retained_from_position: number;
  summary: string | null;
  input_tokens: number;
  output_tokens: number | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteContextCompactionRepository implements ContextCompactionRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async listByConversation(conversationId: ConversationId): Promise<readonly ContextCompaction[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT * FROM conversation_context_compactions
         WHERE conversation_id = ? ORDER BY version DESC LIMIT 100`,
      )
      .all(conversationId) as unknown as ContextCompactionRow[];
    return rows.reverse().map(mapContextCompaction);
  }

  async create(value: ContextCompaction): Promise<void> {
    if (
      value.status !== "running" ||
      value.summary !== undefined ||
      value.outputTokens !== undefined ||
      value.errorCode !== undefined
    ) {
      throw new Error("New context compaction must be running");
    }
    this.database.sqlite
      .prepare(
        `INSERT INTO conversation_context_compactions
          (id, conversation_id, version, status, trigger, source_from_message_id,
           source_to_message_id, covered_through_position, retained_from_position, summary,
           input_tokens, output_tokens, error_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?)`,
      )
      .run(
        value.id,
        value.conversationId,
        value.version,
        value.status,
        value.trigger,
        value.sourceFromMessageId,
        value.sourceToMessageId,
        value.coveredThroughPosition,
        value.retainedFromPosition,
        value.inputTokens,
        value.createdAt.toISOString(),
        value.updatedAt.toISOString(),
      );
  }

  async complete(
    id: string,
    value: Readonly<{ summary: string; outputTokens: number; updatedAt: Date }>,
  ): Promise<void> {
    const result = this.database.sqlite
      .prepare(
        `UPDATE conversation_context_compactions
         SET status = 'completed', summary = ?, output_tokens = ?, updated_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .run(value.summary, value.outputTokens, value.updatedAt.toISOString(), id);
    if (result.changes !== 1) throw new Error("Context compaction is not running");
  }

  async fail(id: string, value: Readonly<{ errorCode: string; updatedAt: Date }>): Promise<void> {
    this.database.sqlite
      .prepare(
        `UPDATE conversation_context_compactions
         SET status = 'failed', error_code = ?, updated_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .run(value.errorCode, value.updatedAt.toISOString(), id);
  }

  async repairInterrupted(updatedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        `UPDATE conversation_context_compactions
         SET status = 'failed', error_code = 'COMPACTION_INTERRUPTED', updated_at = ?
         WHERE status = 'running'`,
      )
      .run(updatedAt.toISOString());
  }
}

function mapContextCompaction(row: ContextCompactionRow): ContextCompaction {
  return {
    id: row.id,
    conversationId: row.conversation_id as ConversationId,
    version: row.version,
    status: row.status,
    trigger: row.trigger,
    sourceFromMessageId: row.source_from_message_id as MessageId,
    sourceToMessageId: row.source_to_message_id as MessageId,
    coveredThroughPosition: row.covered_through_position,
    retainedFromPosition: row.retained_from_position,
    ...(row.summary ? { summary: row.summary } : {}),
    inputTokens: row.input_tokens,
    ...(row.output_tokens !== null ? { outputTokens: row.output_tokens } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
