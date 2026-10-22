// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SecurityAuditCenter } from "./security-audit-center";

const revokeAuthorization = vi.fn(async () => ({
  ok: true as const,
  data: { success: true as const },
}));

describe("SecurityAuditCenter", () => {
  beforeEach(() => {
    revokeAuthorization.mockClear();
    Object.defineProperty(window, "zimo", {
      configurable: true,
      value: {
        securityAudit: {
          list: vi.fn(async () => ({
            ok: true,
            data: [
              {
                id: "00000000-0000-4000-8000-000000000001",
                eventType: "action_policy_denied",
                actionKind: "file_delete",
                risk: "high",
                outcome: "denied",
                errorCode: "ACTION_POLICY_DENIED",
                actionLabel: "删除文件",
                workspaceLabel: "project",
                relativeTarget: "src/index.ts",
                createdAt: "2026-09-16T00:00:00.000Z",
              },
            ],
          })),
        },
        workspaces: {
          listAuthorizations: vi.fn(async () => ({
            ok: true,
            data: [
              {
                id: "00000000-0000-4000-8000-000000000010",
                displayName: "project",
                location: "/Users/example/project",
                createdAt: "2026-09-16T00:00:00.000Z",
                updatedAt: "2026-09-16T00:00:00.000Z",
              },
            ],
          })),
          revokeAuthorization,
        },
      },
    });
  });

  it("renders action details and remembered directory authorizations", async () => {
    render(<SecurityAuditCenter />);

    await waitFor(() => expect(screen.getByText("策略拦截")).toBeTruthy());
    expect(screen.getByText("已拦截")).toBeTruthy();
    expect(screen.getByText("删除文件 · project/src/index.ts")).toBeTruthy();
    expect(screen.getByText("/Users/example/project")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));
    await waitFor(() => expect(revokeAuthorization).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("/Users/example/project")).toBeNull();
  });
});
