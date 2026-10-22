// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkspaceGrantView } from "@zimo/contracts";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceGrantStrip } from "./workspace-grants";

const grant: WorkspaceGrantView = {
  id: "00000000-0000-4000-8000-000000000001",
  conversationId: "00000000-0000-4000-8000-000000000002",
  displayName: "zimo",
  kind: "external",
  mode: "ask",
  status: "active",
  createdAt: "2026-09-15T00:00:00.000Z",
  updatedAt: "2026-09-15T00:00:00.000Z",
};

describe("WorkspaceGrantStrip", () => {
  it("shows a read-only grant without exposing its path", () => {
    const onRemove = vi.fn();
    render(
      <WorkspaceGrantStrip
        workspaces={[grant]}
        disabled={false}
        busy={false}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("zimo")).toBeTruthy();
    expect(screen.getByText("已授权")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "移除工作目录 zimo" }));
    expect(onRemove).toHaveBeenCalledWith(grant.id);
    expect(document.body.textContent).not.toContain("/Volumes/");
  });

  it("does not show the managed Zimo Workspace", () => {
    const { container } = render(
      <WorkspaceGrantStrip
        workspaces={[
          {
            ...grant,
            id: "00000000-0000-4000-8000-000000000003",
            displayName: "Zimo Workspace",
            kind: "managed",
          },
        ]}
        disabled={false}
        busy={false}
        onRemove={vi.fn()}
      />,
    );

    expect(container.textContent).toBe("");
  });
});
