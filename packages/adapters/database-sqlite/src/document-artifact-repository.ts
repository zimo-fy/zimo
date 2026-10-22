import type {
  DocumentArtifact,
  DocumentArtifactRepository,
  DocumentArtifactWithRevision,
  DocumentFormat,
  DocumentRevision,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import type { ZimoDatabase } from "./index";

export class SQLiteDocumentArtifactRepository implements DocumentArtifactRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async create(value: DocumentArtifactWithRevision): Promise<void> {
    const { artifact, revision } = value;
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const draftCount = this.database.sqlite
        .prepare(
          `SELECT COUNT(*) AS count FROM document_artifacts a
           WHERE a.conversation_id = ? AND NOT EXISTS (
             SELECT 1 FROM message_artifact_bindings b WHERE b.artifact_id = a.id
           )`,
        )
        .get(artifact.conversationId) as unknown as { count: number };
      if (draftCount.count >= 10) {
        throw new AppError({
          code: "DOCUMENT_IMPORT_COUNT_INVALID",
          category: "user",
          userMessage: "每条消息最多添加 10 个文档，请先移除部分附件。",
        });
      }
      this.database.sqlite
        .prepare(
          `INSERT INTO document_artifacts
            (id, conversation_id, display_name, media_type, format, size_bytes, status,
             current_revision_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          artifact.id,
          artifact.conversationId,
          artifact.displayName,
          artifact.mediaType,
          artifact.format,
          artifact.sizeBytes,
          artifact.status,
          artifact.currentRevisionId,
          artifact.createdAt.toISOString(),
          artifact.updatedAt.toISOString(),
        );
      this.insertRevision(revision);
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async getById(id: string): Promise<DocumentArtifactWithRevision | null> {
    const row = this.database.sqlite
      .prepare(`${SELECT_CURRENT_REVISION} WHERE a.id = ?`)
      .get(id) as unknown as DocumentArtifactRow | undefined;
    return row ? mapRow(row) : null;
  }

  async listByConversation(conversationId: string): Promise<readonly DocumentArtifact[]> {
    const rows = this.database.sqlite
      .prepare(
        `${SELECT_BOUND_REVISIONS} WHERE a.conversation_id = ?
         ORDER BY a.created_at, a.id, b.created_at, b.message_id`,
      )
      .all(conversationId) as unknown as DocumentArtifactRow[];
    return rows.map((row) => mapRow(row).artifact);
  }

  async listRevisionsByConversation(conversationId: string): Promise<readonly DocumentRevision[]> {
    const rows = this.database.sqlite
      .prepare(
        `SELECT r.* FROM document_revisions r
         JOIN document_artifacts a ON a.id = r.artifact_id
         WHERE a.conversation_id = ? ORDER BY r.created_at, r.id`,
      )
      .all(conversationId) as unknown as RevisionRow[];
    return rows.map(mapRevisionRow);
  }

  async getRevision(artifactId: string, revisionId: string): Promise<DocumentRevision | null> {
    const row = this.database.sqlite
      .prepare("SELECT * FROM document_revisions WHERE artifact_id = ? AND id = ?")
      .get(artifactId, revisionId) as unknown as RevisionRow | undefined;
    return row ? mapRevisionRow(row) : null;
  }

  async addRevision(
    value: DocumentArtifactWithRevision,
    expectedRevisionId: string,
  ): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      this.persistRevision(value, expectedRevisionId);
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async addRevisionAndBindOutput(
    value: DocumentArtifactWithRevision,
    expectedRevisionId: string,
    conversationId: string,
    createdAt: Date,
  ): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      this.persistRevision(value, expectedRevisionId);
      this.bindOutput(conversationId, value.artifact.id, value.revision.id, createdAt);
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async bindOutputToActiveAssistant(
    conversationId: string,
    artifactId: string,
    revisionId: string,
    createdAt: Date,
  ): Promise<void> {
    this.bindOutput(conversationId, artifactId, revisionId, createdAt);
  }

  private bindOutput(
    conversationId: string,
    artifactId: string,
    revisionId: string,
    createdAt: Date,
  ): void {
    const message = this.database.sqlite
      .prepare(
        `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE m.conversation_id = ? AND c.active_run_id IS NOT NULL
           AND m.role = 'assistant' AND m.status IN ('pending', 'streaming')
         ORDER BY m.position DESC LIMIT 1`,
      )
      .get(conversationId) as { id: string } | undefined;
    if (!message) {
      throw new AppError({
        code: "DOCUMENT_OUTPUT_MESSAGE_UNAVAILABLE",
        category: "internal",
        userMessage: "无法将生成文件关联到当前回复。",
      });
    }
    this.database.sqlite
      .prepare(
        `INSERT INTO message_artifact_bindings
          (message_id, artifact_id, revision_id, relation, created_at)
         VALUES (?, ?, ?, 'output', ?)
         ON CONFLICT(message_id, artifact_id, relation) DO UPDATE SET
           revision_id = excluded.revision_id,
           created_at = excluded.created_at`,
      )
      .run(message.id, artifactId, revisionId, createdAt.toISOString());
  }

  private persistRevision(value: DocumentArtifactWithRevision, expectedRevisionId: string): void {
    const current = this.database.sqlite
      .prepare("SELECT current_revision_id FROM document_artifacts WHERE id = ?")
      .get(value.artifact.id) as { current_revision_id: string } | undefined;
    if (!current || current.current_revision_id !== expectedRevisionId) {
      throw new AppError({
        code: "DOCUMENT_REVISION_CONFLICT",
        category: "user",
        userMessage: "文档已产生新版本，请重新读取后再修改。",
      });
    }
    this.insertRevision(value.revision);
    this.database.sqlite
      .prepare(
        `UPDATE document_artifacts
         SET current_revision_id = ?, size_bytes = ?, media_type = ?, format = ?, updated_at = ?
         WHERE id = ? AND current_revision_id = ?`,
      )
      .run(
        value.revision.id,
        value.revision.sizeBytes,
        value.artifact.mediaType,
        value.artifact.format,
        value.artifact.updatedAt.toISOString(),
        value.artifact.id,
        expectedRevisionId,
      );
  }

  async deleteDraft(conversationId: string, artifactId: string): Promise<boolean> {
    const result = this.database.sqlite
      .prepare(
        `DELETE FROM document_artifacts
         WHERE id = ? AND conversation_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM message_artifact_bindings b WHERE b.artifact_id = document_artifacts.id
           )`,
      )
      .run(artifactId, conversationId);
    return result.changes === 1;
  }

  async deleteByConversation(conversationId: string): Promise<void> {
    this.database.sqlite
      .prepare("DELETE FROM document_artifacts WHERE conversation_id = ?")
      .run(conversationId);
  }

  private insertRevision(revision: DocumentArtifactWithRevision["revision"]): void {
    this.database.sqlite
      .prepare(
        `INSERT INTO document_revisions
          (id, artifact_id, parent_revision_id, storage_key, checksum, size_bytes,
           created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        revision.id,
        revision.artifactId,
        revision.parentRevisionId ?? null,
        revision.storageKey,
        revision.checksum,
        revision.sizeBytes,
        revision.createdBy,
        revision.createdAt.toISOString(),
      );
  }
}

