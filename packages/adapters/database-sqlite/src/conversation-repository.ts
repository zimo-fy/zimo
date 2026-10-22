import type {
  AssistantStep,
  CatalogModelSelection,
  Conversation,
  ConversationCapabilities,
  ConversationCapabilityReferenceKind,
  ConversationId,
  ConversationRepository,
  ConversationSummary,
  KnowledgeCitation,
  Message,
  MessageId,
  MessageStatus,
  ModelId,
  PrototypeId,
  RunId,
  TokenUsage,
} from "@zimo/domain";
import { AppError, mergeTokenUsage } from "@zimo/domain";

import {
  mapConversationMessage,
  parseMessageUsage,
  readCatalogModel,
  serializeMessageSteps,
  type ConversationRow,
  type MessageRow,
} from "./conversation-records";
import type { ZimoDatabase } from "./index";

export class SQLiteConversationRepository implements ConversationRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async create(conversation: Conversation): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO conversations
          (id, title, model_id, agent_id, skill_ids_json, active_run_id,
           knowledge_base_ids_json, workflow_id, mcp_tool_ids_json, browser_enabled,
           created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        conversation.id,
        conversation.title,
        conversation.modelId,
        conversation.agentId ?? null,
        JSON.stringify(conversation.skillIds),
        JSON.stringify(conversation.knowledgeBaseIds),
        conversation.workflowId ?? null,
        JSON.stringify(conversation.mcpToolIds),
        conversation.browserEnabled ? 1 : 0,
        conversation.createdAt.toISOString(),
        conversation.updatedAt.toISOString(),
      );
  }

  async getById(id: ConversationId): Promise<Conversation | null> {
    const row = this.database.sqlite
      .prepare("SELECT * FROM conversations WHERE id = ? AND deleted_at IS NULL")
      .get(id) as unknown as ConversationRow | undefined;
    if (!row) return null;
    const catalogModel = readCatalogModel(row);
    const messageRows = this.database.sqlite
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY position")
      .all(id) as unknown as MessageRow[];
    return {
      id: row.id as ConversationId,
      title: row.title,
      modelId: row.model_id as ModelId,
      ...(catalogModel ? { catalogModel } : {}),
      ...(row.agent_id ? { agentId: row.agent_id as PrototypeId } : {}),
      skillIds: parseIds(row.skill_ids_json),
      knowledgeBaseIds: parseIds(row.knowledge_base_ids_json),
      ...(row.workflow_id ? { workflowId: row.workflow_id as PrototypeId } : {}),
      mcpToolIds: parseStrings(row.mcp_tool_ids_json),
      browserEnabled: row.browser_enabled === 1,
      ...(row.active_run_id ? { activeRunId: row.active_run_id as RunId } : {}),
      messages: messageRows.map(mapConversationMessage),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async list(): Promise<readonly ConversationSummary[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT c.id, c.title, c.model_id,
          COALESCE(c.catalog_model_display_name, m.display_name) AS model_display_name,
          c.created_at, c.updated_at, c.is_pinned,
          (SELECT COUNT(*) FROM messages msg WHERE msg.conversation_id = c.id) AS message_count,
          (SELECT substr(msg.content, 1, 120) FROM messages msg
            WHERE msg.conversation_id = c.id AND msg.content <> ''
            ORDER BY msg.position DESC LIMIT 1) AS last_message_preview
         FROM conversations c JOIN models m ON m.id = c.model_id
         WHERE c.deleted_at IS NULL ORDER BY c.is_pinned DESC, c.updated_at DESC`,
      )
      .all() as unknown as ConversationSummaryRow[];
    return rows.map((row) => ({
      id: row.id as ConversationId,
      title: row.title,
      modelId: row.model_id as ModelId,
      modelDisplayName: row.model_display_name,
      messageCount: row.message_count,
      ...(row.last_message_preview ? { lastMessagePreview: row.last_message_preview } : {}),
      isPinned: row.is_pinned === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async createRunMessages(options: {
    conversationId: ConversationId;
    runId: RunId;
    userMessage?: Message;
    assistantMessage: Message;
    artifactIds?: readonly string[];
  }): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.database.sqlite
        .prepare(
          "UPDATE conversations SET active_run_id = ?, updated_at = ? WHERE id = ? AND active_run_id IS NULL AND deleted_at IS NULL",
        )
        .run(
          options.runId,
          options.assistantMessage.updatedAt.toISOString(),
          options.conversationId,
        );
      if (updated.changes !== 1) throw new Error("Conversation already has an active run");
      if (options.userMessage) {
        this.insertMessage(options.userMessage);
        this.bindDraftArtifacts(
          options.conversationId,
          options.userMessage.id,
          options.artifactIds ?? [],
          options.userMessage.createdAt,
        );
      } else if (options.artifactIds?.length) {
        throw invalidDraftArtifacts();
      }
      this.insertMessage(options.assistantMessage);
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async appendMessageText(id: MessageId, delta: string, updatedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        "UPDATE messages SET content = content || ?, updated_at = ? WHERE id = ? AND status = 'streaming'",
      )
      .run(delta, updatedAt.toISOString(), id);
  }

  async updateMessageStatus(
    id: MessageId,
    from: readonly MessageStatus[],
    status: MessageStatus,
    options: { errorCode?: string; usage?: TokenUsage; updatedAt: Date },
  ): Promise<boolean> {
    const placeholders = from.map(() => "?").join(", ");
    const result = this.database.sqlite
      .prepare(
        `UPDATE messages SET status = ?, error_code = ?, usage_json = ?, updated_at = ?
         WHERE id = ? AND status IN (${placeholders})`,
      )
      .run(
        status,
        options.errorCode ?? null,
        options.usage ? JSON.stringify({ schemaVersion: 1, ...options.usage }) : null,
        options.updatedAt.toISOString(),
        id,
        ...from,
      );
    return result.changes === 1;
  }

  async mergeMessageUsage(id: MessageId, incoming: TokenUsage): Promise<TokenUsage | undefined> {
    const row = this.database.sqlite
      .prepare("SELECT usage_json FROM messages WHERE id = ?")
      .get(id) as { usage_json: string | null } | undefined;
    if (!row) return undefined;
    const merged = mergeTokenUsage(parseMessageUsage(row.usage_json), incoming);
    if (!merged) return undefined;
    this.database.sqlite
      .prepare("UPDATE messages SET usage_json = ? WHERE id = ?")
      .run(JSON.stringify({ schemaVersion: 1, ...merged }), id);
    return merged;
  }

  async clearActiveRun(id: ConversationId, runId: RunId, updatedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        "UPDATE conversations SET active_run_id = NULL, updated_at = ? WHERE id = ? AND active_run_id = ?",
      )
      .run(updatedAt.toISOString(), id, runId);
  }

  async rename(id: ConversationId, title: string, updatedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      )
      .run(title, updatedAt.toISOString(), id);
  }

  async setPinned(id: ConversationId, pinned: boolean): Promise<void> {
    this.database.sqlite
      .prepare("UPDATE conversations SET is_pinned = ? WHERE id = ? AND deleted_at IS NULL")
      .run(pinned ? 1 : 0, id);
  }

  async changeModel(id: ConversationId, modelId: ModelId, updatedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        `UPDATE conversations
         SET model_id = ?, catalog_model_id = NULL, catalog_model_code = NULL,
             catalog_model_display_name = NULL, catalog_model_reasoning = NULL,
             catalog_model_vision = NULL, updated_at = ?
         WHERE id = ? AND active_run_id IS NULL AND deleted_at IS NULL`,
      )
      .run(modelId, updatedAt.toISOString(), id);
  }

  async setCatalogModel(
    id: ConversationId,
    selection: CatalogModelSelection,
    updatedAt: Date,
  ): Promise<void> {
    const updated = this.database.sqlite
      .prepare(
        `UPDATE conversations
         SET catalog_model_id = ?, catalog_model_code = ?, catalog_model_display_name = ?,
             catalog_model_reasoning = ?, catalog_model_vision = ?, updated_at = ?
         WHERE id = ? AND active_run_id IS NULL AND deleted_at IS NULL`,
      )
      .run(
        selection.catalogId,
        selection.modelCode,
        selection.displayName,
        selection.supportsReasoning ? 1 : 0,
        selection.supportsImages ? 1 : 0,
        updatedAt.toISOString(),
        id,
      );
    if (updated.changes !== 1) {
      throw new AppError({
        code: "CONVERSATION_NOT_FOUND",
        category: "user",
        userMessage: "会话不存在或正在运行，暂时不能切换模型。",
      });
    }
  }

  async changeCapabilities(
    id: ConversationId,
    capabilities: ConversationCapabilities,
    updatedAt: Date,
  ): Promise<void> {
    this.database.sqlite
      .prepare(
        `UPDATE conversations SET agent_id = ?, skill_ids_json = ?, knowledge_base_ids_json = ?,
          workflow_id = ?, mcp_tool_ids_json = ?, browser_enabled = ?, updated_at = ?
         WHERE id = ? AND active_run_id IS NULL AND deleted_at IS NULL`,
      )
      .run(
        capabilities.agentId ?? null,
        JSON.stringify(capabilities.skillIds),
        JSON.stringify(capabilities.knowledgeBaseIds),
        capabilities.workflowId ?? null,
        JSON.stringify(capabilities.mcpToolIds),
        capabilities.browserEnabled ? 1 : 0,
        updatedAt.toISOString(),
        id,
      );
  }

  async saveKnowledgeCitations(
    id: MessageId,
    citations: readonly KnowledgeCitation[],
  ): Promise<void> {
    this.database.sqlite
      .prepare("UPDATE messages SET knowledge_citations_json = ? WHERE id = ?")
      .run(JSON.stringify(citations), id);
  }

  async saveMessageSteps(id: MessageId, steps: readonly AssistantStep[]): Promise<void> {
    this.database.sqlite
      .prepare("UPDATE messages SET steps_json = ? WHERE id = ?")
      .run(serializeMessageSteps(steps), id);
  }

  async hasCapabilityReference(
    kind: ConversationCapabilityReferenceKind,
    id: string,
  ): Promise<boolean> {
    const query = capabilityReferenceQuery(kind);
    const parameter = kind === "mcp-server" ? `mcp.${id}.%` : id;
    const row = this.database.sqlite.prepare(query).get(parameter) as { found: number } | undefined;
    return Boolean(row);
  }

  async softDelete(id: ConversationId, deletedAt: Date): Promise<void> {
    this.database.sqlite
      .prepare(
        "UPDATE conversations SET deleted_at = ?, updated_at = ?, active_run_id = NULL WHERE id = ?",
      )
      .run(deletedAt.toISOString(), deletedAt.toISOString(), id);
  }

  async repairInterruptedMessages(updatedAt: Date): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      this.database.sqlite
        .prepare(
          "UPDATE messages SET status = 'failed', error_code = 'RUN_INTERRUPTED', updated_at = ? WHERE status IN ('pending', 'streaming')",
        )
        .run(updatedAt.toISOString());
      this.database.sqlite
        .prepare(
          "UPDATE conversations SET active_run_id = NULL, updated_at = ? WHERE active_run_id IS NOT NULL",
        )
        .run(updatedAt.toISOString());
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  private insertMessage(message: Message): void {
    this.database.sqlite
      .prepare(
        `INSERT INTO messages
          (id, conversation_id, role, content, status, position, replaces_message_id,
           error_code, usage_json, knowledge_citations_json, steps_json, model_display_name,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.status,
        message.position,
        message.replacesMessageId ?? null,
        message.errorCode ?? null,
        message.usage ? JSON.stringify({ schemaVersion: 1, ...message.usage }) : null,
        JSON.stringify(message.knowledgeCitations ?? []),
        message.steps?.length ? serializeMessageSteps(message.steps) : null,
        message.modelDisplayName ?? null,
        message.createdAt.toISOString(),
        message.updatedAt.toISOString(),
      );
  }

  private bindDraftArtifacts(
    conversationId: ConversationId,
    messageId: MessageId,
    artifactIds: readonly string[],
    createdAt: Date,
  ): void {
    if (artifactIds.length === 0) return;
    const uniqueIds = [...new Set(artifactIds)];
    if (uniqueIds.length !== artifactIds.length || uniqueIds.length > 10) {
      throw invalidDraftArtifacts();
    }
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const rows = this.database.sqlite
      .prepare(
        `SELECT a.id, a.current_revision_id FROM document_artifacts a
         WHERE a.conversation_id = ? AND a.status = 'ready' AND a.id IN (${placeholders})
           AND NOT EXISTS (
             SELECT 1 FROM message_artifact_bindings b WHERE b.artifact_id = a.id
           )`,
      )
      .all(conversationId, ...uniqueIds) as unknown as {
      id: string;
      current_revision_id: string;
    }[];
    if (rows.length !== uniqueIds.length) throw invalidDraftArtifacts();
    const insert = this.database.sqlite.prepare(
      `INSERT INTO message_artifact_bindings
        (message_id, artifact_id, revision_id, relation, created_at)
       VALUES (?, ?, ?, 'input', ?)`,
    );
    for (const artifact of rows) {
      insert.run(messageId, artifact.id, artifact.current_revision_id, createdAt.toISOString());
    }
  }
}

function invalidDraftArtifacts() {
  return new AppError({
    code: "DOCUMENT_ATTACHMENT_INVALID",
    category: "user",
    userMessage: "部分附件不存在、已发送或不属于当前会话，请重新选择。",
  });
}

interface ConversationSummaryRow {
  id: string;
  title: string;
  model_id: string;
  model_display_name: string;
  message_count: number;
  last_message_preview: string | null;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

function parseIds(value: string): PrototypeId[] {
  return parseStrings(value) as PrototypeId[];
}

function parseStrings(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Invalid stored conversation capability IDs");
  }
  return parsed;
}

function capabilityReferenceQuery(kind: ConversationCapabilityReferenceKind): string {
  if (kind === "agent") {
    return "SELECT 1 AS found FROM conversations WHERE deleted_at IS NULL AND agent_id = ? LIMIT 1";
  }
  if (kind === "workflow") {
    return "SELECT 1 AS found FROM conversations WHERE deleted_at IS NULL AND workflow_id = ? LIMIT 1";
  }
  const column =
    kind === "skill"
      ? "skill_ids_json"
      : kind === "knowledge"
        ? "knowledge_base_ids_json"
        : "mcp_tool_ids_json";
  const operator = kind === "mcp-server" ? "LIKE" : "=";
  return `SELECT 1 AS found FROM conversations c, json_each(c.${column}) selected
    WHERE c.deleted_at IS NULL AND selected.value ${operator} ? LIMIT 1`;
}
