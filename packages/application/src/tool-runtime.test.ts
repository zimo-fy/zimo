import type { ToolAuditRecord } from "@zimo/domain";
import { describe, expect, it } from "vitest";

import {
  ControlledToolService,
  createBuiltinReadOnlyTools,
  createGithubMcpReadOnlyTools,
  type KnowledgeService,
  type RegisteredTool,
} from "./index";

const context = {
  runId: "00000000-0000-4000-8000-000000000911",
  workflowId: "00000000-0000-4000-8000-000000000912",
  nodeId: "tool-node",
  toolCallId: "00000000-0000-4000-8000-000000000914",
};

describe("ControlledToolService", () => {
  it("allows larger browser snapshots without raising the limit for other tools", async () => {
    const output = { content: "a".repeat(150_000), truncated: false };
    const registeredTool = (id: string): RegisteredTool => ({
      definition: {
        id,
        title: id,
        description: id,
        source: "builtin",
        permissions: [],
        inputSchema: { type: "object", additionalProperties: false },
        annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
        confirmation: "per_run",
        timeoutMs: 1_000,
      },
      parse: (value) => value,
      execute: async () => output,
    });
    const service = new ControlledToolService(
      [
        registeredTool("zimo.browser.snapshot"),
        registeredTool("zimo.browser.wait"),
        registeredTool("test.other.read"),
      ],
      { record: async () => undefined },
      { now: () => new Date() },
    );
    const run = (toolId: string) =>
      service.execute(
        { toolId, input: {}, confirmedToolIds: [toolId], context },
        new AbortController().signal,
      );

    await expect(run("zimo.browser.snapshot")).resolves.toEqual(output);
    await expect(run("zimo.browser.wait")).resolves.toEqual(output);
    await expect(run("test.other.read")).rejects.toMatchObject({ code: "TOOL_OUTPUT_TOO_LARGE" });
  });

  it("does not execute a planned side effect before action authorization", async () => {
    let executions = 0;
    const tool: RegisteredTool = {
      definition: {
        id: "test.file.write",
        title: "模拟文件修改",
        description: "无副作用审批测试",
        source: "builtin",
        permissions: [],
        inputSchema: { type: "object", additionalProperties: false },
        annotations: { readOnly: false, destructive: false, idempotent: false, openWorld: false },
        confirmation: "per_run",
        timeoutMs: 1_000,
      },
      parse: (value) => value,
      planAction: () => ({
        kind: "file_write",
        risk: "medium",
        summary: "模拟修改",
        reversible: true,
        sandboxed: true,
      }),
      execute: async () => ({ executions: ++executions }),
    };
    const service = new ControlledToolService(
      [tool],
      { record: async () => undefined },
      { now: () => new Date() },
    );
    const request = {
      toolId: tool.definition.id,
      input: {},
      confirmedToolIds: [tool.definition.id],
      context,
    };

    await expect(
      service.execute(
        { ...request, authorizeAction: async () => ({ allowed: false }) },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ ok: false, errorCode: "ACTION_DENIED_BY_USER" });
    expect(executions).toBe(0);
    await expect(
      service.execute(
        { ...request, authorizeAction: async () => ({ allowed: true }) },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ executions: 1 });
  });

  it("fails closed before a side effect when the authoritative audit cannot start", async () => {
    let executions = 0;
    const tool: RegisteredTool = {
      definition: {
        id: "test.file.audit-failure",
        title: "审计失败模拟",
        description: "验证副作用执行前审计",
        source: "builtin",
        permissions: [],
        inputSchema: { type: "object", additionalProperties: false },
        annotations: { readOnly: false, destructive: false, idempotent: false, openWorld: false },
        confirmation: "per_run",
        timeoutMs: 1_000,
      },
      parse: (value) => value,
      planAction: () => ({
        kind: "file_write",
        risk: "low",
        summary: "测试",
        reversible: true,
        sandboxed: true,
      }),
      execute: async () => ({ executions: ++executions }),
    };
    const service = new ControlledToolService(
      [tool],
      {
        begin: async () => Promise.reject(new Error("audit unavailable")),
        record: async () => undefined,
      },
      { now: () => new Date() },
    );

    await expect(
      service.execute(
        {
          toolId: tool.definition.id,
          input: {},
          confirmedToolIds: [tool.definition.id],
          context,
          authorizeAction: async () => ({ allowed: true }),
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("audit unavailable");
    expect(executions).toBe(0);
  });

  it("registers and executes the built-in read-only knowledge tool after confirmation", async () => {
    const records: ToolAuditRecord[] = [];
    const knowledge = {
      search: async () => [
        {
          documentName: "退款.md",
          text: "七天内可退款",
          score: 1,
          matchType: "hybrid",
          metadata: { heading: "退款" },
        },
      ],
    } as unknown as KnowledgeService;
    const service = new ControlledToolService(
      createBuiltinReadOnlyTools(knowledge),
      { record: async (value) => void records.push(value) },
      { now: () => new Date() },
    );

    expect(service.list()[0]).toMatchObject({
      id: "zimo.knowledge.search",
      source: "builtin",
      annotations: { readOnly: true, destructive: false, openWorld: false },
      confirmation: "per_run",
    });
    const output = await service.execute(
      {
        toolId: "zimo.knowledge.search",
        input: {
          knowledgeBaseId: "00000000-0000-4000-8000-000000000913",
          query: "退款政策",
          limit: 3,
        },
        confirmedToolIds: ["zimo.knowledge.search"],
        context,
      },
      new AbortController().signal,
    );

    expect(output).toMatchObject({ matches: [{ documentName: "退款.md" }] });
    expect(records[0]).toMatchObject({
      toolId: "zimo.knowledge.search",
      toolCallId: "00000000-0000-4000-8000-000000000914",
      permissionIds: ["knowledge:read"],
      inputKeys: ["knowledgeBaseId", "limit", "query"],
      confirmed: true,
      outcome: "success",
    });
    expect(JSON.stringify(records)).not.toContain("退款政策");
  });

  it("rejects missing confirmation and invalid parameters while auditing only keys", async () => {
    const records: ToolAuditRecord[] = [];
    const knowledge = { search: async () => [] } as unknown as KnowledgeService;
    const service = new ControlledToolService(
      createBuiltinReadOnlyTools(knowledge),
      { record: async (value) => void records.push(value) },
      { now: () => new Date() },
    );
    const input = {
      knowledgeBaseId: "00000000-0000-4000-8000-000000000913",
      query: "secret-query-marker",
    };

    await expect(
      service.execute(
        {
          toolId: "zimo.knowledge.search",
          input,
          confirmedToolIds: [],
          context,
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "TOOL_CONFIRMATION_REQUIRED" });
    await expect(
      service.execute(
        {
          toolId: "zimo.knowledge.search",
          input: { ...input, unexpected: true },
          confirmedToolIds: ["zimo.knowledge.search"],
          context,
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "TOOL_ARGUMENTS_INVALID" });
    expect(records.map((record) => record.errorCode)).toEqual([
      "TOOL_CONFIRMATION_REQUIRED",
      "TOOL_ARGUMENTS_INVALID",
    ]);
    expect(JSON.stringify(records)).not.toContain("secret-query-marker");
  });

  it("registers GitHub repository search as an open-world per-run capability", async () => {
    const searchRepositories = async () => ({ repositories: [{ name: "zimo" }] });
    const service = new ControlledToolService(
      createGithubMcpReadOnlyTools({ searchRepositories }),
      { record: async () => undefined },
      { now: () => new Date() },
    );

    expect(service.list()[0]).toMatchObject({
      id: "mcp.github.search_repositories",
      source: "mcp",
      annotations: { readOnly: true, destructive: false, openWorld: true },
      confirmation: "per_run",
    });
    await expect(
      service.execute(
        {
          toolId: "mcp.github.search_repositories",
          input: { query: "topic:electron", limit: 3 },
          confirmedToolIds: ["mcp.github.search_repositories"],
          context,
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ repositories: [{ name: "zimo" }] });
  });

  it("requests cancellation and records a timeout terminal state", async () => {
    const records: ToolAuditRecord[] = [];
    const slowTool: RegisteredTool = {
      definition: {
        id: "test.slow.read",
        title: "慢速只读工具",
        description: "测试超时",
        source: "builtin",
        permissions: [],
        inputSchema: { type: "object", additionalProperties: false },
        annotations: {
          readOnly: true,
          destructive: false,
          idempotent: true,
          openWorld: false,
        },
        confirmation: "per_run",
        timeoutMs: 10,
      },
      parse: (value) => value,
      execute: (_value, run) =>
        new Promise((_resolve, reject) => {
          run.signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    };
    const service = new ControlledToolService(
      [slowTool],
      { record: async (value) => void records.push(value) },
      { now: () => new Date() },
    );

    await expect(
      service.execute(
        {
          toolId: slowTool.definition.id,
          input: {},
          confirmedToolIds: [slowTool.definition.id],
          context,
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "TOOL_TIMEOUT" });
    expect(records[0]).toMatchObject({ outcome: "timed_out", errorCode: "TOOL_TIMEOUT" });
  });

  it("reports running then completed assistant steps without tool output", async () => {
    const steps: { title: string; status: string }[] = [];
    const tool: RegisteredTool = {
      definition: {
        id: "zimo.workspace.read",
        title: "读取工作目录文件",
        description: "测试步骤",
        source: "builtin",
        permissions: [],
        inputSchema: { type: "object", additionalProperties: false },
        annotations: {
          readOnly: true,
          destructive: false,
          idempotent: true,
          openWorld: false,
        },
        confirmation: "per_run",
        timeoutMs: 1_000,
      },
      parse: (value) => value,
      execute: async () => ({ text: "secret-file-body" }),
    };
    const service = new ControlledToolService(
      [tool],
      { record: async () => undefined },
      { now: () => new Date() },
    );
    await service.execute(
      {
        toolId: tool.definition.id,
        input: { path: "notes.md" },
        confirmedToolIds: [tool.definition.id],
        context,
        onStep: (step) => {
          steps.push({ title: step.title, status: step.status });
        },
      },
      new AbortController().signal,
    );
    expect(steps).toEqual([
      { title: "读取 notes.md", status: "running" },
      { title: "读取 notes.md", status: "completed" },
    ]);
    expect(JSON.stringify(steps)).not.toContain("secret-file-body");
  });
});
