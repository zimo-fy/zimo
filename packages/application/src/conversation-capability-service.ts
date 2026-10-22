import type {
  Conversation,
  ConversationCapabilities,
  ConversationRepository,
  PrototypeDefinition,
  PrototypeId,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";
import { MAX_CONVERSATION_MCP_TOOLS } from "@zimo/contracts";

import * as ConversationRun from "./conversation-run";
import type { PrototypeCatalogService } from "./prototype-catalog-service";
import type { ControlledToolService } from "./tool-runtime";

const MAX_SKILLS = 20;
const MAX_KNOWLEDGE_BASES = 5;

export interface ResolvedConversationCapabilities {
  agentExecution?:
    | {
        agent: PrototypeDefinition;
        skills: readonly PrototypeDefinition[];
        knowledgeBases: readonly PrototypeDefinition[];
      }
    | undefined;
  skills: readonly PrototypeDefinition[];
  knowledgeBaseIds: readonly PrototypeId[];
  workflowId?: PrototypeId | undefined;
  mcpToolIds: readonly string[];
  browserEnabled: boolean;
}

export class ConversationCapabilityService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly prototypes: PrototypeCatalogService,
    private readonly tools: ControlledToolService,
  ) {}

  async change(
    conversationId: string,
    input: {
      agentId: string | null;
      skillIds: readonly string[];
      knowledgeBaseIds: readonly string[];
      workflowId: string | null;
      mcpToolIds: readonly string[];
      browserEnabled: boolean;
    },
    updatedAt: Date,
  ): Promise<Conversation> {
    const conversation = await this.requireConversation(conversationId);
    if (conversation.activeRunId) throw ConversationRun.runAlreadyActive();
    const capabilities = await this.validate(input);
    await this.conversations.changeCapabilities(conversation.id, capabilities, updatedAt);
    const updated = await this.requireConversation(conversationId);
    if (updated.activeRunId) throw ConversationRun.runAlreadyActive();
    return updated;
  }

  async resolve(conversation: Conversation): Promise<ResolvedConversationCapabilities> {
    const capabilities = await this.validate({
      agentId: conversation.agentId ?? null,
      skillIds: conversation.skillIds,
      knowledgeBaseIds: conversation.knowledgeBaseIds,
      workflowId: conversation.workflowId ?? null,
      mcpToolIds: conversation.mcpToolIds,
      browserEnabled: conversation.browserEnabled,
    });
    const agentExecution = capabilities.agentId
      ? await this.prototypes.resolveAgentExecution(capabilities.agentId)
      : undefined;
    const directSkills = await this.resolveSkills(capabilities.skillIds);
    const skills = uniquePrototypes([...(agentExecution?.skills ?? []), ...directSkills]);
    const knowledgeBaseIds = [
      ...new Set([
        ...capabilities.knowledgeBaseIds,
        ...(agentExecution?.knowledgeBases.map((item) => item.id) ?? []),
      ]),
    ];
    if (knowledgeBaseIds.length > MAX_KNOWLEDGE_BASES) {
      throw capabilityError(
        "KNOWLEDGE_SELECTION_LIMIT_EXCEEDED",
        "会话与 Agent 合计最多使用 5 个知识库。",
      );
    }
    return {
      ...(agentExecution ? { agentExecution } : {}),
      skills,
      knowledgeBaseIds,
      ...(capabilities.workflowId ? { workflowId: capabilities.workflowId } : {}),
      mcpToolIds: capabilities.mcpToolIds,
      browserEnabled: true,
    };
  }

  private async validate(input: {
    agentId: string | null;
    skillIds: readonly string[];
    knowledgeBaseIds: readonly string[];
    workflowId: string | null;
    mcpToolIds: readonly string[];
    browserEnabled: boolean;
  }): Promise<ConversationCapabilities> {
    const skillIds = uniqueLimited(input.skillIds, MAX_SKILLS, "一次最多选择 20 个 Skill。");
    const knowledgeBaseIds = uniqueLimited(
      input.knowledgeBaseIds,
      MAX_KNOWLEDGE_BASES,
      "一次最多使用 5 个知识库。",
    );
    const mcpToolIds = uniqueLimited(
      input.mcpToolIds,
      MAX_CONVERSATION_MCP_TOOLS,
      `一次最多选择 ${MAX_CONVERSATION_MCP_TOOLS} 个 MCP Tool。`,
    );
    if (input.agentId) await this.prototypes.resolveAgentExecution(input.agentId);
    await this.resolveSkills(skillIds);
    for (const knowledgeBaseId of knowledgeBaseIds) {
      const item = await this.prototypes.get("knowledge", knowledgeBaseId);
      if (item.status !== "enabled") {
        throw capabilityError("KNOWLEDGE_BASE_NOT_ENABLED", "只能选择已启用的知识库。");
      }
    }
    if (input.workflowId) {
      const workflow = await this.prototypes.get("workflow", input.workflowId);
      if (workflow.status !== "enabled") {
        throw capabilityError("WORKFLOW_NOT_ENABLED", "只能选择已启用的 Workflow。");
      }
    }
    const availableTools = new Set(
      this.tools
        .list()
        .filter((tool) => tool.source === "mcp")
        .map((tool) => tool.id),
    );
    if (mcpToolIds.some((toolId) => !availableTools.has(toolId))) {
      throw capabilityError(
        "CONVERSATION_MCP_TOOL_NOT_AVAILABLE",
        "只能选择当前已连接 MCP Server 的可用 Tool。",
      );
    }
    return {
      ...(input.agentId ? { agentId: input.agentId as PrototypeId } : {}),
      skillIds: skillIds.map((id) => id as PrototypeId),
      knowledgeBaseIds: knowledgeBaseIds.map((id) => id as PrototypeId),
      ...(input.workflowId ? { workflowId: input.workflowId as PrototypeId } : {}),
      mcpToolIds,
      browserEnabled: true,
    };
  }

  private async resolveSkills(skillIds: readonly string[]): Promise<PrototypeDefinition[]> {
    const skills = await Promise.all(skillIds.map((id) => this.prototypes.get("skill", id)));
    if (skills.some((skill) => !ConversationRun.isExecutableInstructionSkill(skill))) {
      throw capabilityError("CONVERSATION_SKILL_NOT_AVAILABLE", "只能选择已安装且可用的 Skill。");
    }
    return skills;
  }

  private async requireConversation(id: string): Promise<Conversation> {
    const value = await this.conversations.getById(id as Conversation["id"]);
    if (!value) throw ConversationRun.conversationNotFound();
    return value;
  }
}

function uniqueLimited(values: readonly string[], limit: number, message: string): string[] {
  const unique = [...new Set(values)];
  if (unique.length > limit) throw capabilityError("CAPABILITY_SELECTION_LIMIT_EXCEEDED", message);
  return unique;
}

function uniquePrototypes(values: readonly PrototypeDefinition[]): PrototypeDefinition[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

function capabilityError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "configuration", userMessage });
}
