import { describe, expect, it, vi } from "vitest";

import type { WorkspaceService } from "./workspace-service";
import { createWorkspaceCommandTool } from "./workspace-command-tool";
import { createWorkspaceReadOnlyTools, createWorkspaceTools } from "./workspace-tools";

describe("workspace tools", () => {
  it("publishes exactly three read-only product tools", () => {
    const tools = createWorkspaceReadOnlyTools({} as WorkspaceService);
    expect(tools.map((tool) => tool.definition.id)).toEqual([
      "zimo.workspace.list",
      "zimo.workspace.search",
      "zimo.workspace.read",
    ]);
    expect(tools.every((tool) => tool.definition.annotations.readOnly)).toBe(true);
    expect(tools.every((tool) => !tool.definition.annotations.destructive)).toBe(true);
  });

  it("publishes file and directory mutation tools with trusted action plans", async () => {
    const service = {
      hasCommandExecution: () => false,
      planWorkspaceMutation: async (
        _conversationId: string,
        workspaceId: string,
        path: string,
        input: { kind: "file_write" | "file_delete"; risk: string; verb: string },
      ) => ({
        kind: input.kind,
        risk: input.risk,
        summary: `${input.verb} project/${path}`,
        workspaceId,
        workspaceLabel: "project",
        relativeTarget: path,
        reversible: true,
        sandboxed: false,
      }),
    } as unknown as WorkspaceService;
    const tools = createWorkspaceTools(service);
    expect(tools.map((tool) => tool.definition.id)).toEqual([
      "zimo.workspace.list",
      "zimo.workspace.search",
      "zimo.workspace.read",
      "zimo.workspace.create",
      "zimo.workspace.mkdir",
      "zimo.workspace.patch",
      "zimo.workspace.delete",
    ]);
    const mkdirTool = tools[4]!;
    const directory = mkdirTool.parse({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      path: "demo",
    });
    await expect(mkdirTool.planAction?.(directory, context)).resolves.toMatchObject({
      kind: "file_write",
      summary: "创建目录 project/demo",
    });
    expect(() => mkdirTool.parse({ ...directory, content: "forbidden" })).toThrow();
    const patch = tools[5]!;
    const input = patch.parse({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      path: "src/app.ts",
      expectedChecksum: "a".repeat(64),
      operations: [{ search: "old", replacement: "new" }],
    });
    await expect(patch.planAction?.(input, context)).resolves.toMatchObject({
      kind: "file_write",
      risk: "low",
      summary: "修改 project/src/app.ts",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      workspaceLabel: "project",
      relativeTarget: "src/app.ts",
      reversible: true,
      sandboxed: false,
    });
    expect(() =>
      patch.parse({
        ...input,
        operations: [{ search: "old", replacement: "new", command: "rm" }],
      }),
    ).toThrow();
    await expect(
      tools[6]?.planAction?.(
        tools[6].parse({
          workspaceId: "00000000-0000-4000-8000-000000000001",
          path: "src/app.ts",
          expectedChecksum: "a".repeat(64),
        }),
        context,
      ),
    ).resolves.toMatchObject({ kind: "file_delete", risk: "high" });
    await expect(
      tools[3]?.planAction?.(
        tools[3].parse({
          workspaceId: "00000000-0000-4000-8000-000000000001",
          path: "pnpm-lock.yaml",
          content: "lockfileVersion: '9.0'\n",
        }),
        context,
      ),
    ).resolves.toMatchObject({ risk: "high", summary: "创建 project/pnpm-lock.yaml" });
  });

  it("publishes one host command tool with a mandatory high-risk action plan", async () => {
    const planCommand = vi.fn(async () => ({
      kind: "command" as const,
      risk: "high" as const,
      summary: "在 project 运行终端命令",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      workspaceLabel: "project",
      relativeTarget: ".",
      command: "pnpm test",
      reversible: false,
      sandboxed: false,
    }));
    const runCommand = vi.fn(async () => ({
      cwd: ".",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      timedOut: false,
      truncated: false,
      durationMs: 1,
    }));
    const command = createWorkspaceCommandTool({
      planCommand,
      runCommand,
    } as unknown as WorkspaceService);
    const input = command.parse({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      command: "pnpm test",
    });

    await expect(command.planAction?.(input, context)).resolves.toMatchObject({
      kind: "command",
      risk: "high",
      sandboxed: false,
    });
    await command.execute(input, { ...context, signal: new AbortController().signal });
    expect(runCommand).toHaveBeenCalledWith(
      context.workflowId,
      "00000000-0000-4000-8000-000000000001",
      { command: "pnpm test", cwd: "", timeoutMs: 120_000 },
      expect.any(AbortSignal),
    );
    expect(command.definition.annotations.openWorld).toBe(true);
    expect(() => command.parse({ ...input, extra: true })).toThrow();
  });

  it("validates input and scopes execution to the current conversation", async () => {
    const listEntries = vi.fn(async () => ({ path: "", entries: [] }));
    const service = { listEntries } as unknown as WorkspaceService;
    const list = createWorkspaceReadOnlyTools(service)[0]!;
    const input = list.parse({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      path: "src",
      limit: 20,
    });
    await list.execute(input, {
      runId: "run",
      workflowId: "00000000-0000-4000-8000-000000000002",
      nodeId: "conversation-agent",
      toolCallId: "tool-call",
      signal: new AbortController().signal,
    });

    expect(listEntries).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
      { path: "src", cursor: 0, limit: 20 },
      expect.any(AbortSignal),
    );
    expect(() => list.parse({ ...input, absolutePath: "/private/project" })).toThrow();
  });
});

const context = {
  runId: "run",
  workflowId: "00000000-0000-4000-8000-000000000002",
  nodeId: "conversation-agent",
  toolCallId: "tool-call",
};
