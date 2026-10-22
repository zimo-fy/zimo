// @vitest-environment jsdom
import { AppDialogProvider } from "@zimo/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ConversationSummaryView } from "@zimo/contracts";
import { describe, expect, it, vi } from "vitest";

import { TaskNavigation } from "./task-navigation";

const task: ConversationSummaryView = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "整理项目文档",
  modelId: "00000000-0000-4000-8000-000000000002",
  modelDisplayName: "DeepSeek V4 Flash",
  messageCount: 2,
  isPinned: false,
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:01:00.000Z",
};

describe("TaskNavigation", () => {
  it("pins a task from its action menu", async () => {
    const onSetPinned = vi.fn().mockResolvedValue({ ok: true });
    const { rerender } = render(
      <AppDialogProvider>
        <TaskNavigation
          tasks={[task]}
          activeId={task.id}
          onCreate={vi.fn()}
          onSelect={vi.fn()}
          onRename={vi.fn().mockResolvedValue({ ok: true })}
          onSetPinned={onSetPinned}
          onDelete={vi.fn().mockResolvedValue({ ok: true })}
        />
      </AppDialogProvider>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: `管理任务：${task.title}` }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "置顶" }));

    await waitFor(() => expect(onSetPinned).toHaveBeenCalledWith(task.id, true));

    rerender(
      <AppDialogProvider>
        <TaskNavigation
          tasks={[{ ...task, isPinned: true }]}
          activeId={task.id}
          onCreate={vi.fn()}
          onSelect={vi.fn()}
          onRename={vi.fn().mockResolvedValue({ ok: true })}
          onSetPinned={onSetPinned}
          onDelete={vi.fn().mockResolvedValue({ ok: true })}
        />
      </AppDialogProvider>,
    );
    expect(screen.getByLabelText("已置顶")).toBeTruthy();
  });
});
