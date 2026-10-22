import { describe, expect, it } from "vitest";

import { MAX_SNAPSHOT_CHARACTERS, parseAccessibilitySnapshot } from "./accessibility-snapshot";

describe("parseAccessibilitySnapshot", () => {
  it("creates opaque refs and removes protected values", () => {
    const result = parseAccessibilitySnapshot({
      nodes: [
        {
          backendDOMNodeId: 12,
          role: { value: "textbox" },
          name: { value: "密码" },
          value: { value: "secret" },
          properties: [{ name: "protected", value: { value: true } }],
        },
      ],
    });
    expect(result.content).toContain('[ref_1] textbox "密码"');
    expect(result.content).not.toContain("secret");
    expect(result.elements.get("ref_1")).toEqual({ backendNodeId: 12, isProtected: true });
  });

  it("bounds the number of returned nodes", () => {
    const result = parseAccessibilitySnapshot({
      nodes: Array.from({ length: 2_010 }, (_, index) => ({
        backendDOMNodeId: index + 1,
        role: { value: "a" },
      })),
    });
    expect(result.elementCount).toBe(2_000);
    expect(result.nodeCount).toBe(2_000);
    expect(result.truncated).toBe(true);
  });

  it("does not expose refs omitted by the character limit", () => {
    const result = parseAccessibilitySnapshot(
      { nodes: [{ backendDOMNodeId: 11, role: { value: "button" } }] },
      { maxCharacters: 5 },
    );
    expect(result.elements.size).toBe(0);
    expect(result.truncated).toBe(true);
  });

  it("allows a large snapshot up to 150000 characters while retaining the bound", () => {
    const nodes = Array.from({ length: 400 }, (_, index) => ({
      backendDOMNodeId: index + 1,
      role: { value: "listitem" },
      name: { value: "candidate".repeat(45) },
    }));
    const withinLimit = parseAccessibilitySnapshot({ nodes: nodes.slice(0, 200) });
    const beyondLimit = parseAccessibilitySnapshot({ nodes });

    expect(MAX_SNAPSHOT_CHARACTERS).toBe(150_000);
    expect(withinLimit.content.length).toBeGreaterThan(30_000);
    expect(withinLimit.truncated).toBe(false);
    expect(beyondLimit.content.length).toBeLessThanOrEqual(MAX_SNAPSHOT_CHARACTERS);
    expect(beyondLimit.truncated).toBe(true);
  });

  it("removes duplicate text fragments before applying the snapshot budget", () => {
    const result = parseAccessibilitySnapshot(
      {
        nodes: [
          {
            nodeId: "button",
            childIds: ["text"],
            backendDOMNodeId: 1,
            role: { value: "button" },
            name: { value: "打招呼" },
          },
          {
            nodeId: "text",
            childIds: ["fragment"],
            role: { value: "StaticText" },
            name: { value: "打招呼" },
          },
          { nodeId: "fragment", role: { value: "InlineTextBox" }, name: { value: "打招呼" } },
          {
            nodeId: "candidate",
            backendDOMNodeId: 2,
            role: { value: "StaticText" },
            name: { value: "候选人有 Cocos Creator 经验" },
          },
          { nodeId: "separator", role: { value: "StaticText" }, name: { value: "·" } },
        ],
      },
      { maxNodes: 2 },
    );
    expect(result.content).toContain('button "打招呼"');
    expect(result.content).toContain('StaticText "候选人有 Cocos Creator 经验"');
    expect(result.content).not.toContain("InlineTextBox");
    expect(result.content).not.toContain('StaticText "打招呼"');
    expect(result.truncated).toBe(false);
  });

  it("keeps unnamed containers and unique text needed for interaction", () => {
    const result = parseAccessibilitySnapshot({
      nodes: [
        {
          nodeId: "container",
          childIds: ["text"],
          backendDOMNodeId: 11,
          role: { value: "generic" },
        },
        { nodeId: "text", role: { value: "StaticText" }, name: { value: "Cocos Creator" } },
      ],
    });
    expect(result.content).toContain("[ref_1] generic");
    expect(result.content).toContain('StaticText "Cocos Creator"');
    expect(result.elements.get("ref_1")?.backendNodeId).toBe(11);
  });

  it("groups conversation details under their clickable list item", () => {
    const result = parseAccessibilitySnapshot({
      nodes: [
        {
          nodeId: "root",
          childIds: ["list"],
          role: { value: "RootWebArea" },
        },
        {
          nodeId: "list",
          childIds: ["candidate-a", "candidate-b"],
          role: { value: "list" },
        },
        {
          nodeId: "candidate-a",
          childIds: ["name-a", "job-a", "preview-a"],
          backendDOMNodeId: 11,
          role: { value: "listitem" },
        },
        {
          nodeId: "candidate-b",
          childIds: ["name-b", "job-b"],
          backendDOMNodeId: 12,
          role: { value: "listitem" },
        },
        { nodeId: "name-a", role: { value: "StaticText" }, name: { value: "候选人甲" } },
        { nodeId: "job-a", role: { value: "StaticText" }, name: { value: "策划" } },
        { nodeId: "preview-a", role: { value: "StaticText" }, name: { value: "想了解岗位" } },
        { nodeId: "name-b", role: { value: "StaticText" }, name: { value: "候选人乙" } },
        { nodeId: "job-b", role: { value: "StaticText" }, name: { value: "开发" } },
      ],
    });

    expect(result.content).toMatch(
      /\[ref_1\] listitem\n\s+StaticText "候选人甲"\n\s+StaticText "策划"\n\s+StaticText "想了解岗位"\n\s+\[ref_2\] listitem\n\s+StaticText "候选人乙"\n\s+StaticText "开发"/u,
    );
    expect(result.elements.get("ref_1")?.backendNodeId).toBe(11);
    expect(result.elements.get("ref_2")?.backendNodeId).toBe(12);
    expect(result.truncated).toBe(false);
  });

  it("keeps actionable descendants and detached nodes when a parent is ignored", () => {
    const result = parseAccessibilitySnapshot({
      nodes: [
        {
          nodeId: "ignored",
          ignored: true,
          childIds: ["action"],
          role: { value: "generic" },
        },
        {
          nodeId: "action",
          childIds: ["ignored"],
          backendDOMNodeId: 31,
          role: { value: "button" },
          name: { value: "打开会话" },
        },
        { backendDOMNodeId: 32, role: { value: "button" }, name: { value: "关闭弹窗" } },
      ],
    });

    expect(result.content).toContain('button "打开会话"');
    expect(result.content).toContain('button "关闭弹窗"');
    expect(result.elementCount).toBe(2);
    expect([...result.elements.values()].map((element) => element.backendNodeId).sort()).toEqual([
      31, 32,
    ]);
    expect(result.truncated).toBe(false);
  });
});
