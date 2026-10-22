import type {
  Clock,
  IdGenerator,
  PrototypeDefinition,
  PrototypeId,
  PrototypeKind,
  PrototypeRepository,
  PrototypeStatus,
  RouteTarget,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import * as ConversationRun from "./conversation-run";
import { requireText } from "./input-validation";

export interface PrototypeEditableCommand {
  name: string;
  description: string;
  category: string;
  tags: readonly string[];
  status: PrototypeStatus;
  modelId?: string | undefined;
  systemPrompt?: string | undefined;
  skillIds?: readonly string[] | undefined;
  knowledgeBaseIds?: readonly string[] | undefined;
  mcpServerIds?: readonly string[] | undefined;
  permissions: readonly string[];
  associations: readonly string[];
  triggerType?: "manual" | "schedule" | "webhook" | "message" | "file_change" | undefined;
}

export type PrototypeMutationCommand =
  | { action: "create"; kind: PrototypeKind; value: PrototypeEditableCommand }
  | { action: "update"; kind: PrototypeKind; id: string; value: PrototypeEditableCommand }
  | { action: "duplicate"; kind: PrototypeKind; id: string }
  | { action: "delete"; kind: PrototypeKind; id: string }
  | { action: "preview"; kind: PrototypeKind; id: string }
  | { action: "set-status"; kind: PrototypeKind; id: string; status: PrototypeStatus }
  | {
      action: "set-installation";
      kind: "skill" | "plugin";
      id: string;
      status: "not_installed" | "installed" | "update_available";
    }
  | {
      action: "save-workflow";
      kind: "workflow";
      id: string;
      nodes: PrototypeDefinition["workflowNodes"];
      edges: PrototypeDefinition["workflowEdges"];
      mcpServerIds?: readonly string[] | undefined;
    };

export class PrototypeCatalogService {
  constructor(
    private readonly repositories: Readonly<Record<PrototypeKind, PrototypeRepository>>,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async list(
    kind: PrototypeKind,
    query?: string,
    status?: PrototypeStatus,
  ): Promise<readonly PrototypeDefinition[]> {
    const normalizedQuery = query?.trim().toLocaleLowerCase();
    return (await this.repositories[kind].list()).filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        [item.name, item.description, item.category, ...item.tags].some((value) =>
          value.toLocaleLowerCase().includes(normalizedQuery),
        );
      return matchesQuery && (!status || item.status === status);
    });
  }

  async get(kind: PrototypeKind, id: string): Promise<PrototypeDefinition> {
    const value = await this.repositories[kind].getById(id as PrototypeId);
    if (!value) throw prototypeNotFound();
    return value;
  }

  async listRouteTargets(type?: "agent" | "skill" | "workflow"): Promise<readonly RouteTarget[]> {
    const kinds = type ? [type] : (["agent", "skill", "workflow"] as const);
    const groups = await Promise.all(kinds.map((kind) => this.repositories[kind].list()));
    return groups
      .flat()
      .filter(
        (item) =>
          item.status === "enabled" &&
          (item.kind !== "skill" || ConversationRun.isExecutableInstructionSkill(item)),
      )
      .map((item) => ({
        id: item.id,
        type: item.kind as RouteTarget["type"],
        name: item.name,
        description: item.description,
        enabled: true,
      }));
  }

  async resolveAgentExecution(agentId: string): Promise<{
    agent: PrototypeDefinition;
    skills: readonly PrototypeDefinition[];
    knowledgeBases: readonly PrototypeDefinition[];
  }> {
    const agent = await this.get("agent", agentId);
    if (agent.status !== "enabled") {
      throw new AppError({
        code: "AGENT_NOT_ENABLED",
        category: "configuration",
        userMessage: "所选 Agent 当前未启用。",
      });
    }
    const skills = await Promise.all(
      (agent.skillIds ?? []).map((skillId) => this.get("skill", skillId)),
    );
    if (skills.some((skill) => !ConversationRun.isExecutableInstructionSkill(skill))) {
      throw new AppError({
        code: "AGENT_SKILL_NOT_AVAILABLE",
        category: "configuration",
        userMessage: "Agent 绑定的部分 Skill 未安装或未启用。",
      });
    }
    const knowledgeBases = await Promise.all(
      (agent.knowledgeBaseIds ?? []).map((id) => this.get("knowledge", id)),
    );
    if (knowledgeBases.some((knowledgeBase) => knowledgeBase.status !== "enabled")) {
      throw new AppError({
        code: "AGENT_KNOWLEDGE_NOT_AVAILABLE",
        category: "configuration",
        userMessage: "Agent 绑定的部分知识库未启用。",
      });
    }
    return { agent, skills, knowledgeBases };
  }

  async mutate(command: PrototypeMutationCommand): Promise<PrototypeDefinition> {
    if (command.kind === "skill" && command.action !== "delete" && command.action !== "preview") {
      throw new AppError({
        code: "SKILL_MANAGED_BY_INSTALLATION",
        category: "configuration",
        userMessage: "Skill 只能通过安装或卸载进行管理。",
      });
    }
    if (command.action === "preview") {
      await this.get(command.kind, command.id);
      throw new AppError({
        code: "CAPABILITY_UNAVAILABLE",
        category: "configuration",
        userMessage: "此操作仅供预览，将在后续版本开放。",
      });
    }
    if (command.action === "create") {
      const now = this.clock.now();
      const value = this.fromEditable(
        command.kind,
        this.ids.create() as PrototypeId,
        command.value,
        now,
        now,
      );
      await this.validateAgentBindings(value);
      await this.repositories[command.kind].save(value);
      return value;
    }
    const current = await this.get(command.kind, command.id);
    if (command.action === "delete") {
      if (command.kind === "agent" && current.agentCatalogId) {
        throw new AppError({
          code: "AGENT_MANAGED_BY_INSTALLATION",
          category: "configuration",
          userMessage: "人才库 Agent 只能通过卸载进行删除。",
        });
      }
      await this.repositories[command.kind].delete(current.id);
      return current;
    }
    if (command.action === "duplicate") {
      const now = this.clock.now();
      const base = { ...current };
      delete base.agentCatalogId;
      delete base.agentRemoteId;
      if (current.agentCatalogId) {
        delete base.installationStatus;
        base.source = "本地副本";
      }
      const value: PrototypeDefinition = {
        ...base,
        id: this.ids.create() as PrototypeId,
        name: `${current.name} 副本`,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      await this.repositories[command.kind].save(value);
      return value;
    }
    let next: PrototypeDefinition;
    if (command.action === "update") {
      next = {
        ...this.fromEditable(
          command.kind,
          current.id,
          command.value,
          current.createdAt,
          this.clock.now(),
        ),
        icon: current.icon,
        version: current.version,
        source: current.source,
        capabilities: current.capabilities,
        workflowNodes: current.workflowNodes,
        workflowEdges: current.workflowEdges,
        documents: current.documents,
        ...(current.installationStatus ? { installationStatus: current.installationStatus } : {}),
        ...(current.agentCatalogId ? { agentCatalogId: current.agentCatalogId } : {}),
        ...(current.agentRemoteId ? { agentRemoteId: current.agentRemoteId } : {}),
        ...(current.secretHint ? { secretHint: current.secretHint } : {}),
      };
      await this.validateAgentBindings(next);
    } else if (command.action === "set-status") {
      next = { ...current, status: command.status, updatedAt: this.clock.now() };
    } else if (command.action === "set-installation") {
      next = {
        ...current,
        installationStatus: command.status,
        status: command.status === "not_installed" ? "disabled" : current.status,
        updatedAt: this.clock.now(),
      };
    } else {
      await this.validateWorkflow(command.nodes, command.edges);
      next = {
        ...current,
        workflowNodes: command.nodes,
        workflowEdges: command.edges,
        ...(command.mcpServerIds
          ? { mcpServerIds: command.mcpServerIds }
          : current.mcpServerIds
            ? { mcpServerIds: current.mcpServerIds }
            : {}),
        updatedAt: this.clock.now(),
      };
    }
    await this.repositories[command.kind].save(next);
    return next;
  }

  private async validateAgentBindings(agent: PrototypeDefinition): Promise<void> {
    if (agent.kind !== "agent") return;
    const skills = await Promise.all(
      (agent.skillIds ?? []).map((skillId) => this.repositories.skill.getById(skillId)),
    );
    if (skills.some((skill) => !ConversationRun.isExecutableInstructionSkill(skill))) {
      throw new AppError({
        code: "AGENT_SKILL_NOT_AVAILABLE",
        category: "configuration",
        userMessage: "只能绑定已安装且已启用的 Skill。",
      });
    }
    const knowledgeBases = await Promise.all(
      (agent.knowledgeBaseIds ?? []).map((id) => this.repositories.knowledge.getById(id)),
    );
    if (
      knowledgeBases.some((knowledgeBase) => !knowledgeBase || knowledgeBase.status !== "enabled")
    ) {
      throw new AppError({
        code: "AGENT_KNOWLEDGE_NOT_AVAILABLE",
        category: "configuration",
        userMessage: "只能绑定已启用的知识库。",
      });
    }
  }

  private async validateWorkflow(
    nodes: PrototypeDefinition["workflowNodes"],
    edges: PrototypeDefinition["workflowEdges"],
  ): Promise<void> {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edgeIds = new Set(edges.map((edge) => edge.id));
    const starts = nodes.filter((node) => node.type === "start");
    const ends = nodes.filter((node) => node.type === "end");
    const invalidStructure =
      nodeIds.size !== nodes.length ||
      edgeIds.size !== edges.length ||
      starts.length !== 1 ||
      ends.length < 1 ||
      edges.some(
        (edge) =>
          !nodeIds.has(edge.source) ||
          !nodeIds.has(edge.target) ||
          edge.source === edge.target ||
          starts.some((node) => node.id === edge.target) ||
          ends.some((node) => node.id === edge.source),
      );
    if (invalidStructure || hasWorkflowCycle(nodes, edges)) {
      throw new AppError({
        code: "WORKFLOW_STRUCTURE_INVALID",
        category: "user",
        userMessage: "工作流需要一个开始节点、至少一个结束节点，并保持连接有效且无循环。",
      });
    }

    const referencedAgents = nodes
      .filter((node) => node.type === "agent" && node.config?.agentId)
      .map((node) => node.config?.agentId as PrototypeId);
    const agents = await Promise.all(
      referencedAgents.map((id) => this.repositories.agent.getById(id)),
    );
    if (agents.some((agent) => !agent || agent.status !== "enabled")) {
      throw new AppError({
        code: "WORKFLOW_AGENT_NOT_AVAILABLE",
        category: "configuration",
        userMessage: "工作流只能引用已启用的 Agent。",
      });
    }

    const referencedSkills = nodes
      .filter((node) => node.type === "skill" && node.config?.skillId)
      .map((node) => node.config?.skillId as PrototypeId);
    const skills = await Promise.all(
      referencedSkills.map((id) => this.repositories.skill.getById(id)),
    );
    if (
      skills.some(
        (skill) => !skill || skill.status !== "enabled" || skill.installationStatus !== "installed",
      )
    ) {
      throw new AppError({
        code: "WORKFLOW_SKILL_NOT_AVAILABLE",
        category: "configuration",
        userMessage: "工作流只能引用已安装且已启用的 Skill。",
      });
    }

    const referencedKnowledge = nodes
      .filter((node) => node.type === "knowledge" && node.config?.knowledgeBaseId)
      .map((node) => node.config?.knowledgeBaseId as PrototypeId);
    const knowledgeBases = await Promise.all(
      referencedKnowledge.map((id) => this.repositories.knowledge.getById(id)),
    );
    if (
      knowledgeBases.some((knowledgeBase) => !knowledgeBase || knowledgeBase.status !== "enabled")
    ) {
      throw new AppError({
        code: "WORKFLOW_KNOWLEDGE_NOT_AVAILABLE",
        category: "configuration",
        userMessage: "知识检索节点只能引用已启用的知识库。",
      });
    }
  }

  private fromEditable(
    kind: PrototypeKind,
    id: PrototypeId,
    input: PrototypeEditableCommand,
    createdAt: Date,
    updatedAt: Date,
  ): PrototypeDefinition {
    return {
      id,
      kind,
      name: requireText(input.name, "名称", 120),
      description: input.description.trim(),
      status: input.status,
      category: input.category.trim(),
      tags: input.tags,
      icon: input.name.trim().slice(0, 1).toUpperCase(),
      version: "1.0.0",
      source: "用户创建",
      ...(input.modelId ? { modelId: input.modelId } : {}),
      ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
      ...(kind === "agent" && input.skillIds
        ? { skillIds: input.skillIds as readonly PrototypeId[] }
        : {}),
      ...(kind === "agent" && input.knowledgeBaseIds
        ? { knowledgeBaseIds: input.knowledgeBaseIds as readonly PrototypeId[] }
        : {}),
      ...(kind === "agent" && input.mcpServerIds ? { mcpServerIds: input.mcpServerIds } : {}),
      ...(kind === "workflow" && input.mcpServerIds ? { mcpServerIds: input.mcpServerIds } : {}),
      permissions: input.permissions,
      capabilities: [],
      associations: input.associations,
      ...(input.triggerType ? { triggerType: input.triggerType } : {}),
      workflowNodes:
        kind === "workflow"
          ? [
              { id: "start", type: "start", label: "流程开始", position: { x: 80, y: 180 } },
              { id: "end", type: "end", label: "流程结束", position: { x: 520, y: 180 } },
            ]
          : [],
      workflowEdges: [],
      documents: [],
      createdAt,
      updatedAt,
    };
  }
}

function hasWorkflowCycle(
  nodes: PrototypeDefinition["workflowNodes"],
  edges: PrototypeDefinition["workflowEdges"],
): boolean {
  const successors = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    successors.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    visited += 1;
    for (const target of successors.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  return visited !== nodes.length;
}

function prototypeNotFound(): AppError {
  return new AppError({
    code: "PROTOTYPE_NOT_FOUND",
    category: "user",
    userMessage: "没有找到该原型项目。",
  });
}
