// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionApprovalCard } from "./action-approval-card";

describe("ActionApprovalCard", () => {
  it("shows a bounded action summary and only offers one-time approval", () => {
    const onResolve = vi.fn();
    render(
      <ActionApprovalCard
        approval={{
          runId: "00000000-0000-4000-8000-000000000001",
          event: {
            type: "approval.requested",
            approvalId: "00000000-0000-4000-8000-000000000002",
            conversationId: "00000000-0000-4000-8000-000000000003",
            actionDigest: "a".repeat(64),
            actionKind: "file_write",
            risk: "medium",
            summary: "修改项目说明",
            relativeTarget: "README.md",
            expiresAt: "2026-09-16T00:05:00.000Z",
          },
        }}
        busy={false}
        onResolve={onResolve}
      />,
    );

    expect(screen.getByText("修改项目说明")).toBeTruthy();
    expect(screen.queryByText("始终允许")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "仅批准本次" }));
    expect(onResolve).toHaveBeenCalledWith("allowed_once");
  });

  it("shows the complete command before approval", () => {
    render(
      <ActionApprovalCard
        approval={{
          runId: "00000000-0000-4000-8000-000000000001",
          event: {
            type: "approval.requested",
            approvalId: "00000000-0000-4000-8000-000000000002",
            conversationId: "00000000-0000-4000-8000-000000000003",
            actionDigest: "a".repeat(64),
            actionKind: "command",
            risk: "high",
            summary: "在 project 运行终端命令",
            relativeTarget: ".",
            command: "pnpm install && pnpm test",
            expiresAt: "2026-09-16T00:05:00.000Z",
          },
        }}
        busy={false}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText("pnpm install && pnpm test")).toBeTruthy();
  });
});
