export interface RemoteKnowledgeCatalogDocument {
  readonly catalogDocumentId: string;
  readonly name: string;
  readonly originalFilename: string;
  readonly fileExt: string;
  readonly fileSize: number;
  readonly mimeType?: string;
  readonly status: string;
  readonly remoteChecksum: string;
  readonly storageUrl: string;
}

export interface RemoteKnowledgeCatalogDirectory {
  readonly catalogDirectoryId: string;
  readonly name: string;
  readonly description?: string;
  readonly documentCount: number;
  readonly totalDocumentCount: number;
  readonly documents: readonly RemoteKnowledgeCatalogDocument[];
  readonly children: readonly RemoteKnowledgeCatalogDirectory[];
}

export interface RemoteKnowledgeDirectoryCatalog {
  readonly directories: readonly RemoteKnowledgeCatalogDirectory[];
  readonly uncategorizedDocuments: readonly RemoteKnowledgeCatalogDocument[];
}

export interface KnowledgeDirectoryCatalogGateway {
  listTree(signal: AbortSignal): Promise<RemoteKnowledgeDirectoryCatalog>;
  downloadDocumentToTempFile(
    document: RemoteKnowledgeCatalogDocument,
    signal: AbortSignal,
  ): Promise<string>;
}

export interface KnowledgeCloudLink {
  readonly id: string;
  readonly knowledgeBaseId: string;
  readonly catalogDirectoryId: string;
  readonly catalogDocumentId: string;
  readonly localDocumentId: string;
  readonly remoteChecksum: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface KnowledgeCloudLinkRepository {
  listDirectoryBindings(): Promise<
    readonly { catalogDirectoryId: string; knowledgeBaseId: string }[]
  >;
  getByCatalogDocument(
    knowledgeBaseId: string,
    catalogDocumentId: string,
  ): Promise<KnowledgeCloudLink | null>;
  save(link: KnowledgeCloudLink): Promise<void>;
  deleteByLocalDocumentId(localDocumentId: string): Promise<void>;
}

export const KNOWLEDGE_CLOUD_DIRECTORY_TAG_PREFIX = "cloud-dir:";
