import { DatabaseSync } from "node:sqlite";

import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { eq } from "drizzle-orm";
import type {
  AgentRunRecord,
  AgentRunRepository,
  AgentRunStatus,
  IntentRouteRecord,
  IntentRouteRepository,
  KnowledgeChunk,
  KnowledgeChunkId,
  KnowledgeDocument,
  KnowledgeDocumentId,
  KnowledgeLexicalHit,
  KnowledgeRepository,
  ModelCapabilities,
  ModelDefinition,
  ModelId,
  ModelProviderConfig,
  ModelProviderId,
  ModelProviderWithModels,
  ModelRepository,
  PrototypeDefinition,
  PrototypeId,
  PrototypeKind,
  PrototypeRepository,
  ResolvedModel,
  RunId,
  WorkflowRepository,
} from "@zimo/domain";

import {
  agentRunRecords,
  intentRouteRecords,
  knowledgeBases,
  knowledgeChunks,
  knowledgeDocuments,
  prototypeDefinitions,
  workflowDefinitions,
} from "./schema";
import { applyDatabaseMigrations, type Migration } from "./database-migrations";
import { replaceMcpBindings, withMcpServerIds } from "./prototype-mcp-bindings";

export type { Migration } from "./database-migrations";

export {
  SQLiteCommunicationChannelRepository,
  SQLiteWeixinAssistantRepository,
} from "./communication-channel-repository";
export { SQLiteConversationRepository } from "./conversation-repository";
export { SQLiteAutomationRepository } from "./automation-repository";
export { SQLiteAppSettingsStore } from "./app-settings-store";
export { SQLiteDocumentArtifactRepository } from "./document-artifact-repository";
export { SQLiteMcpConnectionRepository } from "./mcp-connection-repository";
export { SQLiteSessionStore } from "./session-store";
export {
  appSettings,
  agentRunRecords,
  conversations,
  intentRouteRecords,
  knowledgeBases,
  knowledgeChunks,
  knowledgeDocuments,
  messages,
  modelProviders,
  models,
  prototypeDefinitions,
  userSessions,
  workflowDefinitions,
} from "./schema";

export { SQLiteKnowledgeCloudLinkRepository } from "./knowledge-cloud-link-repository";

export class SQLiteKnowledgeRepository implements KnowledgeRepository {
  readonly kind = "knowledge" as const;

  constructor(private readonly database: ZimoDatabase) {}

  async list(): Promise<readonly PrototypeDefinition[]> {
    const bases = this.database.db.select().from(knowledgeBases).all();
    return Promise.all(
      bases
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((row) => this.toDefinition(row)),
    );
  }

