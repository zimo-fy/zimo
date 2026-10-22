// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ConversationDetailView } from "@zimo/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { ConversationMessages } from "./conversation-messages";

afterEach(cleanup);

describe("conversation context compaction", () => {
  it("shows running and completed checkpoint events", () => {
    render(
      <ConversationMessages
        detail={detail}
        artifacts={[]}
        onExportArtifact={() => undefined}
        onPreviewArtifact={() => undefined}
        onCompact={() => undefined}
        compacting={false}
        onCancelCompaction={() => undefined}
      />,
    );

    expect(screen.getByText("已完成上下文压缩")).toBeTruthy();
    expect(screen.getByText("正在整理较早的会话内容……")).toBeTruthy();
    expect(screen.getByText("查看交接摘要")).toBeTruthy();
  });

  it("offers manual compression only on the latest completed assistant reply", () => {
    const calls: string[] = [];
    const { container } = render(
      <ConversationMessages
        detail={{
          ...detail,
          contextCompactions: [],
          messages: [
            {
              id: "00000000-0000-4000-8000-000000000011",
              conversationId: detail.id,
              role: "assistant",
              content: "较早回复",
              status: "completed",
              position: 0,
              createdAt: detail.createdAt,
              updatedAt: detail.createdAt,
            },
            {
              id: "00000000-0000-4000-8000-000000000012",
              conversationId: detail.id,
              role: "assistant",
              content: "最新回复",
              status: "completed",
              position: 1,
              createdAt: detail.updatedAt,
              updatedAt: detail.updatedAt,
            },
          ],
        }}
        artifacts={[]}
        onExportArtifact={() => undefined}
        onPreviewArtifact={() => undefined}
        onCompact={() => calls.push("compact")}
        compacting={false}
        onCancelCompaction={() => undefined}
      />,
    );
    const buttons = within(container).getAllByRole("button", { name: "回复操作" });
    fireEvent.keyDown(buttons[1]!, { key: "Enter" });
    expect(screen.getByText("压缩当前会话")).toBeTruthy();
    fireEvent.click(screen.getByText("压缩当前会话"));
    expect(calls).toEqual(["compact"]);
  });

  it("keeps regenerate out of the reply action menu", () => {
    const { container } = render(
      <ConversationMessages
        detail={{
          ...detail,
          contextCompactions: [],
          messages: [
            {
              id: "00000000-0000-4000-8000-000000000011",
              conversationId: detail.id,
              role: "assistant",
              content: "较早回复",
              status: "completed",
              position: 0,
              createdAt: detail.createdAt,
              updatedAt: detail.createdAt,
            },
            {
              id: "00000000-0000-4000-8000-000000000012",
              conversationId: detail.id,
              role: "assistant",
              content: "最新回复",
              status: "completed",
              position: 1,
              createdAt: detail.updatedAt,
              updatedAt: detail.updatedAt,
            },
          ],
        }}
        artifacts={[]}
        onExportArtifact={() => undefined}
        onPreviewArtifact={() => undefined}
        onCompact={() => undefined}
        compacting={false}
        onCancelCompaction={() => undefined}
        onRegenerate={() => undefined}
      />,
    );
    const buttons = within(container).getAllByRole("button", { name: "回复操作" });
    expect(buttons).toHaveLength(2);
    fireEvent.keyDown(buttons[0]!, { key: "Enter" });
    expect(screen.getByRole("menuitem", { name: "复制当前内容" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "重新生成" })).toBeNull();
  });
});

const detail: ConversationDetailView = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "长任务",
  modelId: "00000000-0000-4000-8000-000000000002",
  skillIds: [],
  knowledgeBaseIds: [],
  mcpToolIds: [],
  browserEnabled: false,
  messages: [],
  contextCompactions: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      conversationId: "00000000-0000-4000-8000-000000000001",
      version: 1,
      status: "completed",
      trigger: "threshold",
      sourceFromMessageId: "00000000-0000-4000-8000-000000000004",
      sourceToMessageId: "00000000-0000-4000-8000-000000000005",
      coveredThroughPosition: 10,
      retainedFromPosition: 11,
      summary: "## 当前任务\n继续完成实现",
      inputTokens: 960_000,
      outputTokens: 2_000,
      createdAt: "2026-09-18T10:00:00.000Z",
      updatedAt: "2026-09-18T10:01:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000006",
      conversationId: "00000000-0000-4000-8000-000000000001",
      version: 2,
      status: "running",
      trigger: "threshold",
      sourceFromMessageId: "00000000-0000-4000-8000-000000000004",
      sourceToMessageId: "00000000-0000-4000-8000-000000000007",
      coveredThroughPosition: 20,
      retainedFromPosition: 21,
      inputTokens: 965_000,
      createdAt: "2026-09-18T11:00:00.000Z",
      updatedAt: "2026-09-18T11:00:00.000Z",
    },
  ],
  createdAt: "2026-09-18T09:00:00.000Z",
  updatedAt: "2026-09-18T11:00:00.000Z",
};
