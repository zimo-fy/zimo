import type {
  Clock,
  EmbeddingProvider,
  IdGenerator,
  KnowledgeChunk,
  KnowledgeChunkId,
  KnowledgeCitation,
  KnowledgeDocument,
  KnowledgeDocumentId,
  KnowledgeFileImporter,
  KnowledgeRepository,
  PrototypeDefinition,
  PrototypeId,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

export interface KnowledgeSearchHitResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  text: string;
  score: number;
  matchType: "keyword" | "semantic" | "hybrid";
  metadata: KnowledgeChunk["metadata"];
}

export interface KnowledgeImportResult {
  imported: readonly KnowledgeDocument[];
  duplicates: readonly KnowledgeDocument[];
}

export class KnowledgeService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly importer: KnowledgeFileImporter,
    private readonly embeddings: EmbeddingProvider,
    private readonly storageDirectory: string,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  getEmbeddingModelStatus() {
    return this.embeddings.getStatus();
  }

  async listDocuments(knowledgeBaseId: string): Promise<readonly KnowledgeDocument[]> {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    return this.repository.listDocuments(knowledgeBase.id);
  }

  async deleteKnowledgeBase(knowledgeBaseId: string): Promise<PrototypeDefinition> {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    const documents = await this.repository.listDocuments(knowledgeBase.id);
    await this.repository.delete(knowledgeBase.id);
    await Promise.all(
      documents.map((document) =>
        this.importer
          .removeManagedFile(this.storageDirectory, document.storageKey)
          .catch(() => undefined),
      ),
    );
    return knowledgeBase;
  }

  async prepareEmbeddingIndex() {
    const status = await this.embeddings.getStatus();
    if (status.status !== "ready") return status;
    const knowledgeBases = await this.repository.list();
    for (const knowledgeBase of knowledgeBases) {
      const chunks = await this.repository.listChunks(knowledgeBase.id);
      const missing = chunks.filter((chunk) => !chunk.embedding);
      const vectorsByChunk = new Map<string, readonly number[]>();
      for (const batch of batches(missing, 16)) {
        const vectors = await this.embeddings.embed(batch.map((chunk) => chunk.text));
        batch.forEach((chunk, index) => {
          const vector = vectors[index];
          if (vector) vectorsByChunk.set(chunk.id, vector);
        });
      }
      const byDocument = new Map<string, KnowledgeChunk[]>();
      for (const chunk of chunks) {
        const vector = vectorsByChunk.get(chunk.id);
        const values = byDocument.get(chunk.documentId) ?? [];
        values.push(vector ? { ...chunk, embedding: vector } : chunk);
        byDocument.set(chunk.documentId, values);
      }
      for (const [documentId, documentChunks] of byDocument) {
        await this.repository.replaceChunks(documentId as KnowledgeDocumentId, documentChunks);
      }
    }
    return status;
  }

  async importFiles(
    knowledgeBaseId: string,
    sourcePaths: readonly string[],
  ): Promise<KnowledgeImportResult> {
    await this.requireKnowledgeBase(knowledgeBaseId);
    if (sourcePaths.length === 0 || sourcePaths.length > 20) {
      throw new AppError({
        code: "KNOWLEDGE_IMPORT_COUNT_INVALID",
        category: "user",
        userMessage: "请选择 1–20 个文件。",
      });
    }
    const imported: KnowledgeDocument[] = [];
    const duplicates: KnowledgeDocument[] = [];
    for (const sourcePath of sourcePaths) {
      const file = await this.importer.importFile(sourcePath, this.storageDirectory);
      const existing = await this.repository.findDocumentByChecksum(
        knowledgeBaseId as PrototypeId,
        file.checksum,
      );
      if (existing) {
        await this.importer.removeManagedFile(this.storageDirectory, file.storageKey);
        duplicates.push(existing);
        continue;
      }
      const now = this.clock.now();
      const document: KnowledgeDocument = {
        id: this.ids.create() as KnowledgeDocumentId,
        knowledgeBaseId: knowledgeBaseId as PrototypeId,
        name: file.name,
        mediaType: file.mediaType,
        sizeBytes: file.sizeBytes,
        checksum: file.checksum,
        storageKey: file.storageKey,
        status: "processing",
        chunkCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await this.repository.saveDocument(document);
      try {
        const rawChunks = file.segments.flatMap((segment) =>
          splitSegment(segment.text, segment.metadata),
        );
        if (rawChunks.length === 0) {
          throw new AppError({
            code: "KNOWLEDGE_DOCUMENT_EMPTY",
            category: "user",
            userMessage: `“${file.name}”没有可索引的文本内容。`,
          });
        }
        const modelStatus = await this.embeddings.getStatus();
        const vectors =
          modelStatus.status === "ready"
            ? await embedInBatches(
                this.embeddings,
                rawChunks.map((chunk) => chunk.text),
              )
            : [];
        const chunks: KnowledgeChunk[] = rawChunks.map((chunk, index) => ({
          id: this.ids.create() as KnowledgeChunkId,
          knowledgeBaseId: knowledgeBaseId as PrototypeId,
          documentId: document.id,
          ordinal: index,
          text: chunk.text,
          metadata: chunk.metadata,
          ...(vectors[index] ? { embedding: vectors[index] } : {}),
          createdAt: now,
        }));
        await this.repository.replaceChunks(document.id, chunks);
        const ready: KnowledgeDocument = {
          ...document,
          status: "ready",
          chunkCount: chunks.length,
          updatedAt: this.clock.now(),
        };
        await this.repository.saveDocument(ready);
        imported.push(ready);
      } catch (error) {
        const failed: KnowledgeDocument = {
          ...document,
          status: "failed",
          errorCode: error instanceof AppError ? error.code : "KNOWLEDGE_PROCESSING_FAILED",
          updatedAt: this.clock.now(),
        };
        await this.repository.saveDocument(failed);
        throw error;
      }
    }
    return { imported, duplicates };
  }

  async deleteDocument(knowledgeBaseId: string, documentId: string): Promise<void> {
    await this.requireKnowledgeBase(knowledgeBaseId);
    const document = await this.repository.getDocument(documentId as KnowledgeDocumentId);
    if (!document || document.knowledgeBaseId !== knowledgeBaseId) {
      throw knowledgeDocumentNotFound();
    }
    await this.repository.deleteDocument(document.id);
    await this.importer.removeManagedFile(this.storageDirectory, document.storageKey);
  }

  async search(
    knowledgeBaseId: string,
    query: string,
    limit = 8,
  ): Promise<readonly KnowledgeSearchHitResult[]> {
    const knowledgeBase = await this.requireKnowledgeBase(knowledgeBaseId);
    if (knowledgeBase.status !== "enabled") {
      throw new AppError({
        code: "KNOWLEDGE_BASE_NOT_ENABLED",
        category: "configuration",
        userMessage: "请先启用该知识库再进行检索。",
      });
    }
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];
    const safeLimit = Math.max(1, Math.min(limit, 20));
    const documents = await this.repository.listDocuments(knowledgeBase.id);
    const documentNames = new Map(documents.map((document) => [document.id, document.name]));
    const lexical = await this.repository.searchLexical(knowledgeBase.id, normalizedQuery, 40);
    const lexicalRanks = new Map(lexical.map((hit, index) => [hit.chunk.id, index + 1]));
    const chunksById = new Map(lexical.map((hit) => [hit.chunk.id, hit.chunk]));
    const semanticRanks = new Map<string, number>();
    const modelStatus = await this.embeddings.getStatus();
    if (modelStatus.status === "ready") {
      try {
        const queryVector = (await this.embeddings.embed([normalizedQuery]))[0];
        if (queryVector) {
          const semantic = (await this.repository.listChunks(knowledgeBase.id))
            .filter((chunk) => chunk.embedding)
            .map((chunk) => ({ chunk, score: cosineSimilarity(queryVector, chunk.embedding!) }))
            .sort((left, right) => right.score - left.score)
            .slice(0, 40);
          semantic.forEach(({ chunk }, index) => {
            semanticRanks.set(chunk.id, index + 1);
            chunksById.set(chunk.id, chunk);
          });
        }
      } catch {
        // Lexical candidates remain available when local inference cannot run.
      }
    }
    return [...chunksById.values()]
      .map((chunk) => {
        const lexicalRank = lexicalRanks.get(chunk.id);
        const semanticRank = semanticRanks.get(chunk.id);
        const score =
          (lexicalRank ? 1 / (60 + lexicalRank) : 0) + (semanticRank ? 1 / (60 + semanticRank) : 0);
        const matchType =
          lexicalRank && semanticRank ? "hybrid" : lexicalRank ? "keyword" : "semantic";
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentName: documentNames.get(chunk.documentId) ?? "未知文档",
          text: chunk.text,
          score,
          matchType,
          metadata: chunk.metadata,
        } satisfies KnowledgeSearchHitResult;
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, safeLimit)
      .map((hit, _index, values) => ({
        ...hit,
        score: values[0]?.score ? Number((hit.score / values[0].score).toFixed(4)) : 0,
      }));
  }

  async retrieveContext(
    knowledgeBaseIds: readonly string[],
    query: string,
    options?: { perKnowledgeBaseLimit?: number; maxHits?: number },
  ): Promise<{ context: string; citations: readonly KnowledgeCitation[] }> {
    const ids = [...new Set(knowledgeBaseIds)];
    if (ids.length > 5) {
      throw new AppError({
        code: "KNOWLEDGE_SELECTION_LIMIT_EXCEEDED",
        category: "user",
        userMessage: "一次最多使用 5 个知识库。",
      });
    }
    const groups = await Promise.all(
      ids.map(async (id) => {
        const knowledgeBase = await this.requireKnowledgeBase(id);
        const hits = await this.search(
          id,
          query,
          Math.max(1, Math.min(options?.perKnowledgeBaseLimit ?? 4, 8)),
        );
        return hits.map((hit) => ({ knowledgeBase, hit }));
      }),
    );
    const candidates = groups
      .flat()
      .sort((left, right) => right.hit.score - left.hit.score)
      .filter(
        (value, index, values) =>
          values.findIndex((candidate) => candidate.hit.chunkId === value.hit.chunkId) === index,
      );
    const selected: (typeof candidates)[number][] = [];
    let contextCharacters = 0;
    for (const candidate of candidates) {
      if (selected.length >= Math.max(1, Math.min(options?.maxHits ?? 8, 8))) break;
      const remaining = 6_000 - contextCharacters;
      if (remaining <= 0) break;
      const text = candidate.hit.text.slice(0, remaining);
      if (!text) continue;
      selected.push({ ...candidate, hit: { ...candidate.hit, text } });
      contextCharacters += text.length;
    }
    const citations = selected.map(({ knowledgeBase, hit }, index): KnowledgeCitation => ({
      index: index + 1,
      knowledgeBaseId: knowledgeBase.id,
      knowledgeBaseName: knowledgeBase.name,
      documentId: hit.documentId as KnowledgeDocumentId,
      documentName: hit.documentName,
      chunkId: hit.chunkId as KnowledgeChunkId,
      score: hit.score,
      metadata: hit.metadata,
    }));
    const context = selected
      .map(
        ({ knowledgeBase, hit }, index) =>
          `[资料${index + 1}] 知识库：${knowledgeBase.name}；文档：${hit.documentName}；位置：${knowledgeLocation(hit.metadata)}\n${hit.text}`,
      )
      .join("\n\n");
    return { context, citations };
  }

  private async requireKnowledgeBase(id: string): Promise<PrototypeDefinition> {
    const value = await this.repository.getById(id as PrototypeId);
    if (!value) throw prototypeNotFound();
    return value;
  }
}

