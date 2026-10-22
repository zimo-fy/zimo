// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { DocumentArtifactView } from "@zimo/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  DocumentDropOverlay,
  DocumentPreviewDialog,
  DraftAttachmentStrip,
  MessageAttachmentCards,
} from "./document-attachments";

const artifact: DocumentArtifactView = {
  id: "11111111-1111-4111-8111-111111111111",
  conversationId: "22222222-2222-4222-8222-222222222222",
  messageId: "33333333-3333-4333-8333-333333333333",
  displayName: "季度报告.docx",
  mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  format: "docx",
  sizeBytes: 2048,
  status: "ready",
  currentRevisionId: "44444444-4444-4444-8444-444444444444",
  revisionId: "44444444-4444-4444-8444-444444444444",
  createdAt: "2026-09-14T00:00:00.000Z",
  updatedAt: "2026-09-14T00:00:00.000Z",
};

describe("document attachments", () => {
  it("shows a draft attachment and allows removing it", () => {
    const onRemove = vi.fn();
    render(
      <DraftAttachmentStrip
        artifacts={[artifact]}
        disabled={false}
        busy={false}
        onRemove={onRemove}
        onPreview={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "移除 季度报告.docx" }));

    expect(screen.getByText("季度报告.docx")).toBeTruthy();
    expect(onRemove).toHaveBeenCalledWith(artifact.id);
  });

  it("shows progress before the imported artifact is available", () => {
    render(
      <DraftAttachmentStrip
        artifacts={[]}
        disabled
        busy
        onRemove={() => undefined}
        onPreview={() => undefined}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("正在添加文件");
  });

  it("renders image attachments from the opaque display protocol", () => {
    const image: DocumentArtifactView = {
      ...artifact,
      displayName: "shot.jpeg",
      mediaType: "image/jpeg",
      format: "jpeg",
    };
    render(
      <MessageAttachmentCards
        artifacts={[image]}
        dark
        onExport={() => undefined}
        onPreview={() => undefined}
      />,
    );

    expect(screen.getByRole("img", { name: "shot.jpeg" }).getAttribute("src")).toBe(
      "zimo-doc://v1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444",
    );
  });

  it("shows the image itself in the preview dialog", () => {
    render(
      <DocumentPreviewDialog
        conversationId={artifact.conversationId}
        preview={{
          artifactId: artifact.id,
          revisionId: artifact.currentRevisionId,
          format: "jpeg",
          displayName: "shot.jpeg",
          unitCount: 0,
          units: [],
          preview: "",
          truncated: false,
        }}
        onClose={() => undefined}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "预览 shot.jpeg" });
    expect(within(dialog).getByRole("img", { name: "shot.jpeg" })).toBeTruthy();
    expect(within(dialog).queryByText("该文档没有可预览的文本内容。")).toBeNull();
  });

  it("exports a sent message attachment by opaque artifact id", () => {
    const onExport = vi.fn();
    render(
      <MessageAttachmentCards
        artifacts={[artifact]}
        dark
        onExport={onExport}
        onPreview={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "导出 季度报告.docx" }));

    expect(onExport).toHaveBeenCalledWith(artifact.id, artifact.revisionId);
  });

  it("tells users which document types can be dropped", () => {
    render(<DocumentDropOverlay />);
    expect(screen.getByText(/PNG、JPEG、WebP/)).toBeTruthy();
  });

  it("shows a bounded local text preview", () => {
    render(
      <DocumentPreviewDialog
        preview={{
          artifactId: artifact.id,
          revisionId: artifact.currentRevisionId,
          format: "docx",
          displayName: artifact.displayName,
          unitCount: 2,
          units: ["摘要", "建议"],
          preview: "需要优化的内容",
          truncated: true,
        }}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByRole("dialog", { name: "预览 季度报告.docx" })).toBeTruthy();
    expect(screen.getByText("需要优化的内容")).toBeTruthy();
  });
});
