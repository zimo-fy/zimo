import { z } from "zod";

export const remoteKnowledgeCatalogDocumentViewSchema = z
  .object({
    catalogDocumentId: z.string().min(1).max(32),
    name: z.string().min(1).max(200),
    originalFilename: z.string().min(1).max(260),
    fileExt: z.string().max(20),
    fileSize: z.number().int().nonnegative().max(100 * 1024 * 1024),
    mimeType: z.string().max(200).optional(),
    status: z.string().max(40),
  })
  .strict();

export type RemoteKnowledgeCatalogDocumentView = z.infer<
  typeof remoteKnowledgeCatalogDocumentViewSchema
>;

export type RemoteKnowledgeCatalogDirectoryView = {
  catalogDirectoryId: string;
  name: string;
  description?: string;
  documentCount: number;
  totalDocumentCount: number;
  documents: RemoteKnowledgeCatalogDocumentView[];
  children: RemoteKnowledgeCatalogDirectoryView[];
};

export const remoteKnowledgeCatalogDirectoryViewSchema: z.ZodType<RemoteKnowledgeCatalogDirectoryView> =
  z.lazy(() =>
    z
      .object({
        catalogDirectoryId: z.string().min(1).max(32),
        name: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
        documentCount: z.number().int().nonnegative(),
        totalDocumentCount: z.number().int().nonnegative(),
        documents: z.array(remoteKnowledgeCatalogDocumentViewSchema).max(500),
        children: z.array(remoteKnowledgeCatalogDirectoryViewSchema).max(200),
      })
      .strict(),
  );

export const remoteKnowledgeDirectoryCatalogViewSchema = z
  .object({
    directories: z.array(remoteKnowledgeCatalogDirectoryViewSchema).max(200),
    uncategorizedDocuments: z.array(remoteKnowledgeCatalogDocumentViewSchema).max(500),
  })
  .strict();

export type RemoteKnowledgeDirectoryCatalogView = z.infer<
  typeof remoteKnowledgeDirectoryCatalogViewSchema
>;

export const knowledgeCloudDirectoryBindingViewSchema = z
  .object({
    catalogDirectoryId: z.string().min(1).max(64),
    knowledgeBaseId: z.uuid(),
    knowledgeBaseName: z.string().min(1).max(200),
  })
  .strict();

export type KnowledgeCloudDirectoryBindingView = z.infer<
  typeof knowledgeCloudDirectoryBindingViewSchema
>;

export const knowledgeCloudSyncRequestSchema = z
  .object({
    catalogDirectoryId: z.string().min(1).max(64),
    mode: z.enum(["import", "update"]),
  })
  .strict();

export const knowledgeCloudSyncResultViewSchema = z
  .object({
    knowledgeBaseId: z.uuid(),
    knowledgeBaseName: z.string().min(1).max(200),
    imported: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  })
  .strict();

export type KnowledgeCloudSyncResultView = z.infer<typeof knowledgeCloudSyncResultViewSchema>;
