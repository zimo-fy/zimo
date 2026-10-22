import { describe, expect, it } from "vitest";
import type {
  EmbeddingModelInfo,
  EmbeddingProvider,
  ImportedKnowledgeFile,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeDocumentId,
  KnowledgeFileImporter,
  KnowledgeRepository,
  PrototypeDefinition,
  PrototypeId,
} from "@zimo/domain";

import { KnowledgeService } from "./index";

const now = new Date("2026-09-03T00:00:00.000Z");
const knowledgeBase: PrototypeDefinition = {
  id: "00000000-0000-4000-8000-000000000601" as PrototypeId,
  kind: "knowledge",
  name: "产品资料",
  description: "产品知识",
  status: "enabled",
  category: "产品",
  tags: [],
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

describe("KnowledgeService", () => {
  it("imports, chunks, embeds and returns a hybrid result", async () => {
    const repository = new MemoryKnowledgeRepository();
    await repository.save(knowledgeBase);
    const importer = new FakeImporter();
    const service = new KnowledgeService(
      repository,
      importer,
      new FakeEmbeddings("ready"),
      "/managed",
      { now: () => now },
      sequentialIds(),
    );

    const imported = await service.importFiles(knowledgeBase.id, ["/selected/product.txt"]);
    expect(imported.imported).toHaveLength(1);
    expect(imported.imported[0]).toMatchObject({ status: "ready", chunkCount: 1 });

    const hits = await service.search(knowledgeBase.id, "退款政策");
    expect(hits[0]).toMatchObject({
      documentName: "product.txt",
      matchType: "hybrid",
      score: 1,
    });
    expect(hits[0]?.text).toContain("七天退款政策");
    const grounding = await service.retrieveContext([knowledgeBase.id], "退款政策");
    expect(grounding.context).toContain("[资料1]");
    expect(grounding.citations[0]).toMatchObject({
      knowledgeBaseName: "产品资料",
      documentName: "product.txt",
    });
  });

  it("deduplicates by content checksum and removes the redundant managed copy", async () => {
    const repository = new MemoryKnowledgeRepository();
    await repository.save(knowledgeBase);
    const importer = new FakeImporter();
    const service = new KnowledgeService(
      repository,
      importer,
      new FakeEmbeddings("failed"),
      "/managed",
      { now: () => now },
      sequentialIds(),
    );

    await service.importFiles(knowledgeBase.id, ["/selected/first.txt"]);
    const second = await service.importFiles(knowledgeBase.id, ["/selected/second.txt"]);

    expect(second.imported).toEqual([]);
    expect(second.duplicates).toHaveLength(1);
    expect(importer.removed).toEqual(["copy-2.txt"]);
    expect(await repository.listDocuments(knowledgeBase.id)).toHaveLength(1);
  });
});

class MemoryKnowledgeRepository implements KnowledgeRepository {
  readonly kind = "knowledge" as const;
  private readonly bases = new Map<string, PrototypeDefinition>();
  private readonly documents = new Map<string, KnowledgeDocument>();
  private readonly chunks = new Map<string, KnowledgeChunk>();

  async list() {
    return [...this.bases.values()];
  }
  async getById(id: PrototypeId) {
    return this.bases.get(id) ?? null;
  }
  async save(value: PrototypeDefinition) {
    this.bases.set(value.id, value);
  }
  async delete(id: PrototypeId) {
    this.bases.delete(id);
  }
  async listDocuments(knowledgeBaseId: PrototypeId) {
    return [...this.documents.values()].filter(
      (document) => document.knowledgeBaseId === knowledgeBaseId,
    );
  }
  async getDocument(id: KnowledgeDocumentId) {
    return this.documents.get(id) ?? null;
  }
  async findDocumentByChecksum(knowledgeBaseId: PrototypeId, checksum: string) {
    return (
      [...this.documents.values()].find(
        (document) =>
          document.knowledgeBaseId === knowledgeBaseId && document.checksum === checksum,
      ) ?? null
    );
  }
  async saveDocument(document: KnowledgeDocument) {
    this.documents.set(document.id, document);
  }
  async deleteDocument(id: KnowledgeDocumentId) {
    this.documents.delete(id);
    for (const [chunkId, chunk] of this.chunks) {
      if (chunk.documentId === id) this.chunks.delete(chunkId);
    }
  }
  async replaceChunks(documentId: KnowledgeDocumentId, chunks: readonly KnowledgeChunk[]) {
    for (const [chunkId, chunk] of this.chunks) {
      if (chunk.documentId === documentId) this.chunks.delete(chunkId);
    }
    for (const chunk of chunks) this.chunks.set(chunk.id, chunk);
  }
  async listChunks(knowledgeBaseId: PrototypeId) {
    return [...this.chunks.values()].filter((chunk) => chunk.knowledgeBaseId === knowledgeBaseId);
  }
  async searchLexical(knowledgeBaseId: PrototypeId, query: string, limit: number) {
    return (await this.listChunks(knowledgeBaseId))
      .filter((chunk) => chunk.text.includes(query))
      .slice(0, limit)
      .map((chunk) => ({ chunk, score: 1 }));
  }
}

class FakeImporter implements KnowledgeFileImporter {
  removed: string[] = [];
  private count = 0;

  async importFile(): Promise<ImportedKnowledgeFile> {
    this.count += 1;
    return {
      name: "product.txt",
      mediaType: "text/plain",
      sizeBytes: 42,
      checksum: "same-content-checksum",
      storageKey: `copy-${this.count}.txt`,
      segments: [{ text: "企业版支持七天退款政策，并提供本地知识检索。", metadata: {} }],
    };
  }

  async removeManagedFile(_storageDirectory: string, storageKey: string) {
    this.removed.push(storageKey);
  }
}

class FakeEmbeddings implements EmbeddingProvider {
  constructor(private status: EmbeddingModelInfo["status"]) {}

  async getStatus(): Promise<EmbeddingModelInfo> {
    return this.info();
  }
  async embed(texts: readonly string[]) {
    return texts.map((text) => (text.includes("退款") ? [1, 0] : [0, 1]));
  }
  private info(): EmbeddingModelInfo {
    return {
      key: "fake",
      displayName: "Fake",
      revision: "test",
      dimensions: 2,
      status: this.status,
      localOnly: this.status === "ready",
    };
  }
}

function sequentialIds() {
  let value = 610;
  return {
    create() {
      value += 1;
      return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
    },
  };
}
