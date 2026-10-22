import { describe, expect, it } from "vitest";

import { describeAssistantStep, displayTarget } from "./assistant-step-labels";

describe("displayTarget", () => {
  it("keeps relative paths and strips drive-letter absolute paths to the last segment", () => {
    expect(displayTarget("notes.md")).toBe("notes.md");
    expect(displayTarget("docs/notes.md")).toBe("docs/notes.md");
    expect(displayTarget("C:\\Users\\demo\\log.txt")).toBe("log.txt");
    expect(displayTarget("/tmp/secret.env")).toBe("secret.env");
    expect(displayTarget("00000000-0000-4000-8000-000000000001")).toBeUndefined();
  });
});

describe("describeAssistantStep", () => {
  it("uses a workspace read path for running and completed titles", () => {
    const running = describeAssistantStep({
      id: "call-1",
      toolId: "zimo.workspace.read",
      toolTitle: "读取工作目录文件",
      parsedInput: { path: "notes.md" },
      status: "running",
    });
    expect(running).toMatchObject({
      kind: "file_read",
      title: "读取 notes.md",
      resultTitle: "已读取 notes.md",
      relativeTarget: "notes.md",
      status: "running",
    });
  });

  it("prefers PlannedAction summary and never copies a command string", () => {
    const step = describeAssistantStep({
      id: "call-2",
      toolId: "zimo.workspace.patch",
      toolTitle: "修改工作目录文件",
      parsedInput: { path: "notes.md", command: "rm -rf /" },
      plannedAction: {
        kind: "file_write",
        risk: "medium",
        summary: "修改 Workspace/notes.md",
        relativeTarget: "notes.md",
        reversible: true,
        sandboxed: true,
      },
      status: "completed",
    });
    expect(step.title).toBe("修改 Workspace/notes.md");
    expect(step.resultTitle).toBe("已修改 Workspace/notes.md");
    expect(JSON.stringify(step)).not.toContain("rm -rf");
  });

  it("falls back to the tool title for MCP tools without a planned action", () => {
    expect(
      describeAssistantStep({
        id: "call-3",
        toolId: "mcp.github.search_repositories",
        toolTitle: "搜索 GitHub 仓库",
        parsedInput: { query: "secret-query" },
        status: "running",
      }),
    ).toMatchObject({
      kind: "tool",
      title: "搜索 GitHub 仓库",
      resultTitle: "已完成",
    });
  });
});
