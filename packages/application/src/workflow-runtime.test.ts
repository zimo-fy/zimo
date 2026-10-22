import type {
  Clock,
  IdGenerator,
  ModelGateway,
  ModelId,
  ModelRepository,
  PrototypeDefinition,
  PrototypeId,
  SecretStore,
  WorkflowRepository,
} from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import {
  ControlledToolService,
  createGithubMcpReadOnlyTools,
  WorkflowRuntimeService,
  type SkillRuntimeService,
  type RegisteredTool,
  type WorkflowStreamSink,
} from "./index";
import type { KnowledgeService, PrototypeCatalogService } from "./index";
import type {
  WorkflowModelPayload,
  WorkflowModelRequestDiagnostic,
} from "./workflow-model-request";

const workflowId = "00000000-0000-4000-8000-000000000901" as PrototypeId;
const agentId = "00000000-0000-4000-8000-000000000902" as PrototypeId;
const knowledgeId = "00000000-0000-4000-8000-000000000903" as PrototypeId;
const modelId = "00000000-0000-4000-8000-000000000904" as ModelId;

describe("WorkflowRuntimeService", () => {
  it("exposes the built-in browser to a standalone Workflow Agent node", async () => {
    const workflow = definition([
      { id: "start", type: "start", label: "开始", position: { x: 0, y: 0 } },
      {
        id: "agent",
        type: "agent",
        label: "回答",
        position: { x: 100, y: 0 },
        config: { agentId },
      },
      { id: "end", type: "end", label: "结束", position: { x: 200, y: 0 } },
    ]);
    workflow.workflowEdges = [
      { id: "e1", source: "start", target: "agent" },
      { id: "e2", source: "agent", target: "end" },
    ];
    const gateway: ModelGateway = {
      testConnection: async () => undefined,
      async *stream() {
        yield { type: "completed" as const };
      },
      streamWithTools: vi.fn(async function* () {
        yield { type: "text" as const, text: "已完成" };
        yield { type: "tool_calls" as const, toolCalls: [] };
        yield { type: "completed" as const };
      }),
    };
    const browserTool: RegisteredTool = {
      definition: {
        id: "zimo.browser.tabs",
        title: "获取浏览器标签页",
        description: "列出标签页",
        source: "builtin",
        permissions: [],
        inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
        annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: true },
        confirmation: "per_run",
        timeoutMs: 30_000,
      },
      parse: (value) => value,
      execute: async () => [],
    };
    const events = await collectRun(
      runtime(workflow, undefined, [browserTool], {
        gateway,
        toolCalling: true,
      }),
      "列出标签页",
    );
    expect(events.at(-1)).toMatchObject({ type: "run.completed", output: "已完成" });
    expect(
      vi.mocked(gateway.streamWithTools!).mock.calls[0]?.[2].map((tool) => tool.name),
    ).toContain("browser_tabs");
  });

  it("runs start, knowledge, agent and end nodes while emitting debug events", async () => {
    const workflow = definition([
      { id: "start", type: "start", label: "开始", position: { x: 0, y: 0 } },
      {
        id: "knowledge",
        type: "knowledge",
        label: "检索",
        position: { x: 100, y: 0 },
        config: { knowledgeBaseId: knowledgeId, topK: 3 },
      },
      {
        id: "agent",
        type: "agent",
        label: "回答",
        position: { x: 200, y: 0 },
        config: { agentId },
      },
      { id: "end", type: "end", label: "结束", position: { x: 300, y: 0 } },
    ]);
    workflow.workflowEdges = [
      { id: "e1", source: "start", target: "knowledge" },
      { id: "e2", source: "knowledge", target: "agent" },
      { id: "e3", source: "agent", target: "end" },
    ];
    const knowledgeCalls: unknown[][] = [];
    const service = runtime(workflow, {
      retrieveContext: async (...args: unknown[]) => {
        knowledgeCalls.push(args);
        return { context: "[资料1] 退款期为 7 天", citations: [] };
      },
    });

    const diagnostics: WorkflowModelRequestDiagnostic[] = [];
    const payloads: WorkflowModelPayload[] = [];
    const events = await collectRun(service, "退款期是多少？", {
      inspectModelRequest: (value) => diagnostics.push(value),
      captureModelPayload: (value) => payloads.push(value),
    });

    expect(knowledgeCalls[0]?.[2]).toEqual({ perKnowledgeBaseLimit: 3, maxHits: 3 });
    expect(diagnostics).toEqual([
      expect.objectContaining({
        workflowId,
        runId: "00000000-0000-4000-8000-000000000999",
        nodeId: "agent",
        agentId,
        knowledgeBaseIds: [knowledgeId],
        requestContentLogged: false,
      }),
    ]);
    expect(payloads).toEqual([
      expect.objectContaining({
        workflowId,
        nodeId: "agent",
        agentId,
        knowledgeBaseIds: [knowledgeId],
        request: expect.objectContaining({
          model: "test-model",
          messages: [
            expect.objectContaining({
              role: "system",
              content: expect.stringContaining("自然语言回复默认使用简体中文"),
            }),
            { role: "user", content: "退款期是多少？" },
          ],
        }),
      }),
    ]);
    expect(events.filter((event) => event.type === "node.started")).toHaveLength(4);
    expect(events.at(-1)).toMatchObject({ type: "run.completed", output: "退款期为 7 天。" });
  });

  it("rejects unsupported interactive nodes before accepting a run", async () => {
    const workflow = definition([
      { id: "start", type: "start", label: "开始", position: { x: 0, y: 0 } },
      { id: "approval", type: "approval", label: "人工确认", position: { x: 100, y: 0 } },
      { id: "end", type: "end", label: "结束", position: { x: 200, y: 0 } },
    ]);
    workflow.workflowEdges = [
      { id: "e1", source: "start", target: "approval" },
      { id: "e2", source: "approval", target: "end" },
    ];

    await expect(
      runtime(workflow).start(workflow.id, "继续", { emit: () => undefined }),
    ).rejects.toMatchObject({
      code: "WORKFLOW_NODE_NOT_EXECUTABLE",
    });
  });

  it("marks disconnected nodes as skipped and completes a passthrough flow", async () => {
    const workflow = definition([
      { id: "start", type: "start", label: "开始", position: { x: 0, y: 0 } },
      { id: "orphan", type: "skill", label: "未连接", position: { x: 100, y: 100 } },
      { id: "end", type: "end", label: "结束", position: { x: 200, y: 0 } },
    ]);
    workflow.workflowEdges = [{ id: "e1", source: "start", target: "end" }];

    const events = await collectRun(runtime(workflow), "原样输出");

    expect(events).toContainEqual({
      type: "node.skipped",
      nodeId: "orphan",
      reason: "未从开始节点连接到该节点。",
    });
    expect(events.at(-1)).toMatchObject({ type: "run.completed", output: "原样输出" });
  });

  it("runs the confirmed GitHub repository search tool and returns isolated output", async () => {
    const workflow = definition([
      { id: "start", type: "start", label: "开始", position: { x: 0, y: 0 } },
      {
        id: "github",
        type: "tool",
        label: "搜索 GitHub",
        position: { x: 100, y: 0 },
        config: { toolId: "mcp.github.search_repositories", topK: 3 },
      },
      { id: "end", type: "end", label: "结束", position: { x: 200, y: 0 } },
    ]);
    workflow.workflowEdges = [
      { id: "e1", source: "start", target: "github" },
      { id: "e2", source: "github", target: "end" },
    ];
    const calls: unknown[][] = [];
    const githubTools = createGithubMcpReadOnlyTools({
      searchRepositories: async (...args) => {
        calls.push(args);
        return { repositories: [{ name: "github-mcp-server" }] };
      },
    });

    const events = await collectRun(runtime(workflow, undefined, githubTools), "topic:mcp", {}, [
      "mcp.github.search_repositories",
    ]);

    expect(calls[0]?.slice(0, 2)).toEqual(["topic:mcp", 3]);
    expect(events.at(-1)).toMatchObject({
      type: "run.completed",
      output: expect.stringContaining("github-mcp-server"),
    });
  });
});