  async getById(id: PrototypeId): Promise<PrototypeDefinition | null> {
    const row = this.database.db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, id))
      .get();
    return row ? this.toDefinition(row) : null;
  }

  async save(value: PrototypeDefinition): Promise<void> {
    if (value.kind !== "knowledge") throw new Error("Knowledge repository kind mismatch");
    const row = {
      id: value.id,
      name: value.name,
      description: value.description,
      status: value.status,
      category: value.category,
      tagsJson: JSON.stringify(value.tags),
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
    };
    this.database.db
      .insert(knowledgeBases)
      .values(row)
      .onConflictDoUpdate({ target: knowledgeBases.id, set: row })
      .run();
  }

  async delete(id: PrototypeId): Promise<void> {
    this.database.db.delete(knowledgeBases).where(eq(knowledgeBases.id, id)).run();
  }

  async listDocuments(knowledgeBaseId: PrototypeId): Promise<readonly KnowledgeDocument[]> {
    return this.database.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId))
      .all()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toKnowledgeDocument);
  }

  async getDocument(id: KnowledgeDocumentId): Promise<KnowledgeDocument | null> {
    const row = this.database.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id))
      .get();
    return row ? toKnowledgeDocument(row) : null;
  }

  async findDocumentByChecksum(
    knowledgeBaseId: PrototypeId,
    checksum: string,
  ): Promise<KnowledgeDocument | null> {
    const row = this.database.sqlite
      .prepare(
        "SELECT * FROM knowledge_documents WHERE knowledge_base_id = ? AND checksum = ? LIMIT 1",
      )
      .get(knowledgeBaseId, checksum) as KnowledgeDocumentRow | undefined;
    return row ? toKnowledgeDocumentRaw(row) : null;
  }

  async saveDocument(document: KnowledgeDocument): Promise<void> {
    const row = {
      id: document.id,
      knowledgeBaseId: document.knowledgeBaseId,
      name: document.name,
      mediaType: document.mediaType,
      sizeBytes: document.sizeBytes,
      checksum: document.checksum,
      storageKey: document.storageKey,
      status: document.status,
      errorCode: document.errorCode ?? null,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
    this.database.db
      .insert(knowledgeDocuments)
      .values(row)
      .onConflictDoUpdate({ target: knowledgeDocuments.id, set: row })
      .run();
  }

  async deleteDocument(id: KnowledgeDocumentId): Promise<void> {
    this.database.db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id)).run();
  }

  async replaceChunks(
    documentId: KnowledgeDocumentId,
    chunks: readonly KnowledgeChunk[],
  ): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      this.database.db
        .delete(knowledgeChunks)
        .where(eq(knowledgeChunks.documentId, documentId))
        .run();
      if (chunks.length > 0) {
        this.database.db
          .insert(knowledgeChunks)
          .values(
            chunks.map((chunk) => ({
              id: chunk.id,
              knowledgeBaseId: chunk.knowledgeBaseId,
              documentId: chunk.documentId,
              ordinal: chunk.ordinal,
              text: chunk.text,
              metadataJson: JSON.stringify(chunk.metadata),
              embeddingBlob: chunk.embedding ? vectorToBuffer(chunk.embedding) : null,
              createdAt: chunk.createdAt.toISOString(),
            })),
          )
          .run();
      }
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async listChunks(knowledgeBaseId: PrototypeId): Promise<readonly KnowledgeChunk[]> {
    return this.database.db
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.knowledgeBaseId, knowledgeBaseId))
      .all()
      .map(toKnowledgeChunk);
  }

  async searchLexical(
    knowledgeBaseId: PrototypeId,
    query: string,
    limit: number,
  ): Promise<readonly KnowledgeLexicalHit[]> {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rawRows =
      query.length < 3
        ? (this.database.sqlite
            .prepare(
              `SELECT c.*, 0 AS lexical_rank
               FROM knowledge_chunks c
               WHERE c.knowledge_base_id = ? AND instr(lower(c.text), lower(?)) > 0
               ORDER BY c.ordinal ASC LIMIT ?`,
            )
            .all(knowledgeBaseId, query, safeLimit) as KnowledgeChunkSearchRow[])
        : (this.database.sqlite
            .prepare(
              `SELECT c.*, bm25(knowledge_chunks_fts) AS lexical_rank
               FROM knowledge_chunks_fts
               JOIN knowledge_chunks c ON c.rowid = knowledge_chunks_fts.rowid
               WHERE knowledge_chunks_fts MATCH ? AND c.knowledge_base_id = ?
               ORDER BY lexical_rank ASC LIMIT ?`,
            )
            .all(ftsPhrase(query), knowledgeBaseId, safeLimit) as KnowledgeChunkSearchRow[]);
    return rawRows.map((row, index) => ({
      chunk: toKnowledgeChunkRaw(row),
      score: 1 / (index + 1),
    }));
  }

  private async toDefinition(
    row: typeof knowledgeBases.$inferSelect,
  ): Promise<PrototypeDefinition> {
    const documents = await this.listDocuments(row.id as PrototypeId);
    return {
      id: row.id as PrototypeId,
      kind: "knowledge",
      name: row.name,
      description: row.description,
      status: row.status as PrototypeDefinition["status"],
      category: row.category,
      tags: JSON.parse(row.tagsJson) as string[],
      icon: "知",
      version: "1.0.0",
      source: "Zimo 本地知识库",
      permissions: ["读取用户明确导入的文件"],
      capabilities: ["FTS5 全文检索", "本地 Embedding（可选）"],
      associations: [],
      workflowNodes: [],
      workflowEdges: [],
      documents: documents.map((document) => ({
        id: document.id,
        name: document.name,
        sizeLabel: formatSize(document.sizeBytes),
        status: document.status,
      })),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

type KnowledgeDocumentRow = {
  id: string;
  knowledge_base_id: string;
  name: string;
  media_type: string;
  size_bytes: number;
  checksum: string;
  storage_key: string;
  status: string;
  error_code: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

type KnowledgeChunkSearchRow = {
  id: string;
  knowledge_base_id: string;
  document_id: string;
  ordinal: number;
  text: string;
  metadata_json: string;
  embedding_blob: Uint8Array | null;
  created_at: string;
  lexical_rank: number;
};

function toKnowledgeDocument(row: typeof knowledgeDocuments.$inferSelect): KnowledgeDocument {
  return {
    id: row.id as KnowledgeDocumentId,
    knowledgeBaseId: row.knowledgeBaseId as PrototypeId,
    name: row.name,
    mediaType: row.mediaType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    storageKey: row.storageKey,
    status: row.status as KnowledgeDocument["status"],
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
    chunkCount: row.chunkCount,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function toKnowledgeDocumentRaw(row: KnowledgeDocumentRow): KnowledgeDocument {
  return {
    id: row.id as KnowledgeDocumentId,
    knowledgeBaseId: row.knowledge_base_id as PrototypeId,
    name: row.name,
    mediaType: row.media_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    storageKey: row.storage_key,
    status: row.status as KnowledgeDocument["status"],
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    chunkCount: row.chunk_count,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toKnowledgeChunk(row: typeof knowledgeChunks.$inferSelect): KnowledgeChunk {
  return {
    id: row.id as KnowledgeChunkId,
    knowledgeBaseId: row.knowledgeBaseId as PrototypeId,
    documentId: row.documentId as KnowledgeDocumentId,
    ordinal: row.ordinal,
    text: row.text,
    metadata: JSON.parse(row.metadataJson) as KnowledgeChunk["metadata"],
    ...(row.embeddingBlob ? { embedding: bufferToVector(row.embeddingBlob) } : {}),
    createdAt: new Date(row.createdAt),
  };
}

function toKnowledgeChunkRaw(row: KnowledgeChunkSearchRow): KnowledgeChunk {
  return {
    id: row.id as KnowledgeChunkId,
    knowledgeBaseId: row.knowledge_base_id as PrototypeId,
    documentId: row.document_id as KnowledgeDocumentId,
    ordinal: row.ordinal,
    text: row.text,
    metadata: JSON.parse(row.metadata_json) as KnowledgeChunk["metadata"],
    ...(row.embedding_blob ? { embedding: bufferToVector(row.embedding_blob) } : {}),
    createdAt: new Date(row.created_at),
  };
}

function vectorToBuffer(vector: readonly number[]): Buffer {
  return Buffer.from(Float32Array.from(vector).buffer);
}

function bufferToVector(buffer: Uint8Array): readonly number[] {
  const copy = Uint8Array.from(buffer);
  return [...new Float32Array(copy.buffer)];
}

function ftsPhrase(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatSize(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export class SQLiteAgentRunRepository implements AgentRunRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async start(record: AgentRunRecord): Promise<void> {
    this.database.db
      .insert(agentRunRecords)
      .values({
        id: record.id,
        conversationId: record.conversationId,
        agentId: record.agentId,
        modelId: record.modelId,
        skillIdsJson: JSON.stringify(record.skillIds),
        knowledgeBaseIdsJson: JSON.stringify(record.knowledgeBaseIds),
        status: record.status,
        errorCode: record.errorCode ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })
      .run();
  }

  async finish(
    id: RunId,
    status: Exclude<AgentRunStatus, "running">,
    updatedAt: Date,
    errorCode?: string,
  ): Promise<void> {
    this.database.db
      .update(agentRunRecords)
      .set({ status, updatedAt: updatedAt.toISOString(), errorCode: errorCode ?? null })
      .where(eq(agentRunRecords.id, id))
      .run();
  }
}

export class SQLitePrototypeRepository<
  K extends Extract<PrototypeKind, "agent" | "skill">,
> implements PrototypeRepository {
  constructor(
    private readonly database: ZimoDatabase,
    readonly kind: K,
  ) {}

  async list(): Promise<readonly PrototypeDefinition[]> {
    return this.database.db
      .select()
      .from(prototypeDefinitions)
      .where(eq(prototypeDefinitions.kind, this.kind))
      .all()
      .map((row) =>
        this.kind === "agent"
          ? withMcpServerIds(this.database, "agent", row.id, toPrototypeDefinition(row))
          : toPrototypeDefinition(row),
      )
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async getById(id: PrototypeId): Promise<PrototypeDefinition | null> {
    const row = this.database.db
      .select()
      .from(prototypeDefinitions)
      .where(eq(prototypeDefinitions.id, id))
      .get();
    if (row?.kind !== this.kind) return null;
    return this.kind === "agent"
      ? withMcpServerIds(this.database, "agent", row.id, toPrototypeDefinition(row))
      : toPrototypeDefinition(row);
  }

  async save(value: PrototypeDefinition): Promise<void> {
    if (value.kind !== this.kind) throw new Error("Prototype repository kind mismatch");
    const row = fromPrototypeDefinition(value);
    this.database.db
      .insert(prototypeDefinitions)
      .values(row)
      .onConflictDoUpdate({ target: prototypeDefinitions.id, set: row })
      .run();
    if (value.kind === "agent" && value.mcpServerIds !== undefined) {
      replaceMcpBindings(this.database, "agent", value.id, value.mcpServerIds);
    }
  }

  async delete(id: PrototypeId): Promise<void> {
    this.database.db.delete(prototypeDefinitions).where(eq(prototypeDefinitions.id, id)).run();
  }
}

export class SQLiteWorkflowRepository implements WorkflowRepository {
  readonly kind = "workflow" as const;

  constructor(private readonly database: ZimoDatabase) {}

  async list(): Promise<readonly PrototypeDefinition[]> {
    return this.database.db
      .select()
      .from(workflowDefinitions)
      .all()
      .map((row) => withMcpServerIds(this.database, "workflow", row.id, toWorkflowDefinition(row)))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async getById(id: PrototypeId): Promise<PrototypeDefinition | null> {
    const row = this.database.db
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, id))
      .get();
    return row
      ? withMcpServerIds(this.database, "workflow", row.id, toWorkflowDefinition(row))
      : null;
  }

  async save(value: PrototypeDefinition): Promise<void> {
    if (value.kind !== "workflow") throw new Error("Workflow repository kind mismatch");
    const row = {
      id: value.id,
      name: value.name,
      description: value.description,
      status: value.status,
      category: value.category,
      tagsJson: JSON.stringify(value.tags),
      icon: value.icon,
      version: value.version,
      source: value.source,
      workflowNodesJson: JSON.stringify(value.workflowNodes),
      workflowEdgesJson: JSON.stringify(value.workflowEdges),
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
    };
    this.database.db
      .insert(workflowDefinitions)
      .values(row)
      .onConflictDoUpdate({ target: workflowDefinitions.id, set: row })
      .run();
    if (value.mcpServerIds !== undefined) {
      replaceMcpBindings(this.database, "workflow", value.id, value.mcpServerIds);
    }
  }

  async delete(id: PrototypeId): Promise<void> {
    this.database.db.delete(workflowDefinitions).where(eq(workflowDefinitions.id, id)).run();
  }
}

function toWorkflowDefinition(row: typeof workflowDefinitions.$inferSelect): PrototypeDefinition {
  return {
    id: row.id as PrototypeId,
    kind: "workflow",
    name: row.name,
    description: row.description,
    status: row.status as PrototypeDefinition["status"],
    category: row.category,
    tags: JSON.parse(row.tagsJson) as string[],
    icon: row.icon,
    version: row.version,
    source: row.source,
    permissions: [],
    capabilities: ["可视化编排", "知识检索节点"],
    associations: [],
    workflowNodes: JSON.parse(row.workflowNodesJson) as PrototypeDefinition["workflowNodes"],
    workflowEdges: JSON.parse(row.workflowEdgesJson) as PrototypeDefinition["workflowEdges"],
    documents: [],
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function fromPrototypeDefinition(value: PrototypeDefinition) {
  return {
    id: value.id,
    kind: value.kind,
    name: value.name,
    description: value.description,
    status: value.status,
    category: value.category,
    tagsJson: JSON.stringify(value.tags),
    icon: value.icon,
    version: value.version,
    source: value.source,
    modelId: value.modelId ?? null,
    systemPrompt: value.systemPrompt ?? null,
    skillIdsJson: JSON.stringify(value.skillIds ?? []),
    knowledgeBaseIdsJson: JSON.stringify(value.knowledgeBaseIds ?? []),
    skillPackageId: value.skillPackageId ?? null,
    skillInstructions: value.skillInstructions ?? null,
    skillChecksum: value.skillChecksum ?? null,
    agentCatalogId: value.agentCatalogId ?? null,
    agentRemoteId: value.agentRemoteId ?? null,
    permissionsJson: JSON.stringify(value.permissions),
    capabilitiesJson: JSON.stringify(value.capabilities),
    associationsJson: JSON.stringify(value.associations),
    installationStatus: value.installationStatus ?? null,
    workflowNodesJson: JSON.stringify(value.workflowNodes),
    workflowEdgesJson: JSON.stringify(value.workflowEdges),
    documentsJson: JSON.stringify(value.documents),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function toPrototypeDefinition(row: typeof prototypeDefinitions.$inferSelect): PrototypeDefinition {
  const skillIds = JSON.parse(row.skillIdsJson) as PrototypeId[];
  const knowledgeBaseIds = JSON.parse(row.knowledgeBaseIdsJson) as PrototypeId[];
  return {
    id: row.id as PrototypeId,
    kind: row.kind as PrototypeKind,
    name: row.name,
    description: row.description,
    status: row.status as PrototypeDefinition["status"],
    category: row.category,
    tags: JSON.parse(row.tagsJson) as string[],
    icon: row.icon,
    version: row.version,
    source: row.source,
    ...(row.modelId ? { modelId: row.modelId } : {}),
    ...(row.systemPrompt ? { systemPrompt: row.systemPrompt } : {}),
    ...(skillIds.length ? { skillIds } : {}),
    ...(knowledgeBaseIds.length ? { knowledgeBaseIds } : {}),
    ...(row.skillPackageId ? { skillPackageId: row.skillPackageId } : {}),
    ...(row.skillInstructions ? { skillInstructions: row.skillInstructions } : {}),
    ...(row.skillChecksum ? { skillChecksum: row.skillChecksum } : {}),
    ...(row.agentCatalogId ? { agentCatalogId: row.agentCatalogId } : {}),
    ...(row.agentRemoteId ? { agentRemoteId: row.agentRemoteId } : {}),
    permissions: JSON.parse(row.permissionsJson) as string[],
    capabilities: JSON.parse(row.capabilitiesJson) as string[],
    associations: JSON.parse(row.associationsJson) as string[],
    ...(row.installationStatus
      ? {
          installationStatus: row.installationStatus as NonNullable<
            PrototypeDefinition["installationStatus"]
          >,
        }
      : {}),
    workflowNodes: JSON.parse(row.workflowNodesJson) as PrototypeDefinition["workflowNodes"],
    workflowEdges: JSON.parse(row.workflowEdgesJson) as PrototypeDefinition["workflowEdges"],
    documents: JSON.parse(row.documentsJson) as PrototypeDefinition["documents"],
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export class SQLiteIntentRouteRepository implements IntentRouteRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async save(record: IntentRouteRecord): Promise<void> {
    this.database.db
      .insert(intentRouteRecords)
      .values({
        id: record.id,
        conversationId: record.conversationId,
        runId: record.runId,
        inputFingerprint: record.inputFingerprint,
        inputLength: record.inputLength,
        intent: record.intent,
        ...(record.targetId ? { targetId: record.targetId } : {}),
        confidence: record.confidence,
        durationMs: record.durationMs,
        didFallback: record.didFallback,
        ...(record.fallbackReason ? { fallbackReason: record.fallbackReason } : {}),
        createdAt: record.createdAt.toISOString(),
      })
      .run();
  }
}

export class ZimoDatabase {
  readonly sqlite: DatabaseSync;
  readonly db: NodeSQLiteDatabase;

  constructor(path: string, migrations: readonly Migration[]) {
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec("PRAGMA foreign_keys = ON");
    this.sqlite.exec("PRAGMA journal_mode = WAL");
    this.sqlite.exec("PRAGMA busy_timeout = 5000");
    applyDatabaseMigrations(this.sqlite, migrations);
    this.db = drizzle({ client: this.sqlite });
  }

  close(): void {
    this.sqlite.close();
  }
}

interface ProviderRow {
  id: string;
  name: string;
  base_url: string;
  secret_ref: string;
  key_hint: string;
  kind: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface ModelRow {
  id: string;
  provider_id: string;
  name: string;
  display_name: string;
  capabilities_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteModelRepository implements ModelRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async listProviders(): Promise<readonly ModelProviderWithModels[]> {
    const rows = this.database.sqlite
      .prepare("SELECT * FROM model_providers WHERE deleted_at IS NULL ORDER BY updated_at DESC")
      .all() as unknown as ProviderRow[];
    return rows.map((row) => this.mapProvider(row));
  }

  async getProvider(id: ModelProviderId): Promise<ModelProviderWithModels | null> {
    const row = this.database.sqlite
      .prepare("SELECT * FROM model_providers WHERE id = ? AND deleted_at IS NULL")
      .get(id) as unknown as ProviderRow | undefined;
    return row ? this.mapProvider(row) : null;
  }

  async getModel(id: ModelId): Promise<ResolvedModel | null> {
    const modelRow = this.database.sqlite
      .prepare(
        "SELECT m.* FROM models m JOIN model_providers p ON p.id = m.provider_id WHERE m.id = ? AND p.deleted_at IS NULL",
      )
      .get(id) as unknown as ModelRow | undefined;
    if (!modelRow) return null;
    const provider = await this.getProvider(modelRow.provider_id as ModelProviderId);
    if (!provider) return null;
    return { provider: provider.provider, model: mapModel(modelRow) };
  }

  async saveProvider(value: ModelProviderWithModels): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const provider = value.provider;
      this.database.sqlite
        .prepare(
          `INSERT INTO model_providers
            (id, name, base_url, secret_ref, key_hint, kind, enabled, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, base_url = excluded.base_url, secret_ref = excluded.secret_ref,
            key_hint = excluded.key_hint, kind = excluded.kind, enabled = excluded.enabled,
            updated_at = excluded.updated_at, deleted_at = NULL`,
        )
        .run(
          provider.id,
          provider.name,
          provider.baseUrl,
          provider.secretRef,
          provider.keyHint,
          provider.kind,
          provider.enabled ? 1 : 0,
          provider.createdAt.toISOString(),
          provider.updatedAt.toISOString(),
        );

      const saveModel = this.database.sqlite.prepare(
        `INSERT INTO models
          (id, provider_id, name, display_name, capabilities_json, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          provider_id = excluded.provider_id, name = excluded.name,
          display_name = excluded.display_name, capabilities_json = excluded.capabilities_json,
          enabled = excluded.enabled, updated_at = excluded.updated_at`,
      );
      for (const model of value.models) {
        saveModel.run(
          model.id,
          model.providerId,
          model.name,
          model.displayName,
          JSON.stringify({ schemaVersion: 1, ...model.capabilities }),
          model.enabled ? 1 : 0,
          model.createdAt.toISOString(),
          model.updatedAt.toISOString(),
        );
      }
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async deleteProvider(id: ModelProviderId, deletedAt: Date): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const defaultModelId = await this.getDefaultModelId();
      if (defaultModelId) {
        const defaultRow = this.database.sqlite
          .prepare("SELECT provider_id FROM models WHERE id = ?")
          .get(defaultModelId) as unknown as { provider_id: string } | undefined;
        if (defaultRow?.provider_id === id) {
          this.database.sqlite
            .prepare("DELETE FROM app_settings WHERE key = 'defaultModelId'")
            .run();
        }
      }
      this.database.sqlite
        .prepare(
          "UPDATE model_providers SET enabled = 0, deleted_at = ?, updated_at = ? WHERE id = ?",
        )
        .run(deletedAt.toISOString(), deletedAt.toISOString(), id);
      this.database.sqlite
        .prepare("UPDATE models SET enabled = 0, updated_at = ? WHERE provider_id = ?")
        .run(deletedAt.toISOString(), id);
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async hasProviderReferences(id: ModelProviderId): Promise<boolean> {
    const row = this.database.sqlite
      .prepare(
        `SELECT COUNT(*) AS count FROM conversations c
         JOIN models m ON m.id = c.model_id
         WHERE m.provider_id = ? AND c.deleted_at IS NULL`,
      )
      .get(id) as unknown as { count: number };
    return row.count > 0;
  }

  async getDefaultModelId(): Promise<ModelId | null> {
    const row = this.database.sqlite
      .prepare("SELECT value_json FROM app_settings WHERE key = 'defaultModelId'")
      .get() as unknown as { value_json: string } | undefined;
    if (!row) return null;
    const value = JSON.parse(row.value_json) as unknown;
    return typeof value === "string" ? (value as ModelId) : null;
  }

  async setDefaultModelId(id: ModelId): Promise<void> {
    this.database.sqlite
      .prepare(
        `INSERT INTO app_settings(key, value_json, updated_at) VALUES ('defaultModelId', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(JSON.stringify(id), new Date().toISOString());
  }

  private mapProvider(row: ProviderRow): ModelProviderWithModels {
    const modelRows = this.database.sqlite
      .prepare("SELECT * FROM models WHERE provider_id = ? ORDER BY created_at")
      .all(row.id) as unknown as ModelRow[];
    const provider: ModelProviderConfig = {
      id: row.id as ModelProviderId,
      name: row.name,
      baseUrl: row.base_url,
      secretRef: row.secret_ref,
      keyHint: row.key_hint,
      kind: "openai-compatible",
      enabled: Boolean(row.enabled),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
    return { provider, models: modelRows.map(mapModel) };
  }
}

function mapModel(row: ModelRow): ModelDefinition {
  const parsed = JSON.parse(row.capabilities_json) as ModelCapabilities & { schemaVersion: number };
  const capabilities: ModelCapabilities = {
    streaming: parsed.streaming,
    toolCalling: parsed.toolCalling,
    structuredOutput: parsed.structuredOutput,
    vision: parsed.vision,
    reasoning: parsed.reasoning,
    promptCaching: parsed.promptCaching,
    ...(parsed.maxContextTokens !== undefined ? { maxContextTokens: parsed.maxContextTokens } : {}),
  };
  return {
    id: row.id as ModelId,
    providerId: row.provider_id as ModelProviderId,
    name: row.name,
    displayName: row.display_name,
    capabilities,
    enabled: Boolean(row.enabled),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
