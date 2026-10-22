// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutomationEditor } from "./automation-editor";
import { RECRUITMENT_GREETING_PROMPT } from "./automation-prompt-presets";

afterEach(cleanup);

describe("AutomationEditor", () => {
  it("keeps execution capabilities collapsed until the user opens them", () => {
    render(
      <AutomationEditor
        models={[]}
        agents={[]}
        skills={[
          {
            id: "skill-1",
            type: "skill",
            name: "招聘平台",
            description: "测试能力",
            enabled: true,
          },
        ]}
        knowledgeBases={[]}
        workflows={[]}
        mcpConnections={[]}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const summary = screen.getByText("执行能力").closest("summary");
    if (!summary) throw new Error("执行能力摘要不存在");
    const details = summary.closest("details");
    if (!details) throw new Error("执行能力折叠区不存在");
    expect(details.open).toBe(false);
    expect(screen.getByText("按需展开配置")).toBeTruthy();

    fireEvent.click(summary);
    expect(details.open).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "招聘平台" }));
    expect(screen.getByText("已绑定 1 项")).toBeTruthy();
    fireEvent.click(summary);
    expect(details.open).toBe(false);
  });

  it("shows a prefilled prompt and resizes the input as the content changes", () => {
    const onSave = vi.fn();
    render(
      <AutomationEditor
        initialPrompt={RECRUITMENT_GREETING_PROMPT}
        models={[]}
        agents={[]}
        skills={[]}
        knowledgeBases={[]}
        workflows={[]}
        mcpConnections={[]}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    const prompt = screen.getByRole("textbox", { name: "每次执行的指令" }) as HTMLTextAreaElement;
    expect(prompt.value).toBe(RECRUITMENT_GREETING_PROMPT);
    expect(prompt.value).toContain("Boss 直聘、鱼泡直聘、猎聘网");
    expect(prompt.value).toContain("目标人数 N = 10");
    expect(prompt.value).toContain("`[TASK_DONE]`");
    expect(prompt.value).not.toMatch(/^## .+\n\n/gm);
    expect((screen.getByRole("textbox", { name: "名称" }) as HTMLInputElement).value).toBe("");
    expect(onSave).not.toHaveBeenCalled();

    Object.defineProperty(prompt, "scrollHeight", {
      configurable: true,
      get: () => (prompt.value.length > 30 ? 480 : 140),
    });
    fireEvent.change(prompt, { target: { value: `${RECRUITMENT_GREETING_PROMPT}\n补充条件` } });
    expect(prompt.style.height).toBe("480px");
    fireEvent.change(prompt, { target: { value: "调整后的招聘指令" } });
    expect(prompt.value).toBe("调整后的招聘指令");
    expect(prompt.style.height).toBe("140px");
  });
});
