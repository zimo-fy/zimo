// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkspaceGrantView } from "@zimo/contracts";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceApprovalMode } from "./workspace-approval-mode";

const grant: WorkspaceGrantView = {
  id: "00000000-0000-4000-8000-000000000001",
  conversationId: "00000000-0000-4000-8000-000000000002",
  displayName: "Zimo Workspace",
  kind: "managed",
  mode: "ask",
  status: "active",
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
};

describe("WorkspaceApprovalMode", () => {
  it("shows request approval by default and allows changing mode", () => {
    const onChange = vi.fn();
    render(
      <WorkspaceApprovalMode
        workspaces={[grant]}
        disabled={false}
        busy={false}
        onChange={onChange}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "操作审批模式" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /帮我批准/ }));
    expect(onChange).toHaveBeenCalledWith("auto_approve");
  });
});
