// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationNotice } from "./chat-chrome";

describe("ConversationNotice", () => {
  it("shows the model vision error and can be dismissed", () => {
    const onDismiss = vi.fn();
    render(
      <ConversationNotice message="此模型不支持图像输入。请尝试其他模型" onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关闭提示" }));
    expect(screen.getByRole("alert").textContent).toContain("此模型不支持图像输入。请尝试其他模型");
    expect(onDismiss).toHaveBeenCalled();
  });
});
