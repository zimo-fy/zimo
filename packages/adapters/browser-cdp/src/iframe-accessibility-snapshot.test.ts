import { describe, expect, it, vi } from "vitest";

import { readBrowserAccessibilitySnapshot } from "./iframe-accessibility-snapshot";

const activeSignal = new AbortController().signal;

describe("readBrowserAccessibilitySnapshot", () => {
  it("marks an existing generic ref as an editable textbox without duplicating it", async () => {
    const send = vi.fn(async (method: string) => {
      if (method === "Page.getFrameTree") return { frameTree: { frame: { id: "main" } } };
      if (method === "Accessibility.getFullAXTree") {
        return { nodes: [{ backendDOMNodeId: 70, role: { value: "generic" } }] };
      }
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
      if (method === "DOM.describeNode") return { node: { backendNodeId: 70 } };
      return {};
    });

    const result = await readBrowserAccessibilitySnapshot(send, activeSignal);

    expect(result.content).toBe("[ref_1] textbox");
    expect(result.elements.size).toBe(1);
    expect(result.elements.get("ref_1")?.backendNodeId).toBe(70);
  });

  it("marks an indented editable ref without removing its tree position", async () => {
    const send = vi.fn(async (method: string) => {
      if (method === "Page.getFrameTree") return { frameTree: { frame: { id: "main" } } };
      if (method === "Accessibility.getFullAXTree") {
        return {
          nodes: [
            { nodeId: "root", childIds: ["editor"], role: { value: "RootWebArea" } },
            { nodeId: "editor", backendDOMNodeId: 70, role: { value: "generic" } },
          ],
        };
      }
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
      if (method === "DOM.describeNode") return { node: { backendNodeId: 70 } };
      return {};
    });

    const result = await readBrowserAccessibilitySnapshot(send, activeSignal);

    expect(result.content).toContain("\n  [ref_1] textbox");
    expect(result.content).not.toContain("[ref_1] generic");
    expect(result.elements.size).toBe(1);
  });

  it("merges nested iframe AX trees using distinct actionable refs", async () => {
    const send = vi.fn(async (method: string, params: Readonly<Record<string, unknown>>) => {
      if (method === "Page.getFrameTree") {
        return {
          frameTree: {
            childFrames: [
              {
                frame: { id: "frame-a" },
                childFrames: [{ frame: { id: "frame-b" } }],
              },
            ],
          },
        };
      }
      if (method === "Accessibility.getFullAXTree") {
        const frameId = params.frameId;
        const backendDOMNodeId = frameId === "frame-a" ? 20 : frameId === "frame-b" ? 30 : 10;
        return {
          nodes: [
            {
              backendDOMNodeId,
              role: { value: "button" },
              name: { value: `action-${backendDOMNodeId}` },
            },
          ],
        };
      }
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [] };
      return {};
    });

    const result = await readBrowserAccessibilitySnapshot(send, activeSignal);

    expect(result.content).toContain('[ref_1] button "action-10"');
    expect(result.content).toContain('[iframe_1_ref_1] button "action-20"');
    expect(result.content).toContain('[iframe_2_ref_1] button "action-30"');
    expect(result.elements.get("iframe_2_ref_1")).toEqual({
      backendNodeId: 30,
      isProtected: false,
    });
    expect(send).toHaveBeenCalledWith("Accessibility.getFullAXTree", { frameId: "frame-b" });
  });

  it("marks inaccessible frames without inventing actionable refs", async () => {
    const send = vi.fn(async (method: string, params: Readonly<Record<string, unknown>>) => {
      if (method === "Page.getFrameTree") {
        return { frameTree: { childFrames: [{ frame: { id: "missing-frame" } }] } };
      }
      if (method === "Accessibility.getFullAXTree") {
        if (params.frameId) throw new Error("Frame not found");
        return { nodes: [{ backendDOMNodeId: 10, role: { value: "button" } }] };
      }
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [] };
      return {};
    });

    const result = await readBrowserAccessibilitySnapshot(send, activeSignal);

    expect(result.truncated).toBe(true);
    expect(result.content).toContain("[iframe 1] 内容暂不可读取");
    expect(result.elements.has("iframe_1_ref_1")).toBe(false);
  });

  it("propagates cancellation during iframe traversal", async () => {
    const controller = new AbortController();
    const send = vi.fn(async (method: string, params: Readonly<Record<string, unknown>>) => {
      if (method === "Page.getFrameTree") {
        return { frameTree: { childFrames: [{ frame: { id: "frame-a" } }] } };
      }
      if (method === "Accessibility.getFullAXTree") {
        if (params.frameId) {
          controller.abort();
          throw new Error("Aborted");
        }
        return { nodes: [] };
      }
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [] };
      return {};
    });

    await expect(readBrowserAccessibilitySnapshot(send, controller.signal)).rejects.toThrow(
      "Aborted",
    );
  });
});
