import { eq } from "drizzle-orm";

import type { KnowledgeCloudLink, KnowledgeCloudLinkRepository } from "@zimo/domain";

import { knowledgeCloudLinks } from "./schema";
import type { ZimoDatabase } from "./database";

export class SQLiteKnowledgeCloudLinkRepository implements KnowledgeCloudLinkRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async listDirectoryBindings(): Promise<
    readonly { catalogDirectoryId: string; knowledgeBaseId: string }[]
  > {
    const rows = this.database.db.select().from(knowledgeCloudLinks).all();
    const unique = new Map<string, { catalogDirectoryId: string; knowledgeBaseId: string }>();
    for (const row of rows) {
      unique.set(row.catalogDirectoryId, {
        catalogDirectoryId: row.catalogDirectoryId,
        knowledgeBaseId: row.knowledgeBaseId,
      });
    }
    return [...unique.values()];
  }

  async getByCatalogDocument(
    knowledgeBaseId: string,
    catalogDocumentId: string,
  ): Promise<KnowledgeCloudLink | null> {
    const row = this.database.db
      .select()
      .from(knowledgeCloudLinks)
      .where(eq(knowledgeCloudLinks.knowledgeBaseId, knowledgeBaseId))
      .all()
      .find((value) => value.catalogDocumentId === catalogDocumentId);
    return row ? toLink(row) : null;
  }

  async save(link: KnowledgeCloudLink): Promise<void> {
    const row = {
      id: link.id,
      knowledgeBaseId: link.knowledgeBaseId,
      catalogDirectoryId: link.catalogDirectoryId,
      catalogDocumentId: link.catalogDocumentId,
      localDocumentId: link.localDocumentId,
      remoteChecksum: link.remoteChecksum,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
    this.database.db
      .insert(knowledgeCloudLinks)
      .values(row)
      .onConflictDoUpdate({
        target: [knowledgeCloudLinks.knowledgeBaseId, knowledgeCloudLinks.catalogDocumentId],
        set: {
          localDocumentId: row.localDocumentId,
          remoteChecksum: row.remoteChecksum,
          updatedAt: row.updatedAt,
        },
      })
      .run();
  }

  async deleteByLocalDocumentId(localDocumentId: string): Promise<void> {
    this.database.db
      .delete(knowledgeCloudLinks)
      .where(eq(knowledgeCloudLinks.localDocumentId, localDocumentId))
      .run();
  }
}

function toLink(row: typeof knowledgeCloudLinks.$inferSelect): KnowledgeCloudLink {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledgeBaseId,
    catalogDirectoryId: row.catalogDirectoryId,
    catalogDocumentId: row.catalogDocumentId,
    localDocumentId: row.localDocumentId,
    remoteChecksum: row.remoteChecksum,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
