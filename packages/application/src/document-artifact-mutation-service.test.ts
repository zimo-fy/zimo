import type {
  ConversationRepository,
  DocumentArtifactRepository,
  DocumentContentAdapter,
  DocumentFileStore,
} from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import { DocumentArtifactMutationService } from "./document-artifact-mutation-service";

describe("DocumentArtifactMutationService", () => {
  it("persists a batch of text fixes as one revision and one assistant output", async () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    const artifact = {
      id: "artifact-1",
      conversationId: "conversation-1",
      displayName: "文档.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      format: "docx" as const,
      sizeBytes: 100,
      status: "ready" as const,
      currentRevisionId: "revision-1",
      messageId: "message-user",
      createdAt: now,
      updatedAt: now,
    };
    const repository = {
      getById: vi.fn(async () => ({
        artifact,
        revision: {
          id: "revision-1",
          artifactId: artifact.id,
          storageKey: "source.docx",
          checksum: "a".repeat(64),
          sizeBytes: 100,
          createdBy: "user_import" as const,
          createdAt: now,
        },
      })),
      addRevisionAndBindOutput: vi.fn(async () => undefined),
    } as unknown as DocumentArtifactRepository;
    const content = {
      patch: vi.fn(async () => new Uint8Array([1, 2, 3])),
    } as unknown as DocumentContentAdapter;
    const files = {
      readFile: vi.fn(async () => new Uint8Array([0])),
      writeFile: vi.fn(async () => ({
        displayName: artifact.displayName,
        mediaType: artifact.mediaType,
        format: artifact.format,
        sizeBytes: 3,
        checksum: "b".repeat(64),
        storageKey: "revision-2.docx",
      })),
      removeFile: vi.fn(async () => undefined),
    } as unknown as DocumentFileStore;
    const conversations = {
      getById: vi.fn(async () => ({ id: "conversation-1" })),
    } as unknown as ConversationRepository;
    const service = new DocumentArtifactMutationService(
      repository,
      files,
      conversations,
      content,
      { now: () => now },
      { create: () => "revision-2" },
    );
    const operations = [
      { type: "replace_text", search: "错一", replacement: "正一" },
      { type: "replace_text", search: "错二", replacement: "正二" },
    ] as const;

    await service.patch(
      "conversation-1",
      artifact.id,
      artifact.currentRevisionId,
      operations,
      new AbortController().signal,
    );

    expect(content.patch).toHaveBeenCalledOnce();
    expect(content.patch).toHaveBeenCalledWith(
      new Uint8Array([0]),
      artifact,
      operations,
      expect.any(AbortSignal),
    );
    expect(files.writeFile).toHaveBeenCalledOnce();
    expect(repository.addRevisionAndBindOutput).toHaveBeenCalledOnce();
  });
});
