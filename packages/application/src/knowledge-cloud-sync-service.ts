import { rm } from "node:fs/promises";
import { dirname } from "node:path";

import {
  AppError,
  KNOWLEDGE_CLOUD_DIRECTORY_TAG_PREFIX,
  type Clock,
  type IdGenerator,
  type KnowledgeCloudLinkRepository,
  type KnowledgeDirectoryCatalogGateway,
  type PrototypeDefinition,
  type RemoteKnowledgeCatalogDirectory,
  type RemoteKnowledgeCatalogDocument,
} from "@zimo/domain";

import type { KnowledgeService } from "./knowledge-service";
import type { PrototypeCatalogService } from "./prototype-catalog-service";

export type KnowledgeCloudSyncMode = "import" | "update";

export interface KnowledgeCloudDirectoryBinding {
  readonly catalogDirectoryId: string;
  readonly knowledgeBaseId: string;
  readonly knowledgeBaseName: string;
}

export interface KnowledgeCloudSyncResult {
  readonly knowledgeBaseId: string;
  readonly knowledgeBaseName: string;
  readonly imported: number;
  readonly updated: number;
  readonly skipped: number;
}

export const KNOWLEDGE_CLOUD_UNCATEGORIZED_DIRECTORY_ID = "__uncategorized__";

const SYNC_TIMEOUT_MS = 5 * 60_000;