function splitSegment(
  value: string,
  metadata: KnowledgeChunk["metadata"],
): readonly { text: string; metadata: KnowledgeChunk["metadata"] }[] {
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return [];
  // Keep chunks below BGE's 512-token context for typical Chinese text while
  // retaining enough overlap to preserve facts that cross a sentence boundary.
  const max = 480;
  const overlap = 64;
  const values: { text: string; metadata: KnowledgeChunk["metadata"] }[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + max, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf("\n", end),
        normalized.lastIndexOf("。", end),
        normalized.lastIndexOf(".", end),
      );
      if (boundary > start + Math.floor(max * 0.55)) end = boundary + 1;
    }
    const text = normalized.slice(start, end).trim();
    if (text) values.push({ text, metadata: { ...metadata, startIndex: start, endIndex: end } });
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return values;
}

async function embedInBatches(
  provider: EmbeddingProvider,
  texts: readonly string[],
): Promise<readonly (readonly number[])[]> {
  const result: (readonly number[])[] = [];
  for (const batch of batches(texts, 16)) result.push(...(await provider.embed(batch)));
  return result;
}

function batches<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) return -1;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  if (leftNorm === 0 || rightNorm === 0) return -1;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function knowledgeDocumentNotFound(): AppError {
  return new AppError({
    code: "KNOWLEDGE_DOCUMENT_NOT_FOUND",
    category: "user",
    userMessage: "知识文档不存在或已被删除。",
  });
}

function prototypeNotFound(): AppError {
  return new AppError({
    code: "PROTOTYPE_NOT_FOUND",
    category: "user",
    userMessage: "项目不存在或已被删除。",
  });
}

function knowledgeLocation(metadata: KnowledgeChunk["metadata"]): string {
  if (metadata.pageNumber) return `第 ${metadata.pageNumber} 页`;
  if (metadata.slideNumber) return `第 ${metadata.slideNumber} 张幻灯片`;
  if (metadata.sheetName) return `Sheet：${metadata.sheetName}`;
  if (metadata.heading) return `章节：${metadata.heading}`;
  return "正文";
}
