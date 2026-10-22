import { describe, expect, it } from "vitest";

import {
  documentArtifactViewSchema,
  documentDigestViewSchema,
  documentImportDroppedRequestSchema,
} from "./documents";

describe("document contracts", () => {
  it("accepts opaque document metadata without a local path", () => {
    const parsed = documentArtifactViewSchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      conversationId: "22222222-2222-4222-8222-222222222222",
      displayName: "报告.pdf",
      mediaType: "application/pdf",
      format: "pdf",
      sizeBytes: 1024,
      status: "ready",
      currentRevisionId: "33333333-3333-4333-8333-333333333333",
      revisionId: "33333333-3333-4333-8333-333333333333",
      createdAt: "2026-09-14T00:00:00.000Z",
      updatedAt: "2026-09-14T00:00:00.000Z",
    });

    expect(parsed).not.toHaveProperty("sourcePath");
    expect(parsed.displayName).toBe("报告.pdf");
  });

  it("rejects more than ten dropped file paths at the IPC boundary", () => {
    const result = documentImportDroppedRequestSchema.safeParse({
      requestId: "44444444-4444-4444-8444-444444444444",
      payload: {
        conversationId: "22222222-2222-4222-8222-222222222222",
        sourcePaths: Array.from({ length: 11 }, (_, index) => `/tmp/${index}.pdf`),
      },
    });

    expect(result.success).toBe(false);
  });

  it("bounds document preview text at the IPC boundary", () => {
    const value = {
      artifactId: "11111111-1111-4111-8111-111111111111",
      revisionId: "33333333-3333-4333-8333-333333333333",
      displayName: "报告.pdf",
      format: "pdf",
      unitCount: 1,
      units: ["第 1 页"],
      preview: "x".repeat(2_001),
      truncated: true,
    };

    expect(documentDigestViewSchema.safeParse(value).success).toBe(false);
  });
});
