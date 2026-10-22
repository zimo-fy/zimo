import { describe, expect, it } from "vitest";
import type {
  PrototypeDefinition,
  PrototypeId,
  PrototypeKind,
  PrototypeRepository,
} from "@zimo/domain";
import { InstructionSkillInstallationService, PrototypeCatalogService } from "./index";

describe("PrototypeCatalogService", () => {
  it("creates, filters, updates and duplicates definitions", async () => {
    const repositories = createRepositories();
    let sequence = 10;
    const service = new PrototypeCatalogService(
      repositories,
      { now: () => new Date("2026-09-03T00:00:00.000Z") },
      { create: () => `00000000-0000-4000-8000-${(++sequence).toString().padStart(12, "0")}` },
    );
    const created = await service.mutate({
      action: "create",
      kind: "agent",
      value: {
        name: "Research Agent",
        description: "中文研究",
        category: "效率",
        tags: ["research"],
        status: "enabled",
        permissions: [],
        associations: [],
      },
    });
    expect(await service.list("agent", "中文", "enabled")).toEqual([created]);
    const disabled = await service.mutate({
      action: "set-status",
      kind: "agent",
      id: created.id,
      status: "disabled",
    });
    expect(disabled.status).toBe("disabled");
    const copy = await service.mutate({ action: "duplicate", kind: "agent", id: created.id });
    expect(copy).toMatchObject({ name: "Research Agent 副本", status: "draft" });
  });

  it("rejects preview execution and invalid workflow structures", async () => {
    const repositories = createRepositories();
    const service = new PrototypeCatalogService(
      repositories,
      { now: () => new Date() },
      { create: () => "00000000-0000-4000-8000-000000000099" },
    );
    const workflow = definition("workflow");
    await repositories.workflow.save(workflow);
    await expect(
      service.mutate({ action: "preview", kind: "workflow", id: workflow.id }),
    ).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
    await expect(
      service.mutate({
        action: "save-workflow",
        kind: "workflow",
        id: workflow.id,
        nodes: [],
        edges: [{ id: "edge", source: "missing", target: "missing" }],
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_STRUCTURE_INVALID" });
    await expect(
      service.mutate({
        action: "save-workflow",
        kind: "workflow",
        id: workflow.id,
        nodes: [
          { id: "start", type: "start", label: "开始", position: { x: 0, y: 0 } },
          { id: "agent", type: "agent", label: "Agent", position: { x: 200, y: 0 } },
          { id: "end", type: "end", label: "结束", position: { x: 400, y: 0 } },
        ],
        edges: [
          { id: "a", source: "start", target: "agent" },
          { id: "b", source: "agent", target: "end" },
          { id: "c", source: "end", target: "agent" },
        ],
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_STRUCTURE_INVALID" });
  });

  it("validates configured Agent and knowledge references in workflows", async () => {
    const repositories = createRepositories();
    const agent = { ...definition("agent"), status: "enabled" as const };
    const knowledge = {
      ...definition("knowledge"),
      id: "00000000-0000-4000-8000-000000000003" as PrototypeId,
      status: "enabled" as const,
    };
    const workflow = {
      ...definition("workflow"),
      id: "00000000-0000-4000-8000-000000000004" as PrototypeId,
    };
    await repositories.agent.save(agent);
    await repositories.knowledge.save(knowledge);
    await repositories.workflow.save(workflow);
    const service = new PrototypeCatalogService(
      repositories,
      { now: () => new Date() },
      { create: () => "00000000-0000-4000-8000-000000000099" },
    );
    await expect(
      service.mutate({
        action: "save-workflow",
        kind: "workflow",
        id: workflow.id,
        nodes: [
          { id: "start", type: "start", label: "开始", position: { x: 0, y: 0 } },
          {
            id: "knowledge",
            type: "knowledge",
            label: "知识检索",
            position: { x: 200, y: 0 },
            config: { knowledgeBaseId: knowledge.id, topK: 5 },
          },
          {
            id: "agent",
            type: "agent",
            label: "Agent",
            position: { x: 400, y: 0 },
            config: { agentId: agent.id },
          },
          { id: "end", type: "end", label: "结束", position: { x: 600, y: 0 } },
        ],
        edges: [
          { id: "a", source: "start", target: "knowledge" },
          { id: "b", source: "knowledge", target: "agent" },
          { id: "c", source: "agent", target: "end" },
        ],
      }),
    ).resolves.toMatchObject({
      workflowNodes: expect.arrayContaining([
        expect.objectContaining({ config: { knowledgeBaseId: knowledge.id, topK: 5 } }),
      ]),
    });
    await expect(
      service.mutate({ action: "delete", kind: "agent", id: agent.id }),
    ).resolves.toMatchObject({ id: agent.id });
    await expect(repositories.agent.getById(agent.id)).resolves.toBeNull();
  });

  it("projects only enabled Agent, Skill and Workflow route targets", async () => {
    const repositories = createRepositories();
    const enabled = { ...definition("agent"), status: "enabled" as const };
    const disabled = {
      ...definition("skill"),
      id: "00000000-0000-4000-8000-000000000002" as PrototypeId,
      status: "disabled" as const,
    };
    await repositories.agent.save(enabled);
    await repositories.skill.save(disabled);
    const service = new PrototypeCatalogService(
      repositories,
      { now: () => new Date() },
      { create: () => "00000000-0000-4000-8000-000000000099" },
    );
    expect(await service.listRouteTargets()).toEqual([
      {
        id: enabled.id,
        type: "agent",
        name: enabled.name,
        description: enabled.description,
        enabled: true,
      },
    ]);
  });

  it("validates Agent bindings and allows referenced capabilities to be deleted", async () => {
    const repositories = createRepositories();
    const skill = {
      ...definition("skill"),
      status: "enabled" as const,
      installationStatus: "installed" as const,
      skillInstructions: "只处理输入文本。",
    };
    const knowledgeBase = {
      ...definition("knowledge"),
      id: "00000000-0000-4000-8000-000000000003" as PrototypeId,
      status: "enabled" as const,
    };
    await repositories.skill.save(skill);
    await repositories.knowledge.save(knowledgeBase);
    const service = new PrototypeCatalogService(
      repositories,
      { now: () => new Date() },
      { create: () => "00000000-0000-4000-8000-000000000099" },
    );
    await service.mutate({
      action: "create",
      kind: "agent",
      value: {
        name: "绑定测试 Agent",
        description: "",
        category: "测试",
        tags: [],
        status: "enabled",
        permissions: [],
        associations: [],
        skillIds: [skill.id],
        knowledgeBaseIds: [knowledgeBase.id],
      },
    });
    await expect(
      service.resolveAgentExecution("00000000-0000-4000-8000-000000000099"),
    ).resolves.toMatchObject({ knowledgeBases: [{ id: knowledgeBase.id }] });
    await expect(
      service.mutate({ action: "delete", kind: "skill", id: skill.id }),
    ).resolves.toMatchObject({ id: skill.id });
    await expect(
      service.mutate({ action: "delete", kind: "knowledge", id: knowledgeBase.id }),
    ).resolves.toMatchObject({ id: knowledgeBase.id });
    await expect(
      service.mutate({
        action: "create",
        kind: "agent",
        value: {
          name: "无效 Agent",
          description: "",
          category: "测试",
          tags: [],
          status: "enabled",
          permissions: [],
          associations: [],
          skillIds: ["00000000-0000-4000-8000-000000000998"],
        },
      }),
    ).rejects.toMatchObject({ code: "AGENT_SKILL_NOT_AVAILABLE" });
  });
});

describe("InstructionSkillInstallationService", () => {
  it("installs and updates an instruction Skill by package id", async () => {
    const repository = new MemorySkillRepository();
    const service = new InstructionSkillInstallationService(
      repository,
      { now: () => new Date("2026-09-03T12:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000099" },
    );
    const installed = await service.install({
      packageId: "local.example.summary",
      name: "本地摘要",
      version: "1.0.0",
      description: "仅指令",
      category: "写作",
      tags: ["摘要"],
      permissions: ["context:user-input"],
      instructions: "只总结用户输入。",
      checksum: "abc",
      files: [],
    });
    const updated = await service.install({
      packageId: "local.example.summary",
      name: "本地摘要",
      version: "1.1.0",
      description: "仅指令",
      category: "写作",
      tags: ["摘要"],
      permissions: ["context:user-input"],
      instructions: "用三点总结用户输入。",
      checksum: "def",
      files: [],
    });
    expect(installed).toMatchObject({ status: "enabled", installationStatus: "installed" });
    expect(updated.id).toBe(installed.id);
    expect(updated).toMatchObject({ version: "1.1.0", skillChecksum: "def" });
    expect(await repository.list()).toHaveLength(1);
  });
});

class MemoryRepository implements PrototypeRepository {
  private readonly values = new Map<PrototypeId, PrototypeDefinition>();
  async list() {
    return [...this.values.values()];
  }
  async getById(id: PrototypeId) {
    return this.values.get(id) ?? null;
  }
  async save(value: PrototypeDefinition) {
    this.values.set(value.id, value);
  }
  async delete(id: PrototypeId) {
    this.values.delete(id);
  }
}
class MemorySkillRepository extends MemoryRepository {
  readonly kind = "skill" as const;
}
function createRepositories(): Record<PrototypeKind, MemoryRepository> {
  return {
    agent: new MemoryRepository(),
    skill: new MemoryRepository(),
    knowledge: new MemoryRepository(),
    workflow: new MemoryRepository(),
    plugin: new MemoryRepository(),
    mcp: new MemoryRepository(),
    automation: new MemoryRepository(),
  };
}
function definition(kind: PrototypeKind): PrototypeDefinition {
  const now = new Date();
  return {
    id: "00000000-0000-4000-8000-000000000001" as PrototypeId,
    kind,
    name: "Test",
    description: "",
    status: "draft",
    category: "",
    tags: [],
    icon: "T",
    version: "1",
    source: "test",
    permissions: [],
    capabilities: [],
    associations: [],
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: now,
    updatedAt: now,
  };
}
