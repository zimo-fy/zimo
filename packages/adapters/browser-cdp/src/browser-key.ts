import type { BrowserKey } from "@zimo/domain";

const DEFINITIONS: Record<BrowserKey, Readonly<Record<string, unknown>>> = {
  Enter: {
    key: "Enter",
    code: "Enter",
    text: "\r",
    unmodifiedText: "\r",
    windowsVirtualKeyCode: 13,
  },
  Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
  Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 },
  Space: { key: " ", code: "Space", text: " ", windowsVirtualKeyCode: 32 },
};

export function browserKeyDefinition(key: BrowserKey): Readonly<Record<string, unknown>> {
  return DEFINITIONS[key];
}

export async function dispatchBrowserKey(
  send: (method: string, params: Readonly<Record<string, unknown>>) => Promise<unknown>,
  key: BrowserKey,
  backendNodeId?: number,
): Promise<void> {
  if (key !== "Escape") {
    if (backendNodeId === undefined) throw new Error("Focused browser key requires an element");
    await send("DOM.enable", {});
    await send("DOM.focus", { backendNodeId });
  }
  const definition = browserKeyDefinition(key);
  await send("Input.dispatchKeyEvent", {
    type: key === "Escape" ? "rawKeyDown" : "keyDown",
    ...definition,
  });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...definition });
}
