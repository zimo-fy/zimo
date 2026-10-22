// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantReplyProgress } from "./assistant-reply-progress";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const completedStep = {
  id: "call-1",
  kind: "file_read" as const,
  title: "读取 notes.md",
  status: "completed" as const,
  resultTitle: "已读取 notes.md",
  relativeTarget: "notes.md",
};

describe("AssistantReplyProgress", () => {
  it("shows live thinking elapsed time above tool rows", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T08:00:12.000Z"));
    render(
      <AssistantReplyProgress
        status="streaming"
        createdAt="2026-09-21T08:00:00.000Z"
        updatedAt="2026-09-21T08:00:00.000Z"
        steps={[
          {
            id: "call-1",
            kind: "file_read",
            title: "读取 notes.md",
            status: "running",
            resultTitle: "已读取 notes.md",
            relativeTarget: "notes.md",
          },
        ]}
      />,
    );
    const progress = screen.getByLabelText("思考过程");
    expect(progress.textContent).toContain("思考中 12s");
    expect(progress.textContent).toContain("读取 notes.md");
    expect(progress.textContent).not.toContain("已读取 notes.md");
  });

  it("keeps completed tool rows collapsed until the elapsed header is opened", async () => {
    const user = userEvent.setup();
    render(
      <AssistantReplyProgress
        status="completed"
        createdAt="2026-09-21T08:00:00.000Z"
        updatedAt="2026-09-21T08:00:16.000Z"
        steps={[completedStep]}
      />,
    );
    const toggle = screen.getByRole("button", { name: "已完成 16s" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("读取 notes.md")).toBeNull();
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("读取 notes.md").textContent).toBe("读取 notes.md");
    expect(screen.getByText("已读取 notes.md").textContent).toBe("已读取 notes.md");
  });
});
