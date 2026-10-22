import type {
  Clock,
  ConversationRepository,
  DocumentArtifact,
  DocumentArtifactWithRevision,
  DocumentArtifactRepository,
  DocumentContentAdapter,
  DocumentCreateContent,
  DocumentFileStore,
  DocumentFormat,
  DocumentPatchOperation,
  DocumentSelector,
  IdGenerator,
  ModelGatewayImagePart,
} from "@zimo/domain";
import { AppError, isDocumentImageFormat } from "@zimo/domain";

import { compileImageParts } from "./conversation-vision";
import { DocumentArtifactMutationService } from "./document-artifact-mutation-service";
import { DocumentModelService } from "./document-model-service";

export interface DocumentImportResult {
  imported: readonly DocumentArtifact[];
  rejected: readonly { index: number; code: string; message: string }[];
}

export class DocumentArtifactService {
  private readonly mutations: DocumentArtifactMutationService;

  constructor(
    private readonly artifacts: DocumentArtifactRepository,
    private readonly files: DocumentFileStore,
    private readonly conversations: ConversationRepository,
    private readonly content: DocumentContentAdapter,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {
    this.mutations = new DocumentArtifactMutationService(
      artifacts,
      files,
      conversations,
      content,
      clock,
      ids,
    );
  }

  async list(conversationId: string): Promise<readonly DocumentArtifact[]> {
    await this.requireConversation(conversationId);
    return this.artifacts.listByConversation(conversationId);
  }

  async importFiles(
    conversationId: string,
    sourcePaths: readonly string[],
  ): Promise<DocumentImportResult> {
    const conversation = await this.requireConversation(conversationId);
    if (conversation.activeRunId) throw activeRunError();
    const drafts = (await this.artifacts.listByConversation(conversationId)).filter(
      (artifact) => !artifact.messageId,
    );
    if (
      sourcePaths.length === 0 ||
      sourcePaths.length > 10 ||
      drafts.length + sourcePaths.length > 10
    ) {
      throw new AppError({
        code: "DOCUMENT_IMPORT_COUNT_INVALID",
        category: "user",
        userMessage: "每条消息最多添加 10 个文档，请先移除部分附件。",
      });
    }
    const imported: DocumentArtifact[] = [];
    const rejected: { index: number; code: string; message: string }[] = [];
    for (const [index, sourcePath] of sourcePaths.entries()) {
      const artifactId = this.ids.create();
      const revisionId = this.ids.create();
      let storageKey: string | undefined;
      try {
        const file = await this.files.importFile({
          sourcePath,
          conversationId,
          artifactId,
          revisionId,
        });
        storageKey = file.storageKey;
        imported.push(await this.persistUserImport(conversationId, artifactId, revisionId, file));
      } catch (error) {
        if (storageKey) await this.files.removeFile(storageKey).catch(() => undefined);
        rejected.push(toRejection(index, error));
      }
    }
    return { imported, rejected };
  }

  async removeDraft(conversationId: string, artifactId: string): Promise<void> {
    const conversation = await this.requireConversation(conversationId);
    if (conversation.activeRunId) throw activeRunError();
    const value = await this.requireArtifact(conversationId, artifactId);
    if (value.artifact.messageId) {
      throw new AppError({
        code: "DOCUMENT_ALREADY_SENT",
        category: "user",
        userMessage: "已随消息发送的文件不能从草稿中移除。",
      });
    }
    if (!(await this.artifacts.deleteDraft(conversationId, artifactId))) {
      throw new AppError({
        code: "DOCUMENT_DRAFT_NOT_FOUND",
        category: "user",
        userMessage: "文件不存在或已被发送。",
      });
    }
    await this.files.removeFile(value.revision.storageKey).catch(() => undefined);
  }

  async exportArtifact(
    conversationId: string,
    artifactId: string,
    revisionId: string,
    destinationPath: string,
  ): Promise<void> {
    const value = await this.requireRevision(conversationId, artifactId, revisionId);
    await this.files.exportFile(value.revision.storageKey, destinationPath);
  }

  async deleteConversationAssets(conversationId: string): Promise<void> {
    const revisions = await this.artifacts.listRevisionsByConversation(conversationId);
    await this.artifacts.deleteByConversation(conversationId);
    await Promise.all(
      revisions.map((value) => this.files.removeFile(value.storageKey).catch(() => undefined)),
    );
  }

  async get(conversationId: string, artifactId: string) {
    return this.requireArtifact(conversationId, artifactId);
  }

  async getRevision(conversationId: string, artifactId: string, revisionId: string) {
    return this.requireRevision(conversationId, artifactId, revisionId);
  }

  async hasMessageAttachments(conversationId: string, messageId: string): Promise<boolean> {
    return (await this.artifacts.listByConversation(conversationId)).some(
      (artifact) => artifact.messageId === messageId,
    );
  }

  async listMessageImages(
    conversationId: string,
    messageId: string,
  ): Promise<readonly DocumentArtifact[]> {
    return (await this.artifacts.listByConversation(conversationId)).filter(
      (artifact) => artifact.messageId === messageId && isDocumentImageFormat(artifact.format),
    );
  }

  async compileMessageImageParts(
    conversationId: string,
    messageId: string,
    signal: AbortSignal,
  ): Promise<readonly ModelGatewayImagePart[]> {
    return compileImageParts(
      await this.listMessageImages(conversationId, messageId),
      async (artifact) => {
        const value = await this.requireArtifact(conversationId, artifact.id);
        return this.files.readFile(value.revision.storageKey);
      },
      signal,
    );
  }

  async readDisplayImage(
    conversationId: string,
    artifactId: string,
    revisionId: string,
  ): Promise<{ mediaType: string; bytes: Uint8Array }> {
    const value = await this.requireRevision(conversationId, artifactId, revisionId);
    if (!isDocumentImageFormat(value.artifact.format)) {
      throw new AppError({
        code: "DOCUMENT_IMAGE_UNSUPPORTED",
        category: "user",
        userMessage: "只有 PNG、JPEG 和 WebP 可以在对话中预览为图片。",
      });
    }
    return {
      mediaType: value.artifact.mediaType,
      bytes: await this.files.readFile(value.revision.storageKey),
    };
  }

  async inspect(conversationId: string, artifactId: string, signal: AbortSignal) {
    const value = await this.requireArtifact(conversationId, artifactId);
    return this.inspectValue(value, signal);
  }

  async inspectRevision(
    conversationId: string,
    artifactId: string,
    revisionId: string,
    signal: AbortSignal,
  ) {
    return this.inspectValue(
      await this.requireRevision(conversationId, artifactId, revisionId),
      signal,
    );
  }

  private inspectValue(value: DocumentArtifactWithRevision, signal: AbortSignal) {
    return mapDocumentReadError(async () =>
      this.content.inspect(
        await this.files.readFile(value.revision.storageKey),
        value.artifact,
        signal,
      ),
    );
  }

  async read(
    conversationId: string,
    artifactId: string,
    selector: DocumentSelector,
    signal: AbortSignal,
  ) {
    const value = await this.requireArtifact(conversationId, artifactId);
    return mapDocumentReadError(async () =>
      this.content.read(
        await this.files.readFile(value.revision.storageKey),
        value.artifact,
        selector,
        signal,
      ),
    );
  }

  async compileAttachmentContext(
    conversationId: string,
    messageId: string,
    signal: AbortSignal,
  ): Promise<string> {
    return this.forModel(conversationId).compileAttachmentContext(messageId, signal);
  }

  async createGenerated(
    conversationId: string,
    format: DocumentFormat,
    displayName: string,
    content: DocumentCreateContent,
    signal: AbortSignal,
  ) {
    return this.mutations.create(conversationId, format, displayName, content, signal);
  }

  async patch(
    conversationId: string,
    artifactId: string,
    expectedRevisionId: string,
    operations: readonly DocumentPatchOperation[],
    signal: AbortSignal,
  ) {
    return this.mutations.patch(conversationId, artifactId, expectedRevisionId, operations, signal);
  }

  async convert(
    conversationId: string,
    artifactId: string,
    targetFormat: DocumentFormat,
    displayName: string,
    signal: AbortSignal,
  ) {
    return this.mutations.convert(conversationId, artifactId, targetFormat, displayName, signal);
  }

  forModel(conversationId: string): DocumentModelService {
    return new DocumentModelService(this.artifacts, conversationId, {
      inspect: (artifactId, signal) => this.inspect(conversationId, artifactId, signal),
      read: (artifactId, selector, signal) =>
        this.read(conversationId, artifactId, selector, signal),
      create: (format, displayName, content, signal) =>
        this.createGenerated(conversationId, format, displayName, content, signal),
      patch: (artifactId, revisionId, operations, signal) =>
        this.patch(conversationId, artifactId, revisionId, operations, signal),
      convert: (artifactId, targetFormat, displayName, signal) =>
        this.convert(conversationId, artifactId, targetFormat, displayName, signal),
    });
  }

  private async persistUserImport(
    conversationId: string,
    artifactId: string,
    revisionId: string,
    file: {
      displayName: string;
      mediaType: string;
      format: DocumentFormat;
      sizeBytes: number;
      checksum: string;
      storageKey: string;
    },
  ): Promise<DocumentArtifact> {
    const now = this.clock.now();
    const artifact: DocumentArtifact = {
      id: artifactId,
      conversationId,
      displayName: file.displayName,
      mediaType: file.mediaType,
      format: file.format,
      sizeBytes: file.sizeBytes,
      status: "ready",
      currentRevisionId: revisionId,
      createdAt: now,
      updatedAt: now,
    };
    await this.artifacts.create({
      artifact,
      revision: {
        id: revisionId,
        artifactId,
        storageKey: file.storageKey,
        checksum: file.checksum,
        sizeBytes: file.sizeBytes,
        createdBy: "user_import",
        createdAt: now,
      },
    });
    return artifact;
  }

  private async requireConversation(id: string) {
    const conversation = await this.conversations.getById(id as never);
    if (!conversation) {
      throw new AppError({
        code: "CONVERSATION_NOT_FOUND",
        category: "user",
        userMessage: "会话不存在或已被删除。",
      });
    }
    return conversation;
  }

  private async requireArtifact(conversationId: string, artifactId: string) {
    await this.requireConversation(conversationId);
    const value = await this.artifacts.getById(artifactId);
    if (!value || value.artifact.conversationId !== conversationId) {
      throw documentNotFound();
    }
    return value;
  }

  private async requireRevision(conversationId: string, artifactId: string, revisionId: string) {
    const current = await this.requireArtifact(conversationId, artifactId);
    const revision = await this.artifacts.getRevision(artifactId, revisionId);
    if (!revision) throw documentNotFound();
    return {
      artifact: {
        ...current.artifact,
        currentRevisionId: revision.id,
        sizeBytes: revision.sizeBytes,
      },
      revision,
    };
  }
}

function documentNotFound() {
  return new AppError({
    code: "DOCUMENT_NOT_FOUND",
    category: "user",
    userMessage: "文件不存在或不属于当前会话。",
  });
}

function activeRunError() {
  return new AppError({
    code: "DOCUMENT_CONVERSATION_BUSY",
    category: "user",
    userMessage: "模型回复期间不能调整附件，请稍后重试。",
  });
}

function toRejection(index: number, error: unknown) {
  if (error instanceof AppError) {
    return { index, code: error.code, message: error.userMessage };
  }
  return { index, code: "DOCUMENT_IMPORT_FAILED", message: "文件无法安全读取，请检查后重试。" };
}

async function mapDocumentReadError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
    throw new AppError({
      code: "DOCUMENT_PARSE_FAILED",
      category: "user",
      userMessage: "文件无法安全读取或解析，请检查格式后重试。",
      cause: error,
    });
  }
}
