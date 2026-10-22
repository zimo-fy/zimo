import type { BrowserAutomationGateway } from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import { BROWSER_TOOL_IDS } from "./browser-tool-ids";
import { BrowserRunLease } from "./browser-run-lease";
import { createBrowserTools } from "./browser-tools";

describe("browser tools", () => {
  it("registers the bounded browser toolset without action approval planners", () => {
    const tools = createBrowserTools(fakeBrowser());
    expect(tools.map((tool) => tool.definition.id)).toEqual(Object.values(BROWSER_TOOL_IDS));
    expect(tools.every((tool) => tool.planAction === undefined)).toBe(true);
    expect(
      tools.every(
        (tool) =>
          tool.definition.inputSchema.type === "object" &&
          tool.definition.inputSchema.additionalProperties === false &&
          typeof tool.definition.inputSchema.properties === "object",
      ),
    ).toBe(true);
    expect(
      tools.find((tool) => tool.definition.id === BROWSER_TOOL_IDS.click)?.definition,
    ).toMatchObject({
      permissions: [{ id: "browser:interact", risk: "high" }],
      confirmation: "per_run",
    });
  });

  it("rejects unknown and incomplete interaction arguments", () => {
    const click = createBrowserTools(fakeBrowser()).find(
      (tool) => tool.definition.id === BROWSER_TOOL_IDS.click,
    )!;
    expect(() => click.parse({ targetId: "target", snapshotId: "snapshot" })).toThrow();
    expect(() =>
      click.parse({ targetId: "target", snapshotId: "snapshot", ref: "ref_1", selector: "a" }),
    ).toThrow();
  });

  it("opens a new tab with a strict URL argument and returns its real target", async () => {
    const browser = fakeBrowser();
    const open = createBrowserTools(browser).find(
      (tool) => tool.definition.id === BROWSER_TOOL_IDS.open,
    )!;
    expect(() => open.parse({})).toThrow();
    expect(() => open.parse({ url: "https://example.com", targetId: "invented" })).toThrow();
    const signal = new AbortController().signal;
    const result = await open.execute(open.parse({ url: " https://example.com/ " }), {
      runId: "run",
      workflowId: "conversation",
      nodeId: "conversation-agent",
      toolCallId: "open-call",
      signal,
    });
    expect(browser.open).toHaveBeenCalledWith("https://example.com/", signal);
    expect(result).toMatchObject({ id: "new-target", url: "https://example.com/" });
  });

  it("passes typed input directly to the browser gateway", async () => {
    const browser = fakeBrowser();
    const click = createBrowserTools(browser).find(
      (tool) => tool.definition.id === BROWSER_TOOL_IDS.click,
    )!;
    const input = click.parse({ targetId: " target ", snapshotId: " snapshot ", ref: " ref_1 " });
    await click.execute(input, {
      runId: "run",
      workflowId: "conversation",
      nodeId: "conversation-agent",
      toolCallId: "call",
      signal: new AbortController().signal,
    });
    expect(browser.click).toHaveBeenCalledWith(
      "target",
      "snapshot",
      "ref_1",
      expect.any(AbortSignal),
    );
  });

  it("stores workflow screenshots in the originating conversation workspace", async () => {
    const browser = fakeBrowser();
    const screenshot = createBrowserTools(browser).find(
      (tool) => tool.definition.id === BROWSER_TOOL_IDS.screenshot,
    )!;
    await screenshot.execute(
      { targetId: "target" },
      {
        runId: "run",
        workflowId: "workflow-definition",
        artifactConversationId: "conversation",
        nodeId: "agent",
        toolCallId: "call",
        signal: new AbortController().signal,
      },
    );
    expect(browser.screenshot).toHaveBeenCalledWith(
      "conversation",
      "target",
      expect.any(AbortSignal),
    );
  });

  it("rejects a second model run while the shared Profile is in use", async () => {
    const lease = new BrowserRunLease();
    const tabs = createBrowserTools(fakeBrowser(), lease).find(
      (tool) => tool.definition.id === BROWSER_TOOL_IDS.tabs,
    )!;
    const context = {
      runId: "first",
      workflowId: "conversation",
      nodeId: "agent",
      toolCallId: "call",
      signal: new AbortController().signal,
    };
    await tabs.execute({}, context);
    await expect(tabs.execute({}, { ...context, runId: "second" })).rejects.toMatchObject({
      code: "BROWSER_RUN_BUSY",
    });
    lease.release("first");
    await expect(tabs.execute({}, { ...context, runId: "second" })).resolves.toEqual([]);
  });

  it("validates bounded press, scroll and wait inputs", async () => {
    const browser = fakeBrowser();
    const tools = createBrowserTools(browser);
    const press = tools.find((tool) => tool.definition.id === BROWSER_TOOL_IDS.press)!;
    const scroll = tools.find((tool) => tool.definition.id === BROWSER_TOOL_IDS.scroll)!;
    const wait = tools.find((tool) => tool.definition.id === BROWSER_TOOL_IDS.wait)!;

    expect(() =>
      press.parse({ targetId: "target", snapshotId: "snapshot", ref: "ref_1", key: "F12" }),
    ).toThrow();
    expect(() => press.parse({ targetId: "target", key: "Enter" })).toThrow();
    const escapeInput = press.parse({ targetId: " target ", key: "Escape" });
    await press.execute(escapeInput, {
      runId: "run",
      workflowId: "conversation",
      nodeId: "conversation-agent",
      toolCallId: "call-escape",
      signal: new AbortController().signal,
    });
    expect(browser.press).toHaveBeenCalledWith(
      "target",
      undefined,
      undefined,
      "Escape",
      expect.any(AbortSignal),
    );
    expect(
      press.parse({ targetId: "target", snapshotId: "snapshot", ref: "ref_1", key: "Escape" }),
    ).toMatchObject({ key: "Escape", ref: "ref_1" });
    expect(() =>
      scroll.parse({ targetId: "target", snapshotId: "snapshot", deltaY: 1001 }),
    ).toThrow();
    expect(() => wait.parse({ targetId: "target", timeoutMs: 5001 })).toThrow();

    const waitInput = wait.parse({ targetId: " target ", timeoutMs: 2_000 });
    await wait.execute(waitInput, {
      runId: "run",
      workflowId: "conversation",
      nodeId: "conversation-agent",
      toolCallId: "call-wait",
      signal: new AbortController().signal,
    });
    expect(browser.wait).toHaveBeenCalledWith("target", 2_000, expect.any(AbortSignal));
  });
});

function fakeBrowser(): BrowserAutomationGateway {
  return {
    listTabs: vi.fn(async () => []),
    open: vi.fn(async (url: string) => ({ id: "new-target", title: "", url, active: true })),
    focus: vi.fn(async () => undefined),
    snapshot: vi.fn(async () => ({
      targetId: "target",
      snapshotId: "snapshot",
      title: "Page",
      url: "https://example.com/",
      content: "",
      elementCount: 0,
      truncated: false,
    })),
    screenshot: vi.fn(async () => ({
      targetId: "target",
      fileName: "capture.png",
      mediaType: "image/png" as const,
    })),
    navigate: vi.fn(async () => undefined),
    click: vi.fn(async () => undefined),
    type: vi.fn(async () => undefined),
    press: vi.fn(async () => undefined),
    scroll: vi.fn(async () => undefined),
    wait: vi.fn(async () => ({
      targetId: "target",
      snapshotId: "snapshot-after-wait",
      title: "Page",
      url: "https://example.com/",
      content: "",
      elementCount: 0,
      truncated: false,
    })),
    close: vi.fn(async () => undefined),
  };
}