function runtime(
  workflow: PrototypeDefinition,
  knowledge:
    | {
        retrieveContext(...args: unknown[]): Promise<{ context: string; citations: [] }>;
      }
    | undefined = undefined,
  registeredTools: readonly RegisteredTool[] = [],
  options: { gateway?: ModelGateway; toolCalling?: boolean } = {},
) {
  const knowledgeService =
    knowledge ?? ({ retrieveContext: async () => ({ context: "", citations: [] }) } as const);
  const agent: PrototypeDefinition = {
    ...definition([]),
    id: agentId,
    kind: "agent",
    name: "客服 Agent",
    status: "enabled",
    modelId,
  };
  const models: ModelRepository = {
    listProviders: async () => [],
    getProvider: async () => null,
    getModel: async () => ({
      provider: {
        id: "00000000-0000-4000-8000-000000000905" as never,
        name: "测试",
        baseUrl: "https://example.com",
        secretRef: "secret",
        keyHint: "••••",
        kind: "openai-compatible",
        enabled: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      model: {
        id: modelId,
        providerId: "00000000-0000-4000-8000-000000000905" as never,
        name: "test-model",
        displayName: "Test Model",
        capabilities: {
          streaming: true,
          toolCalling: options.toolCalling ?? false,
          structuredOutput: false,
          vision: false,
          reasoning: false,
          promptCaching: false,
        },
        enabled: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    }),
    saveProvider: async () => undefined,
    deleteProvider: async () => undefined,
    hasProviderReferences: async () => false,
    getDefaultModelId: async () => modelId,
    setDefaultModelId: async () => undefined,
  };
  const gateway: ModelGateway = options.gateway ?? {
    testConnection: async () => undefined,
    async *stream() {
      yield { type: "text", text: "退款期为 7 天。" };
      yield { type: "completed" };
    },
  };
  const secrets: SecretStore = {
    getStatus: async () => ({ available: true, backend: "test", persistent: false }),
    set: async () => undefined,
    get: async () => "test-key",
    delete: async () => undefined,
  };
  const clock: Clock = { now: () => new Date() };
  const ids: IdGenerator = { create: () => "00000000-0000-4000-8000-000000000999" };
  const prototypes = {
    get: async (_kind: string, id: string) => (id === agentId ? agent : null),
    resolveAgentExecution: async () => ({ agent, skills: [], knowledgeBases: [] }),
  } as unknown as PrototypeCatalogService;
  const tools = new ControlledToolService(
    registeredTools,
    { record: async () => undefined },
    clock,
  );
  return new WorkflowRuntimeService(
    new MemoryWorkflowRepository(workflow),
    models,
    secrets,
    gateway,
    prototypes,
    knowledgeService as unknown as KnowledgeService,
    tools,
    { prepareTools: async () => [] } as unknown as SkillRuntimeService,
    clock,
    ids,
  );
}

async function collectRun(
  service: WorkflowRuntimeService,
  input: string,
  observer: Omit<WorkflowStreamSink, "emit"> = {},
  confirmedToolIds: readonly string[] = [],
) {
  return new Promise<Parameters<WorkflowStreamSink["emit"]>[0]["event"][]>((resolve, reject) => {
    const events: Parameters<WorkflowStreamSink["emit"]>[0]["event"][] = [];
    void service
      .start(
        workflowId,
        input,
        {
          ...observer,
          emit: (envelope) => {
            events.push(envelope.event);
            if (envelope.event.type === "run.completed" || envelope.event.type === "run.failed") {
              resolve(events);
            }
          },
        },
        confirmedToolIds,
      )
      .catch(reject);
  });
}

function definition(nodes: PrototypeDefinition["workflowNodes"]): PrototypeDefinition {
  return {
    id: workflowId,
    kind: "workflow",
    name: "测试工作流",
    description: "",
    status: "draft",
    category: "测试",
    tags: [],
    icon: "W",
    version: "1.0.0",
    source: "test",
    permissions: [],
    capabilities: [],
    associations: [],
    workflowNodes: [...nodes],
    workflowEdges: [],
    documents: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

class MemoryWorkflowRepository implements WorkflowRepository {
  readonly kind = "workflow" as const;
  constructor(private readonly workflow: PrototypeDefinition) {}
  async list() {
    return [this.workflow];
  }
  async getById(id: PrototypeId) {
    return id === this.workflow.id ? this.workflow : null;
  }
  async save() {}
  async delete() {}
}
