import { describe, expect, it, vi } from "vitest";
import type { DocumentArtifact, DocumentFormat } from "@zimo/domain";

import { LocalDocumentContentAdapter } from "./document-content-adapter";

const adapter = new LocalDocumentContentAdapter();
const signal = new AbortController().signal;

describe("LocalDocumentContentAdapter", () => {
  it.each([
    ["docx", { title: "项目总结", paragraphs: ["第一部分", "这是文档内容。"] }],
    [
      "xlsx",
      {
        title: "销售",
        rows: [
          ["地区", "金额"],
          ["华南", 120],
        ],
      },
    ],
    ["pptx", { title: "路演", slides: [{ title: "产品", body: "核心能力" }] }],
    ["pdf", { title: "Report", paragraphs: ["Quarterly result"] }],
  ] as const)("creates and reads %s", async (format, content) => {
    const bytes = await adapter.create(format, content, signal);
    const artifact = makeArtifact(format);
    const digest = await adapter.inspect(bytes, artifact, signal);
    const slice = await adapter.read(bytes, artifact, { maxCharacters: 6_000 }, signal);

    expect(bytes.byteLength).toBeGreaterThan(100);
    expect(digest.artifactId).toBe(artifact.id);
    expect(slice.content.length).toBeGreaterThan(0);
  });

  it("patches spreadsheet cells without mutating the source bytes", async () => {
    const source = await adapter.create(
      "xlsx",
      { title: "销售", rows: [["地区", "金额"]] },
      signal,
    );
    const patched = await adapter.patch(
      source,
      makeArtifact("xlsx"),
      [{ type: "set_cells", sheetName: "销售", startCell: "A2", rows: [["华南", 200]] }],
      signal,
    );
    const content = await adapter.read(patched, makeArtifact("xlsx"), {}, signal);

    expect(patched).not.toEqual(source);
    expect(content.content).toContain("华南");
    expect(content.content).toContain("200");
  });

  it("applies multiple DOCX replacements without prepending the display name", async () => {
    const source = await adapter.create(
      "docx",
      { title: "OpenClaw 技术共亠文档", paragraphs: ["模型推理屁"] },
      signal,
    );
    const artifact = {
      ...makeArtifact("docx"),
      displayName: "OpenClaw 技术分享.docx",
    };
    const patched = await adapter.patch(
      source,
      artifact,
      [
        {
          type: "replace_text",
          search: "OpenClaw 技术共亠文档",
          replacement: "OpenClaw 技术分享文档",
        },
        { type: "replace_text", search: "模型推理屁", replacement: "模型推理层" },
      ],
      signal,
    );
    const content = await adapter.read(patched, artifact, {}, signal);

    expect(content.content.match(/OpenClaw 技术分享/g)).toHaveLength(1);
    expect(content.content).toContain("模型推理层");
    expect(content.content).not.toContain("模型推理屁");
  });

  it("inspects utf-8 text attachments and converts them to an editable office format", async () => {
    const bytes = new TextEncoder().encode("# 纪要\n\n第一段内容");
    const artifact = makeArtifact("md");
    const digest = await adapter.inspect(bytes, artifact, signal);
    const converted = await adapter.convert(bytes, artifact, "docx", signal);
    const content = await adapter.read(converted, makeArtifact("docx"), {}, signal);

    expect(digest.preview).toContain("第一段内容");
    expect(content.content).toContain("第一段内容");
  });

  it("refuses to create a non-editable import format", async () => {
    await expect(
      adapter.create("txt", { title: "笔记", paragraphs: ["正文"] }, signal),
    ).rejects.toMatchObject({
      code: "DOCUMENT_OPERATION_UNSUPPORTED",
    });
  });

  it("converts an Office document through extracted semantic text", async () => {
    const source = await adapter.create(
      "docx",
      { title: "Input", paragraphs: ["Reusable content"] },
      signal,
    );
    const converted = await adapter.convert(source, makeArtifact("docx"), "pptx", signal);
    const content = await adapter.read(converted, makeArtifact("pptx"), {}, signal);

    expect(content.content).toContain("Reusable content");
  });

  it("creates immutable PDF page-operation results", async () => {
    const source = await adapter.create(
      "pdf",
      { title: "Report", paragraphs: Array.from({ length: 70 }, (_, index) => `Line ${index}`) },
      signal,
    );
    const numbered = await adapter.patch(
      source,
      makeArtifact("pdf"),
      [{ type: "add_page_numbers" }],
      signal,
    );
    const selected = await adapter.patch(
      numbered,
      makeArtifact("pdf"),
      [{ type: "reorder_pages", pageNumbers: [1] }],
      signal,
    );

    expect(numbered).not.toEqual(source);
    expect(selected.byteLength).toBeGreaterThan(100);
  });

  it("delegates Chinese PDF creation to the injected Chromium renderer", async () => {
    const rendered = new Uint8Array([37, 80, 68, 70, 45, 49]);
    const renderer = vi.fn().mockResolvedValue(rendered);
    const pdfAdapter = new LocalDocumentContentAdapter(renderer);

    await expect(
      pdfAdapter.create("pdf", { title: "中文 PDF", paragraphs: ["正文"] }, signal),
    ).resolves.toEqual(rendered);
    expect(renderer).toHaveBeenCalledOnce();
  });

  it("honors cancellation before document parsing", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      adapter.inspect(new Uint8Array([1]), makeArtifact("docx"), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

function makeArtifact(format: DocumentFormat): DocumentArtifact {
  return {
    id: "00000000-0000-4000-8000-000000000801",
    conversationId: "00000000-0000-4000-8000-000000000802",
    displayName: `fixture.${format}`,
    mediaType: "application/octet-stream",
    format,
    sizeBytes: 100,
    status: "ready",
    currentRevisionId: "00000000-0000-4000-8000-000000000803",
    createdAt: new Date("2026-09-14T00:00:00.000Z"),
    updatedAt: new Date("2026-09-14T00:00:00.000Z"),
  };
}
