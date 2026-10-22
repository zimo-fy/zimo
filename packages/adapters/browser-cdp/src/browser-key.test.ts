import { describe, expect, it, vi } from "vitest";

import { dispatchBrowserKey } from "./browser-key";

describe("dispatchBrowserKey", () => {
  it("sends Escape to the page without focusing a RootWebArea", async () => {
    const send = vi.fn(async (_method: string, _params: Readonly<Record<string, unknown>>) => ({}));
    await dispatchBrowserKey(send, "Escape");
    expect(send.mock.calls.map(([method]) => method)).toEqual([
      "Input.dispatchKeyEvent",
      "Input.dispatchKeyEvent",
    ]);
    expect(send).toHaveBeenNthCalledWith(
      1,
      "Input.dispatchKeyEvent",
      expect.objectContaining({ type: "rawKeyDown", key: "Escape", windowsVirtualKeyCode: 27 }),
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      "Input.dispatchKeyEvent",
      expect.objectContaining({ type: "keyUp", key: "Escape" }),
    );
  });

  it("still focuses an element for Enter and stops when focus fails", async () => {
    const send = vi.fn(async (method: string) => {
      if (method === "DOM.focus") throw new Error("not focusable");
      return {};
    });
    await expect(dispatchBrowserKey(send, "Enter", 42)).rejects.toThrow("not focusable");
    expect(send.mock.calls.map(([method]) => method)).toEqual(["DOM.enable", "DOM.focus"]);
    await expect(dispatchBrowserKey(send, "Enter")).rejects.toThrow("requires an element");
  });
});
