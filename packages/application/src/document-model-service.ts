import type {
  DocumentArtifact,
  DocumentArtifactRepository,
  DocumentCreateContent,
  DocumentDigest,
  DocumentFormat,
  DocumentPatchOperation,
  DocumentSelector,
  DocumentSlice,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import {
  compileModelAttachmentContext,
  listModelDocuments,
  modelArtifactResult,
  resolveDocumentReference,
} from "./document-model-references";

interface DocumentOperations {
  inspect(artifactId: string, signal: AbortSignal): Promise<DocumentDigest>;
  read(artifactId: string, selector: DocumentSelector, signal: AbortSignal): Promise<DocumentSlice>;
  create(
    format: DocumentFormat,
    displayName: string,
    content: DocumentCreateContent,
    signal: AbortSignal,
  ): Promise<DocumentArtifact>;
  patch(
    artifactId: string,
    revisionId: string,
    operations: readonly DocumentPatchOperation[],
    signal: AbortSignal,
  ): Promise<DocumentArtifact>;
  convert(
    artifactId: string,
    targetFormat: DocumentFormat,
    displayName: string,
    signal: AbortSignal,
  ): Promise<DocumentArtifact>;
}

export class DocumentModelService {
  constructor(
    private readonly artifacts: DocumentArtifactRepository,
    private readonly conversationId: string,
    private readonly operations: DocumentOperations,
  ) {}

  async inspect(documentRef: string, signal: AbortSignal) {
    const current = await this.resolve(documentRef);
    const digest = await this.operations.inspect(current.artifact.id, signal);
    return {
      documentRef,
      format: digest.format,
      displayName: digest.displayName,
      unitCount: digest.unitCount,
      units: digest.units,
      preview: digest.preview,
      truncated: digest.truncated,
    };
  }

  async read(documentRef: string, selector: DocumentSelector, signal: AbortSignal) {
    const current = await this.resolve(documentRef);
    const slice = await this.operations.read(current.artifact.id, selector, signal);
    return {
      documentRef,
      content: slice.content,
      ...(slice.nextCursor === undefined ? {} : { nextCursor: slice.nextCursor }),
      truncated: slice.truncated,
    };
  }

  async compileAttachmentContext(messageId: string, signal: AbortSignal): Promise<string> {
    return compileModelAttachmentContext({
      artifacts: await this.list(),
      messageId,
      signal,
      inspect: (artifactId) => this.operations.inspect(artifactId, signal),
    });
  }

  async create(
    format: DocumentFormat,
    displayName: string,
    content: DocumentCreateContent,
    signal: AbortSignal,
  ) {
    return this.result(await this.operations.create(format, displayName, content, signal));
  }

  async patch(
    documentRef: string,
    operations: readonly DocumentPatchOperation[],
    signal: AbortSignal,
  ) {
    const current = await this.resolve(documentRef);
    const artifact = await this.operations.patch(
      current.artifact.id,
      current.revision.id,
      operations,
      signal,
    );
    return {
      documentRef,
      displayName: artifact.displayName,
      format: artifact.format,
      sizeBytes: artifact.sizeBytes,
      revisionCreated: true,
      attachedToResponse: true,
    };
  }

  async convert(
    documentRef: string,
    targetFormat: DocumentFormat,
    displayName: string,
    signal: AbortSignal,
  ) {
    const current = await this.resolve(documentRef);
    return this.result(
      await this.operations.convert(current.artifact.id, targetFormat, displayName, signal),
    );
  }

  private async result(artifact: DocumentArtifact) {
    const result = modelArtifactResult(await this.list(), artifact);
    if (!result) throw notFound();
    return result;
  }

  private async resolve(documentRef: string) {
    const artifact = resolveDocumentReference(await this.list(), documentRef);
    if (!artifact) throw notFound();
    const current = await this.artifacts.getById(artifact.id);
    if (!current || current.artifact.conversationId !== this.conversationId) throw notFound();
    return current;
  }

  private async list() {
    return listModelDocuments(await this.artifacts.listByConversation(this.conversationId));
  }
}

function notFound() {
  return new AppError({
    code: "DOCUMENT_NOT_FOUND",
    category: "user",
    userMessage: "文件不存在或不属于当前会话。",
  });
}
