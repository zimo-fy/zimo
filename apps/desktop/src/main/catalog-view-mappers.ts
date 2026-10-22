import type {
  KnowledgeDocument,
  ModelProviderWithModels,
  PrototypeDefinition,
  RemoteKnowledgeCatalogDirectory,
  RemoteKnowledgeCatalogDocument,
  RemoteKnowledgeDirectoryCatalog,
} from "@zimo/domain";
import type {
  RemoteKnowledgeCatalogDirectoryView,
  RemoteKnowledgeCatalogDocumentView,
  RemoteKnowledgeDirectoryCatalogView,
} from "@zimo/contracts";

export function toProviderView(value: ModelProviderWithModels) {
  return {
    id: value.provider.id,
    name: value.provider.name,
    baseUrl: value.provider.baseUrl,
    keyHint: value.provider.keyHint,
    kind: value.provider.kind,
    enabled: value.provider.enabled,
    models: value.models.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      name: model.name,
      displayName: model.displayName,
      capabilities: model.capabilities,
      enabled: model.enabled,
    })),
    createdAt: value.provider.createdAt.toISOString(),
    updatedAt: value.provider.updatedAt.toISOString(),
  };
}

export function toPrototypeView(value: PrototypeDefinition) {
  return {
    id: value.id,
    kind: value.kind,
    name: value.name,
    description: value.description,
    status: value.status,
    category: value.category,
    tags: [...value.tags],
    icon: value.icon,
    version: value.version,
    ...(value.installationStatus ? { installationStatus: value.installationStatus } : {}),
    updatedAt: value.updatedAt.toISOString(),
    source: value.source,
    ...(value.modelId ? { modelId: value.modelId } : {}),
    ...(value.systemPrompt ? { systemPrompt: value.systemPrompt } : {}),
    ...(value.knowledgeBaseIds ? { knowledgeBaseIds: [...value.knowledgeBaseIds] } : {}),
    ...(value.mcpServerIds ? { mcpServerIds: [...value.mcpServerIds] } : {}),
    ...(value.skillIds ? { skillIds: [...value.skillIds] } : {}),
    ...(value.skillPackageId ? { skillPackageId: value.skillPackageId } : {}),
    ...(value.skillInstructions ? { skillInstructions: value.skillInstructions } : {}),
    permissions: [...value.permissions],
    capabilities: [...value.capabilities],
    associations: [...value.associations],
    ...(value.secretHint ? { secretHint: value.secretHint } : {}),
    ...(value.triggerType ? { triggerType: value.triggerType } : {}),
    workflowNodes: [...value.workflowNodes],
    workflowEdges: [...value.workflowEdges],
    documents: [...value.documents],
    createdAt: value.createdAt.toISOString(),
  };
}

export function toPrototypeSummaryView(value: PrototypeDefinition) {
  return {
    id: value.id,
    kind: value.kind,
    name: value.name,
    description: value.description,
    status: value.status,
    category: value.category,
    tags: [...value.tags],
    icon: value.icon,
    version: value.version,
    ...(value.installationStatus ? { installationStatus: value.installationStatus } : {}),
    updatedAt: value.updatedAt.toISOString(),
  };
}

export function toRemoteKnowledgeDirectoryCatalogView(
  value: RemoteKnowledgeDirectoryCatalog,
): RemoteKnowledgeDirectoryCatalogView {
  return {
    directories: value.directories.map(toRemoteKnowledgeCatalogDirectoryView),
    uncategorizedDocuments: value.uncategorizedDocuments.map(toRemoteKnowledgeCatalogDocumentView),
  };
}

function toRemoteKnowledgeCatalogDirectoryView(
  value: RemoteKnowledgeCatalogDirectory,
): RemoteKnowledgeCatalogDirectoryView {
  return {
    catalogDirectoryId: value.catalogDirectoryId,
    name: value.name,
    ...(value.description ? { description: value.description } : {}),
    documentCount: value.documentCount,
    totalDocumentCount: value.totalDocumentCount,
    documents: value.documents.map(toRemoteKnowledgeCatalogDocumentView),
    children: value.children.map(toRemoteKnowledgeCatalogDirectoryView),
  };
}

function toRemoteKnowledgeCatalogDocumentView(
  value: RemoteKnowledgeCatalogDocument,
): RemoteKnowledgeCatalogDocumentView {
  return {
    catalogDocumentId: value.catalogDocumentId,
    name: value.name,
    originalFilename: value.originalFilename,
    fileExt: value.fileExt,
    fileSize: value.fileSize,
    ...(value.mimeType ? { mimeType: value.mimeType } : {}),
    status: value.status,
  };
}

export function toKnowledgeDocumentView(value: KnowledgeDocument) {
  return {
    id: value.id,
    knowledgeBaseId: value.knowledgeBaseId,
    name: value.name,
    mediaType: value.mediaType,
    sizeBytes: value.sizeBytes,
    status: value.status,
    ...(value.errorCode ? { errorCode: value.errorCode } : {}),
    chunkCount: value.chunkCount,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
