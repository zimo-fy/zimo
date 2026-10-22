import type {
  DocumentArtifact,
  DocumentArtifactRepository,
  DocumentArtifactWithRevision,
} from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import { DocumentModelService } from "./document-model-service";

describe("DocumentModelService", () => {
  it("resolves the same short reference to the persisted internal id across tool rounds", async () => {
    const persisted = value("internal-artifact-id", "internal-revision-id", "conversation-1");
    const repository = repositoryFor(persisted);
    const inspect = vi.fn().mockResolvedValue({
      artifactId: persisted.artifact.id,
      revisionId: persisted.revision.id,
      displayName: "方案.docx",
      format: "docx",
      unitCount: 1,
      units: ["正文"],
      preview: "摘要",
      truncated: false,
    });
    const read = vi.fn().mockResolvedValue({
      artifactId: persisted.artifact.id,
      revisionId: persisted.revision.id,
      content: "正文",
      truncated: false,
    });
    const service = new DocumentModelService(repository, "conversation-1", {
      inspect,
      read,
      create: vi.fn(),
      patch: vi.fn(),
      convert: vi.fn(),
    });

    expect(await service.inspect("doc_1", signal())).toMatchObject({ documentRef: "doc_1" });
    expect(await service.read("doc_1", {}, signal())).toEqual({
      documentRef: "doc_1",
      content: "正文",
      truncated: false,
    });
    expect(inspect).toHaveBeenCalledWith(persisted.artifact.id, expect.any(AbortSignal));
    expect(read).toHaveBeenCalledWith(persisted.artifact.id, {}, expect.any(AbortSignal));
  });

  it("keeps revision ids internal when patching", async () => {
    const persisted = value("artifact-a", "revision-current", "conversation-1");
    const patch = vi.fn().mockResolvedValue(persisted.artifact);
    const service = new DocumentModelService(repositoryFor(persisted), "conversation-1", {
      inspect: vi.fn(),
      read: vi.fn(),
      create: vi.fn(),
      patch,
      convert: vi.fn(),
    });
    const operation = { type: "append_text", text: "新增" } as const;

    await service.patch("doc_1", [operation], signal());

    expect(patch).toHaveBeenCalledWith(
      persisted.artifact.id,
      persisted.revision.id,
      [operation],
      expect.any(AbortSignal),
    );
  });

  it("rejects raw ids and references outside the current conversation", async () => {
    const other = value("artifact-other", "revision-other", "conversation-2");
    const repository = repositoryFor(other, []);
    const service = new DocumentModelService(repository, "conversation-1", {
      inspect: vi.fn(),
      read: vi.fn(),
      create: vi.fn(),
      patch: vi.fn(),
      convert: vi.fn(),
    });

    await expect(service.inspect("artifact-other", signal())).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });
    await expect(service.inspect("doc_1", signal())).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });
  });
});

function repositoryFor(
  current: DocumentArtifactWithRevision,
  listed: readonly DocumentArtifact[] = [current.artifact],
): DocumentArtifactRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(async (id) => (id === current.artifact.id ? current : null)),
    listByConversation: vi.fn(async () => listed),
    listRevisionsByConversation: vi.fn(async () => []),
    getRevision: vi.fn(async () => null),
    addRevision: vi.fn(),
    addRevisionAndBindOutput: vi.fn(),
    bindOutputToActiveAssistant: vi.fn(),
    deleteDraft: vi.fn(async () => false),
    deleteByConversation: vi.fn(),
  };
}

function value(
  artifactId: string,
  revisionId: string,
  conversationId: string,
): DocumentArtifactWithRevision {
  const createdAt = new Date("2026-09-15T00:00:00Z");
  return {
    artifact: {
      id: artifactId,
      conversationId,
      displayName: "方案.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      format: "docx",
      sizeBytes: 100,
      status: "ready",
      currentRevisionId: revisionId,
      messageId: "message-1",
      createdAt,
      updatedAt: createdAt,
    },
    revision: {
      id: revisionId,
      artifactId,
      storageKey: "storage-key",
      checksum: "checksum",
      sizeBytes: 100,
      createdBy: "user_import",
      createdAt,
    },
  };
}

function signal(): AbortSignal {
  return new AbortController().signal;
}
