import type {
  Clock,
  ConversationRepository,
  DocumentArtifact,
  DocumentArtifactRepository,
  DocumentContentAdapter,
  DocumentCreateContent,
  DocumentFileStore,
  DocumentFormat,
  DocumentPatchOperation,
  IdGenerator,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

export class DocumentArtifactMutationService {
  constructor(
    private readonly artifacts: DocumentArtifactRepository,
    private readonly files: DocumentFileStore,
    private readonly conversations: ConversationRepository,
    private readonly content: DocumentContentAdapter,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async create(
    conversationId: string,
    format: DocumentFormat,
    displayName: string,
    content: DocumentCreateContent,
    signal: AbortSignal,
  ) {
    await this.requireConversation(conversationId);
    const artifactId = this.ids.create();
    const revisionId = this.ids.create();
    const bytes = await this.content.create(format, content, signal);
    return this.persistOutput({
      conversationId,
      artifactId,
      revisionId,
      format,
      displayName,
      bytes,
      createdBy: "model_create",
    });
  }

  async patch(
    conversationId: string,
    artifactId: string,
    expectedRevisionId: string,
    operations: readonly DocumentPatchOperation[],
    signal: AbortSignal,
  ) {
    const current = await this.requireArtifact(conversationId, artifactId);
    if (current.revision.id !== expectedRevisionId) throw revisionConflict();
    if (current.artifact.format === "pptx" && current.revision.createdBy === "user_import") {
      throw new AppError({
        code: "DOCUMENT_OPERATION_UNSUPPORTED",
        category: "user",
        userMessage: "外部 PPTX 暂不支持直接修改；可以先转换为 Zimo 演示文稿后再调整。",
      });
    }
    const revisionId = this.ids.create();
    if (operations.length === 0) throw invalidPatchOperations();
    const bytes = await this.content.patch(
      await this.files.readFile(current.revision.storageKey),
      current.artifact,
      operations,
      signal,
    );
    const stored = await this.files.writeFile({
      bytes,
      conversationId,
      artifactId,
      revisionId,
      format: current.artifact.format,
    });
    const now = this.clock.now();
    const artifact = {
      ...current.artifact,
      currentRevisionId: revisionId,
      sizeBytes: stored.sizeBytes,
      updatedAt: now,
    };
    try {
      await this.artifacts.addRevisionAndBindOutput(
        {
          artifact,
          revision: {
            id: revisionId,
            artifactId,
            parentRevisionId: current.revision.id,
            storageKey: stored.storageKey,
            checksum: stored.checksum,
            sizeBytes: stored.sizeBytes,
            createdBy: "model_patch",
            createdAt: now,
          },
        },
        expectedRevisionId,
        conversationId,
        now,
      );
      return artifact;
    } catch (error) {
      await this.files.removeFile(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async convert(
    conversationId: string,
    artifactId: string,
    targetFormat: DocumentFormat,
    displayName: string,
    signal: AbortSignal,
  ) {
    const source = await this.requireArtifact(conversationId, artifactId);
    const bytes = await this.content.convert(
      await this.files.readFile(source.revision.storageKey),
      source.artifact,
      targetFormat,
      signal,
    );
    return this.persistOutput({
      conversationId,
      artifactId: this.ids.create(),
      revisionId: this.ids.create(),
      format: targetFormat,
      displayName,
      bytes,
      createdBy: "conversion",
    });
  }

  private async persistOutput(input: {
    conversationId: string;
    artifactId: string;
    revisionId: string;
    format: DocumentFormat;
    displayName: string;
    bytes: Uint8Array;
    createdBy: "model_create" | "conversion";
  }) {
    const stored = await this.files.writeFile(input);
    const now = this.clock.now();
    const artifact = makeGeneratedArtifact({ ...stored, ...input, now });
    try {
      await this.artifacts.create({
        artifact,
        revision: {
          id: input.revisionId,
          artifactId: input.artifactId,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
          sizeBytes: stored.sizeBytes,
          createdBy: input.createdBy,
          createdAt: now,
        },
      });
      await this.artifacts.bindOutputToActiveAssistant(
        input.conversationId,
        input.artifactId,
        input.revisionId,
        now,
      );
      return artifact;
    } catch (error) {
      await this.artifacts
        .deleteDraft(input.conversationId, input.artifactId)
        .catch(() => undefined);
      await this.files.removeFile(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  private async requireConversation(id: string) {
    const conversation = await this.conversations.getById(id as never);
    if (!conversation) throw notFound();
    return conversation;
  }

  private async requireArtifact(conversationId: string, artifactId: string) {
    await this.requireConversation(conversationId);
    const value = await this.artifacts.getById(artifactId);
    if (!value || value.artifact.conversationId !== conversationId) throw notFound();
    return value;
  }
}

function makeGeneratedArtifact(input: {
  artifactId: string;
  revisionId: string;
  conversationId: string;
  displayName: string;
  format: DocumentFormat;
  mediaType: string;
  sizeBytes: number;
  now: Date;
}): DocumentArtifact {
  const baseName = [...input.displayName.trim()]
    .map((character) => ((character.codePointAt(0) ?? 0) < 32 ? "-" : character))
    .join("")
    .replace(/[\\/:*?"<>|]/g, "-");
  const displayName = `${baseName.replace(/\.[^.]+$/, "").slice(0, 160) || "Zimo 文档"}.${input.format}`;
  return {
    id: input.artifactId,
    conversationId: input.conversationId,
    displayName,
    mediaType: input.mediaType,
    format: input.format,
    sizeBytes: input.sizeBytes,
    status: "ready",
    currentRevisionId: input.revisionId,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function revisionConflict() {
  return new AppError({
    code: "DOCUMENT_REVISION_CONFLICT",
    category: "user",
    userMessage: "文档已产生新版本，请重新读取后再修改。",
  });
}

function invalidPatchOperations() {
  return new AppError({
    code: "DOCUMENT_PATCH_OPERATIONS_INVALID",
    category: "user",
    userMessage: "文档修改至少需要一个操作。",
  });
}

function notFound() {
  return new AppError({
    code: "DOCUMENT_NOT_FOUND",
    category: "user",
    userMessage: "文件不存在或不属于当前会话。",
  });
}
