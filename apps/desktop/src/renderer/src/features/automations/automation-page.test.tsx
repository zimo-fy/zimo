// @vitest-environment jsdom
import { AppDialogProvider } from "@zimo/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutomationPage } from "./automation-page";
import { RECRUITMENT_GREETING_PROMPT } from "./automation-prompt-presets";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AutomationPage", () => {
  it("opens a new task with only the greeting prompt prefilled", () => {
    const list = vi.fn().mockResolvedValue({ ok: true, data: [] });
    const save = vi.fn();
    vi.stubGlobal("zimo", {
      automations: { list, save },
      models: { list },
      router: { listTargets: list },
      prototypes: { list },
      mcp: { list },
    });

    render(
      <AppDialogProvider>
        <AutomationPage />
      </AppDialogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "快捷创建打招呼自动化任务" }));

    expect(
      (screen.getByRole("textbox", { name: "每次执行的指令" }) as HTMLTextAreaElement).value,
    ).toBe(RECRUITMENT_GREETING_PROMPT);
    expect((screen.getByRole("textbox", { name: "名称" }) as HTMLInputElement).value).toBe("");
    expect(save).not.toHaveBeenCalled();
  });
});
