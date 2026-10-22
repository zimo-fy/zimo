// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AppDialogProvider, useAppDialog } from "./app-dialog";

afterEach(() => cleanup());

describe("AppDialogProvider", () => {
  it("resolves alert after the in-app 确定 button is pressed", async () => {
    const user = userEvent.setup();
    render(
      <AppDialogProvider>
        <AlertHarness />
      </AppDialogProvider>,
    );

    await user.click(screen.getByRole("button", { name: "打开提示" }));
    expect(screen.getByRole("alertdialog", { name: "提示" }).textContent).toContain("任务创建失败");
    await user.click(screen.getByRole("button", { name: "确定" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("alert-result").textContent).toBe("closed");
  });

  it("returns false when confirm is cancelled and restores trigger focus", async () => {
    const user = userEvent.setup();
    render(
      <AppDialogProvider>
        <ConfirmHarness />
      </AppDialogProvider>,
    );

    const trigger = screen.getByRole("button", { name: "打开确认" });
    trigger.focus();
    await user.click(trigger);
    expect(screen.getByRole("alertdialog", { name: "请确认" }).textContent).toContain("确定删除？");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("confirm-result").textContent).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("returns true when confirm is accepted", async () => {
    const user = userEvent.setup();
    render(
      <AppDialogProvider>
        <ConfirmHarness />
      </AppDialogProvider>,
    );

    await user.click(screen.getByRole("button", { name: "打开确认" }));
    await user.click(screen.getByRole("button", { name: "确定" }));
    expect(screen.getByTestId("confirm-result").textContent).toBe("true");
  });
});

function AlertHarness() {
  const { alert } = useAppDialog();
  const [status, setStatus] = useState("idle");
  return (
    <>
      <button
        type="button"
        onClick={() => void alert("任务创建失败").then(() => setStatus("closed"))}
      >
        打开提示
      </button>
      <span data-testid="alert-result">{status}</span>
    </>
  );
}

function ConfirmHarness() {
  const { confirm } = useAppDialog();
  const [status, setStatus] = useState("idle");
  return (
    <>
      <button
        type="button"
        onClick={() => void confirm("确定删除？").then((value) => setStatus(String(value)))}
      >
        打开确认
      </button>
      <span data-testid="confirm-result">{status}</span>
    </>
  );
}
