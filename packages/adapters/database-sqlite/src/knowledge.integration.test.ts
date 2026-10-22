import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeDocumentId,
  PrototypeDefinition,
  PrototypeId,
} from "@zimo/domain";

import { SQLiteKnowledgeRepository, ZimoDatabase } from "./index";

describe("SQLite knowledge repository", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("persists documents and vectors, searches FTS5 and cascades deletion", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-knowledge-db-"));
    const sql = await readFile(
      new URL("../../../../migrations/0006_knowledge_retrieval.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 6, name: "knowledge-retrieval", sql },
    ]);
    const repository = new SQLiteKnowledgeRepository(database);
    const now = new Date("2026-09-03T00:00:00.000Z");
    const knowledgeBaseId = "00000000-0000-4000-8000-000000000701" as PrototypeId;
    const documentId = "00000000-0000-4000-8000-000000000702" as KnowledgeDocumentId;
    const knowledgeBase: PrototypeDefinition = {
      id: knowledgeBaseId,
      kind: "knowledge",
      name: "产品资料",
      description: "产品说明",
      status: "enabled",
      category: "产品",
      tags: ["内部"],
      icon: "知",
      version: "1.0.0",
      source: "test",
      permissions: [],
      capabilities: [],
      associations: [],
      workflowNodes: [],
      workflowEdges: [],
      documents: [],
      createdAt: now,
      updatedAt: now,
    };
    const document: KnowledgeDocument = {
      id: documentId,
      knowledgeBaseId,
      name: "产品说明.txt",
      mediaType: "text/plain",
      sizeBytes: 100,
      checksum: "checksum",
      storageKey: "00000000-0000-4000-8000-000000000703.txt",
      status: "ready",
      chunkCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    const chunk: KnowledgeChunk = {
      id: "00000000-0000-4000-8000-000000000704" as KnowledgeChunk["id"],
      knowledgeBaseId,
      documentId,
      ordinal: 0,
      text: "产品编号 ZIMO-KB-2026 支持本地知识检索。",
      metadata: { pageNumber: 1 },
      embedding: [0.1, 0.2, 0.3],
      createdAt: now,
    };

    await repository.save(knowledgeBase);
    await repository.saveDocument(document);
    await repository.replaceChunks(documentId, [chunk]);

    expect(await repository.getById(knowledgeBaseId)).toMatchObject({
      name: "产品资料",
      documents: [{ name: "产品说明.txt", status: "ready" }],
    });
    expect((await repository.listChunks(knowledgeBaseId))[0]?.embedding).toEqual(
      expect.arrayContaining([
        expect.closeTo(0.1, 5),
        expect.closeTo(0.2, 5),
        expect.closeTo(0.3, 5),
      ]),
    );
    expect(await repository.searchLexical(knowledgeBaseId, "产品编号", 10)).toMatchObject([
      { chunk: { text: expect.stringContaining("ZIMO-KB-2026") } },
    ]);

    await repository.delete(knowledgeBaseId);
    expect(await repository.listDocuments(knowledgeBaseId)).toEqual([]);
    expect(await repository.listChunks(knowledgeBaseId)).toEqual([]);
    database.close();
  });
});