export class KnowledgeCloudSyncService {
  constructor(
    private readonly catalog: KnowledgeDirectoryCatalogGateway,
    private readonly knowledge: KnowledgeService,
    private readonly prototypes: PrototypeCatalogService,
    private readonly links: KnowledgeCloudLinkRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async listBindings(): Promise<readonly KnowledgeCloudDirectoryBinding[]> {
    const [bindings, knowledgeBases] = await Promise.all([
      this.links.listDirectoryBindings(),
      this.prototypes.list("knowledge"),
    ]);
    return bindings.map((binding) => {
      const knowledgeBase = knowledgeBases.find((item) => item.id === binding.knowledgeBaseId);
      return {
        catalogDirectoryId: binding.catalogDirectoryId,
        knowledgeBaseId: binding.knowledgeBaseId,
        knowledgeBaseName: knowledgeBase?.name ?? "本地知识库",
      };
    });
  }

  syncDirectory(
    catalogDirectoryId: string,
    mode: KnowledgeCloudSyncMode,
  ): Promise<KnowledgeCloudSyncResult> {
    return withTimeout(async (signal) => {
      const tree = await this.catalog.listTree(signal);
      const documents = resolveDirectoryDocuments(tree, catalogDirectoryId);
      if (!documents) {
        throw new AppError({
          code: "KNOWLEDGE_CLOUD_DIRECTORY_NOT_FOUND",
          category: "user",
          userMessage: "云端目录不存在或已被移除。",
        });
      }
      let knowledgeBase = await this.findBoundKnowledgeBase(catalogDirectoryId);
      if (!knowledgeBase) {
        if (mode === "update") {
          throw new AppError({
            code: "KNOWLEDGE_CLOUD_DIRECTORY_NOT_IMPORTED",
            category: "user",
            userMessage: "请先导入该云端目录到本地，再执行更新。",
          });
        }
        knowledgeBase = await this.createLocalKnowledgeBase(catalogDirectoryId, tree);
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      for (const document of documents) {
        if (document.status !== "normal") {
          skipped += 1;
          continue;
        }
        const outcome = await this.syncDocument(
          catalogDirectoryId,
          knowledgeBase,
          document,
          mode,
          signal,
        );
        if (outcome === "imported") imported += 1;
        if (outcome === "updated") updated += 1;
        if (outcome === "skipped") skipped += 1;
      }

      knowledgeBase = await this.ensureKnowledgeBaseEnabled(knowledgeBase);

      return {
        knowledgeBaseId: knowledgeBase.id,
        knowledgeBaseName: knowledgeBase.name,
        imported,
        updated,
        skipped,
      };
    }, SYNC_TIMEOUT_MS);
  }

  private async ensureKnowledgeBaseEnabled(
    knowledgeBase: PrototypeDefinition,
  ): Promise<PrototypeDefinition> {
    if (knowledgeBase.status === "enabled") return knowledgeBase;
    return this.prototypes.mutate({
      action: "set-status",
      kind: "knowledge",
      id: knowledgeBase.id,
      status: "enabled",
    });
  }

  private async syncDocument(
    catalogDirectoryId: string,
    knowledgeBase: PrototypeDefinition,
    document: RemoteKnowledgeCatalogDocument,
    mode: KnowledgeCloudSyncMode,
    signal: AbortSignal,
  ): Promise<"imported" | "updated" | "skipped"> {
    const existing = await this.links.getByCatalogDocument(knowledgeBase.id, document.catalogDocumentId);
    if (mode === "import" && existing) return "skipped";
    if (mode === "update" && existing && existing.remoteChecksum === document.remoteChecksum) {
      return "skipped";
    }

    const replacing = Boolean(existing && existing.remoteChecksum !== document.remoteChecksum);
    if (replacing && existing) {
      await this.knowledge.deleteDocument(knowledgeBase.id, existing.localDocumentId);
      await this.links.deleteByLocalDocumentId(existing.localDocumentId);
    }

    const tempPath = await this.catalog.downloadDocumentToTempFile(document, signal);
    try {
      const result = await this.knowledge.importFiles(knowledgeBase.id, [tempPath]);
      const localDocument = result.imported[0] ?? result.duplicates[0];
      if (!localDocument) {
        throw new AppError({
          code: "KNOWLEDGE_CLOUD_IMPORT_FAILED",
          category: "network",
          userMessage: `未能导入云端文档“${document.name}”。`,
          retryable: true,
        });
      }
      const now = this.clock.now();
      await this.links.save({
        id: existing?.id ?? this.ids.create(),
        knowledgeBaseId: knowledgeBase.id,
        catalogDirectoryId,
        catalogDocumentId: document.catalogDocumentId,
        localDocumentId: localDocument.id,
        remoteChecksum: document.remoteChecksum,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      return replacing ? "updated" : "imported";
    } finally {
      await rm(dirname(tempPath), { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async findBoundKnowledgeBase(
    catalogDirectoryId: string,
  ): Promise<PrototypeDefinition | null> {
    const tag = cloudDirectoryTag(catalogDirectoryId);
    const knowledgeBases = await this.prototypes.list("knowledge");
    return knowledgeBases.find((item) => item.tags.includes(tag)) ?? null;
  }

  private async createLocalKnowledgeBase(
    catalogDirectoryId: string,
    tree: Awaited<ReturnType<KnowledgeDirectoryCatalogGateway["listTree"]>>,
  ): Promise<PrototypeDefinition> {
    const directory =
      catalogDirectoryId === KNOWLEDGE_CLOUD_UNCATEGORIZED_DIRECTORY_ID
        ? undefined
        : findDirectory(tree.directories, catalogDirectoryId);
    const name =
      catalogDirectoryId === KNOWLEDGE_CLOUD_UNCATEGORIZED_DIRECTORY_ID
        ? "未分类文档"
        : (directory?.name ?? "云端目录");
    return this.prototypes.mutate({
      action: "create",
      kind: "knowledge",
      value: {
        name,
        description: directory?.description?.trim() || "",
        category: "",
        tags: [cloudDirectoryTag(catalogDirectoryId)],
        status: "enabled",
        permissions: [],
        associations: [],
      },
    });
  }
}

function resolveDirectoryDocuments(
  tree: Awaited<ReturnType<KnowledgeDirectoryCatalogGateway["listTree"]>>,
  catalogDirectoryId: string,
): readonly RemoteKnowledgeCatalogDocument[] | null {
  if (catalogDirectoryId === KNOWLEDGE_CLOUD_UNCATEGORIZED_DIRECTORY_ID) {
    return tree.uncategorizedDocuments;
  }
  const directory = findDirectory(tree.directories, catalogDirectoryId);
  return directory ? directory.documents : null;
}

function findDirectory(
  directories: readonly RemoteKnowledgeCatalogDirectory[],
  catalogDirectoryId: string,
): RemoteKnowledgeCatalogDirectory | null {
  for (const directory of directories) {
    if (directory.catalogDirectoryId === catalogDirectoryId) return directory;
    const nested = findDirectory(directory.children, catalogDirectoryId);
    if (nested) return nested;
  }
  return null;
}

function cloudDirectoryTag(catalogDirectoryId: string): string {
  return `${KNOWLEDGE_CLOUD_DIRECTORY_TAG_PREFIX}${catalogDirectoryId}`;
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (cause) {
    if (!timedOut && !controller.signal.aborted) throw cause;
    throw new AppError({
      code: timedOut ? "KNOWLEDGE_CLOUD_SYNC_TIMEOUT" : "KNOWLEDGE_CLOUD_SYNC_CANCELLED",
      category: timedOut ? "network" : "user",
      userMessage: timedOut ? "云端知识库同步超时，请稍后重试。" : "云端知识库同步已取消。",
      retryable: timedOut,
      cause,
    });
  } finally {
    clearTimeout(timer);
  }
}
