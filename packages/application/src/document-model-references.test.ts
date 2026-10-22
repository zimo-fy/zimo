import type { DocumentArtifact } from "@zimo/domain";
import { describe, expect, it } from "vitest";

import {
  compileModelAttachmentContext,
  listModelDocuments,
  resolveDocumentReference,
} from "./document-model-references";

describe("model document references", () => {
  it("keeps short references stable and excludes unsent drafts", () => {
    const sent = artifact("internal-uuid-sent", "message-1");
    const draft = artifact("internal-uuid-draft");
    const restored = listModelDocuments([sent, draft]);

    expect(resolveDocumentReference(restored, "doc_1")?.id).toBe(sent.id);
    expect(resolveDocumentReference(restored, "doc_2")).toBeUndefined();
    expect(resolveDocumentReference(restored, "internal-uuid-sent")).toBeUndefined();
  });

  it("emits only the short reference into model context", async () => {
    const sent = artifact("00000000-0000-4000-8000-000000000901", "message-1");
    const context = await compileModelAttachmentContext({
      artifacts: [sent],
      messageId: "message-1",
      signal: new AbortController().signal,
      inspect: async () => ({
        artifactId: sent.id,
        revisionId: "00000000-0000-4000-8000-000000000902",
        displayName: "方案.docx",
        format: "docx",
        unitCount: 1,
        units: ["正文"],
        preview: "改进建议",
        truncated: false,
      }),
    });

    expect(context).toContain("documentRef: doc_1");
    expect(context).not.toContain(sent.id);
    expect(context).not.toContain("00000000-0000-4000-8000-000000000902");
  });
});

function artifact(id: string, messageId?: string): DocumentArtifact {
  return {
    id,
    conversationId: "conversation-1",
    displayName: "方案.docx",
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    format: "docx",
    sizeBytes: 100,
    status: "ready",
    currentRevisionId: `${id}-revision`,
    ...(messageId ? { messageId } : {}),
    createdAt: new Date("2026-09-15T00:00:00Z"),
    updatedAt: new Date("2026-09-15T00:00:00Z"),
  };
}
