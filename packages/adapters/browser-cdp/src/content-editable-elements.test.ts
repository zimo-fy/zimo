import { describe, expect, it, vi } from "vitest";

import { discoverContentEditableElements } from "./content-editable-elements";

describe("discoverContentEditableElements", () => {
  it("adds fixed contenteditable nodes without accepting a model selector", async () => {
    const send = vi.fn(async (method: string) => {
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
      return { node: { backendNodeId: 70 } };
    });

    const result = await discoverContentEditableElements(send, new Map());

    expect(result.lines).toEqual(['[ref_1] textbox "可编辑文本区域"']);
    expect(result.elements.get("ref_1")).toEqual({ backendNodeId: 70, isProtected: false });
    expect(send).toHaveBeenCalledWith("DOM.querySelectorAll", {
      nodeId: 1,
      selector: '[contenteditable="true"]',
    });
  });

  it("respects the remaining snapshot node budget", async () => {
    const send = vi.fn(async (method: string) => {
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [7, 8] };
      return { node: { backendNodeId: 70 } };
    });

    const result = await discoverContentEditableElements(send, new Map(), 0);

    expect(result.elements.size).toBe(0);
    expect(result.lines).toEqual([]);
  });

  it("returns the existing ref for a contenteditable generic node", async () => {
    const send = vi.fn(async (method: string) => {
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
      return { node: { backendNodeId: 70 } };
    });

    const result = await discoverContentEditableElements(
      send,
      new Map([["ref_1", { backendNodeId: 70, isProtected: false }]]),
      0,
    );

    expect(result.existingEditableRefs).toEqual(new Set(["ref_1"]));
    expect(result.lines).toEqual([]);
  });
});
