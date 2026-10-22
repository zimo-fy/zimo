import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { SQLiteDocumentArtifactRepository } from "./document-artifact-repository";
import { SQLiteConversationRepository, ZimoDatabase } from "./index";

const conversationId = "11111111-1111-4111-8111-111111111111";
const artifactId = "22222222-2222-4222-8222-222222222222";
const revisionId = "33333333-3333-4333-8333-333333333333";

describe("SQLiteDocumentArtifactRepository", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("persists revisions and refuses to delete an artifact bound to a message", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-db-"));
    const documentSql = await readFile(
      fileURLToPath(new URL("../../../../migrations/0022_document_artifacts.sql", import.meta.url)),
      "utf8",
    );
    const revisionSql = await readFile(
      fileURLToPath(
        new URL("../../../../migrations/0023_document_revision_creators.sql", import.meta.url),
      ),
      "utf8",
    );
    const bindingRevisionSql = await readFile(
      fileURLToPath(
        new URL("../../../../migrations/0024_document_message_revisions.sql", import.meta.url),
      ),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 1, name: "base", sql: BASE_SCHEMA },
      { version: 2, name: "documents", sql: documentSql },
      { version: 3, name: "revision-creators", sql: revisionSql },
      { version: 4, name: "message-revisions", sql: bindingRevisionSql },
    ]);
    const repository = new SQLiteDocumentArtifactRepository(database);
    const now = new Date("2026-09-14T00:00:00.000Z");
    await repository.create({
      artifact: {
        id: artifactId,
        conversationId,
        displayName: "报告.pdf",
        mediaType: "application/pdf",
        format: "pdf",
        sizeBytes: 128,
        status: "ready",
        currentRevisionId: revisionId,
        createdAt: now,
        updatedAt: now,
      },
      revision: {
        id: revisionId,
        artifactId,
        storageKey: `${conversationId}/${artifactId}/revisions/${revisionId}.pdf`,
        checksum: "a".repeat(64),
        sizeBytes: 128,
        createdBy: "user_import",
        createdAt: now,
      },
    });

    expect(await repository.listByConversation(conversationId)).toHaveLength(1);
    const messages = new SQLiteConversationRepository(database);
    await messages.createRunMessages({
      conversationId: conversationId as never,
      runId: "55555555-5555-4555-8555-555555555555" as never,
      artifactIds: [artifactId],
      userMessage: message("44444444-4444-4444-8444-444444444444", "user", 0, now),
      assistantMessage: message("66666666-6666-4666-8666-666666666666", "assistant", 1, now),
    });

    expect(await repository.listByConversation(conversationId)).toEqual([
      expect.objectContaining({
        messageId: "44444444-4444-4444-8444-444444444444",
        messageRevisionId: revisionId,
        messageRelation: "input",
      }),
    ]);
    await expect(repository.deleteDraft(conversationId, artifactId)).resolves.toBe(false);

    const secondRevisionId = "77777777-7777-4777-8777-777777777777";
    await repository.addRevisionAndBindOutput(
      {
        artifact: {
          ...(await repository.getById(artifactId))!.artifact,
          currentRevisionId: secondRevisionId,
          sizeBytes: 192,
          updatedAt: new Date("2026-09-14T00:01:00.000Z"),
        },
        revision: {
          id: secondRevisionId,
          artifactId,
          parentRevisionId: revisionId,
          storageKey: `${conversationId}/${artifactId}/revisions/${secondRevisionId}.pdf`,
          checksum: "b".repeat(64),
          sizeBytes: 192,
          createdBy: "model_patch",
          createdAt: new Date("2026-09-14T00:01:00.000Z"),
        },
      },
      revisionId,
      conversationId,
      new Date("2026-09-14T00:01:00.000Z"),
    );
    expect((await repository.getById(artifactId))?.revision).toMatchObject({
      id: secondRevisionId,
      parentRevisionId: revisionId,
      createdBy: "model_patch",
    });
    expect(await repository.listRevisionsByConversation(conversationId)).toHaveLength(2);
    expect(await repository.listByConversation(conversationId)).toEqual([
      expect.objectContaining({
        messageId: "44444444-4444-4444-8444-444444444444",
        messageRevisionId: revisionId,
        messageRelation: "input",
      }),
      expect.objectContaining({
        messageId: "66666666-6666-4666-8666-666666666666",
        messageRevisionId: secondRevisionId,
        messageRelation: "output",
      }),
    ]);
    await expect(
      repository.addRevision(
        {
          artifact: (await repository.getById(artifactId))!.artifact,
          revision: {
            id: "88888888-8888-4888-8888-888888888888",
            artifactId,
            parentRevisionId: revisionId,
            storageKey: "conflict.pdf",
            checksum: "c".repeat(64),
            sizeBytes: 200,
            createdBy: "model_patch",
            createdAt: now,
          },
        },
        revisionId,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_REVISION_CONFLICT" });
    database.close();
  });

  it("pins legacy input bindings to the import revision and restores hidden patch state", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-db-upgrade-"));
    const databasePath = join(directory, "zimo.sqlite");
    const documentSql = await migration("0022_document_artifacts.sql");
    const revisionSql = await migration("0023_document_revision_creators.sql");
    const bindingRevisionSql = await migration("0024_document_message_revisions.sql");
    const beforeUpgrade = new ZimoDatabase(databasePath, [
      { version: 1, name: "base", sql: BASE_SCHEMA },
      { version: 2, name: "documents", sql: documentSql },
      { version: 3, name: "revision-creators", sql: revisionSql },
    ]);
    const repository = new SQLiteDocumentArtifactRepository(beforeUpgrade);
    const now = new Date("2026-09-14T00:00:00.000Z");
    await repository.create({
      artifact: {
        id: artifactId,
        conversationId,
        displayName: "报告.docx",
        mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        format: "docx",
        sizeBytes: 128,
        status: "ready",
        currentRevisionId: revisionId,
        createdAt: now,
        updatedAt: now,
      },
      revision: {
        id: revisionId,
        artifactId,
        storageKey: "original.docx",
        checksum: "a".repeat(64),
        sizeBytes: 128,
        createdBy: "user_import",
        createdAt: now,
      },
    });
    beforeUpgrade.sqlite
      .prepare(
        `INSERT INTO messages
          (id, conversation_id, role, content, status, position, knowledge_citations_json,
           created_at, updated_at)
         VALUES (?, ?, 'user', '修改', 'completed', 0, '[]', ?, ?)`,
      )
      .run(
        "44444444-4444-4444-8444-444444444444",
        conversationId,
        now.toISOString(),
        now.toISOString(),
      );
    beforeUpgrade.sqlite
      .prepare(
        `INSERT INTO message_artifact_bindings(message_id, artifact_id, relation, created_at)
         VALUES (?, ?, 'input', ?)`,
      )
      .run("44444444-4444-4444-8444-444444444444", artifactId, now.toISOString());
    const patchedRevisionId = "77777777-7777-4777-8777-777777777777";
    await repository.addRevision(
      {
        artifact: {
          ...(await repository.getById(artifactId))!.artifact,
          currentRevisionId: patchedRevisionId,
          sizeBytes: 256,
          updatedAt: new Date("2026-09-14T00:01:00.000Z"),
        },
        revision: {
          id: patchedRevisionId,
          artifactId,
          parentRevisionId: revisionId,
          storageKey: "hidden-patch.docx",
          checksum: "b".repeat(64),
          sizeBytes: 256,
          createdBy: "model_patch",
          createdAt: new Date("2026-09-14T00:01:00.000Z"),
        },
      },
      revisionId,
    );
    beforeUpgrade.close();

    const upgraded = new ZimoDatabase(databasePath, [
      { version: 1, name: "base", sql: BASE_SCHEMA },
      { version: 2, name: "documents", sql: documentSql },
      { version: 3, name: "revision-creators", sql: revisionSql },
      { version: 4, name: "message-revisions", sql: bindingRevisionSql },
    ]);
    const upgradedRepository = new SQLiteDocumentArtifactRepository(upgraded);

    expect((await upgradedRepository.getById(artifactId))?.revision.id).toBe(revisionId);
    expect(await upgradedRepository.listByConversation(conversationId)).toEqual([
      expect.objectContaining({
        messageRevisionId: revisionId,
        messageRelation: "input",
      }),
    ]);
    expect(await upgradedRepository.listRevisionsByConversation(conversationId)).toHaveLength(2);
    upgraded.close();
  });

  it("persists markdown attachments after the import-format constraint is expanded", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-md-"));
    const documentSql = await migration("0022_document_artifacts.sql");
    const revisionSql = await migration("0023_document_revision_creators.sql");
    const bindingRevisionSql = await migration("0024_document_message_revisions.sql");
    const importFormatsSql = await migration("0042_document_import_formats.sql");
    const beforeUpgrade = new ZimoDatabase(join(directory, "legacy.sqlite"), [
      { version: 1, name: "base", sql: BASE_SCHEMA },
      { version: 2, name: "documents", sql: documentSql },
      { version: 3, name: "revision-creators", sql: revisionSql },
      { version: 4, name: "message-revisions", sql: bindingRevisionSql },
    ]);
    const legacy = new SQLiteDocumentArtifactRepository(beforeUpgrade);
    const now = new Date("2026-09-14T00:00:00.000Z");
    const markdown = {
      artifact: {
        id: artifactId,
        conversationId,
        displayName: "notes.md",
        mediaType: "text/markdown",
        format: "md" as const,
        sizeBytes: 32,
        status: "ready" as const,
        currentRevisionId: revisionId,
        createdAt: now,
        updatedAt: now,
      },
      revision: {
        id: revisionId,
        artifactId,
        storageKey: `${conversationId}/${artifactId}/revisions/${revisionId}.md`,
        checksum: "b".repeat(64),
        sizeBytes: 32,
        createdBy: "user_import" as const,
        createdAt: now,
      },
    };
    await expect(legacy.create(markdown)).rejects.toThrow();
    beforeUpgrade.close();

    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 1, name: "base", sql: BASE_SCHEMA },
      { version: 2, name: "documents", sql: documentSql },
      { version: 3, name: "revision-creators", sql: revisionSql },
      { version: 4, name: "message-revisions", sql: bindingRevisionSql },
      { version: 5, name: "document-import-formats", sql: importFormatsSql },
    ]);
    const repository = new SQLiteDocumentArtifactRepository(database);
    await repository.create(markdown);

    expect(await repository.getById(artifactId)).toMatchObject({
      artifact: { format: "md", displayName: "notes.md" },
    });
    database.close();
  });

  it("persists jpeg attachments after the image-format constraint is expanded", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-jpeg-"));
    const documentSql = await migration("0022_document_artifacts.sql");
    const revisionSql = await migration("0023_document_revision_creators.sql");
    const bindingRevisionSql = await migration("0024_document_message_revisions.sql");
    const importFormatsSql = await migration("0042_document_import_formats.sql");
    const imageFormatsSql = await migration("0045_document_image_formats.sql");
    const jpeg = {
      artifact: {
        id: artifactId,
        conversationId,
        displayName: "shot.jpg",
        mediaType: "image/jpeg",
        format: "jpeg" as const,
        sizeBytes: 64,
        status: "ready" as const,
        currentRevisionId: revisionId,
        createdAt: new Date("2026-10-14T00:00:00.000Z"),
        updatedAt: new Date("2026-10-14T00:00:00.000Z"),
      },
      revision: {
        id: revisionId,
        artifactId,
        storageKey: `${conversationId}/${artifactId}/revisions/${revisionId}.jpeg`,
        checksum: "c".repeat(64),
        sizeBytes: 64,
        createdBy: "user_import" as const,
        createdAt: new Date("2026-10-14T00:00:00.000Z"),
      },
    };
    const beforeUpgrade = new ZimoDatabase(join(directory, "legacy.sqlite"), [
      { version: 1, name: "base", sql: BASE_SCHEMA },
      { version: 2, name: "documents", sql: documentSql },
      { version: 3, name: "revision-creators", sql: revisionSql },
      { version: 4, name: "message-revisions", sql: bindingRevisionSql },
      { version: 5, name: "document-import-formats", sql: importFormatsSql },
    ]);
    await expect(
      new SQLiteDocumentArtifactRepository(beforeUpgrade).create(jpeg),
    ).rejects.toThrow();
    beforeUpgrade.close();

    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 1, name: "base", sql: BASE_SCHEMA },
      { version: 2, name: "documents", sql: documentSql },
      { version: 3, name: "revision-creators", sql: revisionSql },
      { version: 4, name: "message-revisions", sql: bindingRevisionSql },
      { version: 5, name: "document-import-formats", sql: importFormatsSql },
      { version: 6, name: "document-image-formats", sql: imageFormatsSql },
    ]);
    const repository = new SQLiteDocumentArtifactRepository(database);
    await repository.create(jpeg);
    expect(await repository.getById(artifactId)).toMatchObject({
      artifact: { format: "jpeg", displayName: "shot.jpg" },
    });
    database.close();
  });
});

async function migration(name: string): Promise<string> {
  return readFile(
    fileURLToPath(new URL(`../../../../migrations/${name}`, import.meta.url)),
    "utf8",
  );
}

const BASE_SCHEMA = `
  CREATE TABLE conversations (
    id TEXT PRIMARY KEY NOT NULL,
    active_run_id TEXT,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    position INTEGER NOT NULL,
    replaces_message_id TEXT,
    error_code TEXT,
    usage_json TEXT,
    knowledge_citations_json TEXT NOT NULL,
    steps_json TEXT,
    model_display_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO conversations(id, active_run_id, updated_at, deleted_at)
    VALUES ('${conversationId}', NULL, '2026-09-14T00:00:00.000Z', NULL);
`;

function message(id: string, role: "user" | "assistant", position: number, now: Date) {
  return {
    id: id as never,
    conversationId: conversationId as never,
    role,
    content: role === "user" ? "查看附件" : "",
    status: role === "user" ? ("completed" as const) : ("streaming" as const),
    position,
    createdAt: now,
    updatedAt: now,
  };
}