const SELECT_CURRENT_REVISION = `SELECT a.*, NULL AS message_id, NULL AS message_revision_id,
  NULL AS message_revision_size_bytes, NULL AS message_relation, r.storage_key, r.checksum,
  r.parent_revision_id, r.created_by, r.created_at AS revision_created_at
  FROM document_artifacts a
  JOIN document_revisions r ON r.id = a.current_revision_id`;

const SELECT_BOUND_REVISIONS = `SELECT a.*, b.message_id, b.revision_id AS message_revision_id,
  br.size_bytes AS message_revision_size_bytes, b.relation AS message_relation,
  r.storage_key, r.checksum,
  r.parent_revision_id, r.created_by, r.created_at AS revision_created_at
  FROM document_artifacts a
  JOIN document_revisions r ON r.id = a.current_revision_id
  LEFT JOIN message_artifact_bindings b ON b.artifact_id = a.id
  LEFT JOIN document_revisions br ON br.id = b.revision_id`;

interface DocumentArtifactRow {
  id: string;
  conversation_id: string;
  display_name: string;
  media_type: string;
  format: string;
  size_bytes: number;
  status: "ready" | "failed";
  current_revision_id: string;
  message_id: string | null;
  message_revision_id: string | null;
  message_revision_size_bytes: number | null;
  message_relation: "input" | "output" | null;
  created_at: string;
  updated_at: string;
  storage_key: string;
  checksum: string;
  parent_revision_id: string | null;
  created_by: DocumentArtifactWithRevision["revision"]["createdBy"];
  revision_created_at: string;
}

interface RevisionRow {
  id: string;
  artifact_id: string;
  parent_revision_id: string | null;
  storage_key: string;
  checksum: string;
  size_bytes: number;
  created_by: DocumentRevision["createdBy"];
  created_at: string;
}

function mapRevisionRow(row: RevisionRow): DocumentRevision {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    ...(row.parent_revision_id ? { parentRevisionId: row.parent_revision_id } : {}),
    storageKey: row.storage_key,
    checksum: row.checksum,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
  };
}

function mapRow(row: DocumentArtifactRow): DocumentArtifactWithRevision {
  return {
    artifact: {
      id: row.id,
      conversationId: row.conversation_id,
      displayName: row.display_name,
      mediaType: row.media_type,
      format: row.format as DocumentFormat,
      sizeBytes: row.size_bytes,
      status: row.status,
      currentRevisionId: row.current_revision_id,
      ...(row.message_id ? { messageId: row.message_id } : {}),
      ...(row.message_revision_id ? { messageRevisionId: row.message_revision_id } : {}),
      ...(row.message_revision_size_bytes
        ? { messageRevisionSizeBytes: row.message_revision_size_bytes }
        : {}),
      ...(row.message_relation ? { messageRelation: row.message_relation } : {}),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    },
    revision: {
      id: row.current_revision_id,
      artifactId: row.id,
      ...(row.parent_revision_id ? { parentRevisionId: row.parent_revision_id } : {}),
      storageKey: row.storage_key,
      checksum: row.checksum,
      sizeBytes: row.size_bytes,
      createdBy: row.created_by,
      createdAt: new Date(row.revision_created_at),
    },
  };
}
