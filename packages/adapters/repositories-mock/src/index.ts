import type {
  PrototypeDefinition,
  PrototypeId,
  PrototypeKind,
  PrototypeRepository,
} from "@zimo/domain";

export class InMemoryPrototypeRepository implements PrototypeRepository {
  private readonly values = new Map<PrototypeId, PrototypeDefinition>();

  constructor(
    readonly kind: PrototypeKind,
    initialValues: readonly PrototypeDefinition[] = [],
  ) {
    for (const value of initialValues) {
      if (value.kind !== kind) throw new Error("Prototype repository kind mismatch");
      this.values.set(value.id, value);
    }
  }

  async list(): Promise<readonly PrototypeDefinition[]> {
    return [...this.values.values()].sort(
      (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
    );
  }
  async getById(id: PrototypeId): Promise<PrototypeDefinition | null> {
    return this.values.get(id) ?? null;
  }
  async save(value: PrototypeDefinition): Promise<void> {
    if (value.kind !== this.kind) throw new Error("Prototype repository kind mismatch");
    this.values.set(value.id, value);
  }
  async delete(id: PrototypeId): Promise<void> {
    this.values.delete(id);
  }
}

export function createSeededPrototypeRepositories(
  now: Date,
): Readonly<Record<PrototypeKind, InMemoryPrototypeRepository>> {
  const seed = seedDefinitions(now);
  const forKind = (kind: PrototypeKind) =>
    new InMemoryPrototypeRepository(
      kind,
      seed.filter((item) => item.kind === kind),
    );
  return {
    agent: forKind("agent"),
    skill: forKind("skill"),
    knowledge: forKind("knowledge"),
    workflow: forKind("workflow"),
    plugin: forKind("plugin"),
    mcp: forKind("mcp"),
    automation: forKind("automation"),
  };
}

function seedDefinitions(now: Date): readonly PrototypeDefinition[] {
  const base = {
    status: "enabled" as const,
    tags: [] as readonly string[],
    version: "1.0.0",
    source: "Zimo 内置示例",
    permissions: [] as readonly string[],
    capabilities: [] as readonly string[],
    associations: [] as readonly string[],
    workflowNodes: [] as const,
    workflowEdges: [] as const,
    documents: [] as const,
    createdAt: now,
    updatedAt: now,
  };
  return [
    {
      ...base,
      id: id(1),
      kind: "agent",
      name: "研究助手",
      description: "整理资料并形成结构化研究提纲。",
      category: "效率",
      icon: "研",
      systemPrompt: "你是一名谨慎的研究助手。",
      permissions: ["仅对话", "不调用工具"],
      associations: ["网页摘要", "产品资料库"],
    },
    {
      ...base,
      id: id(2),
      kind: "skill",
      name: "网页摘要",
      description: "把长内容整理为重点、风险与下一步。",
      category: "写作",
      icon: "摘",
      tags: ["摘要", "中文"],
      source: "Zimo Gallery",
      skillPackageId: "zimo.builtin.web-summary",
      skillInstructions:
        "将用户提供的网页或长文本整理为：核心摘要、关键信息、潜在风险和建议的下一步。不要虚构原文中不存在的事实；缺少网页正文时，先明确请用户提供内容。",
      skillChecksum: "f9588552dd2913ba1e9eb800b1cf25e41d7d61df9d578be1fa8bf07ef609bc58",
      permissions: ["读取用户提供的文本"],
      capabilities: ["指令型 Skill"],
      associations: ["研究助手"],
      installationStatus: "installed",
    },
    {
      ...base,
      id: id(3),
      kind: "knowledge",
      name: "产品资料库",
      description: "产品说明与内部 FAQ 的知识集合。",
      category: "产品",
      icon: "知",
      associations: ["研究助手"],
      documents: [{ id: id(31), name: "产品概览.pdf", sizeLabel: "1.2 MB", status: "ready" }],
    },
    {
      ...base,
      id: id(4),
      kind: "workflow",
      name: "研究审核流",
      description: "从研究任务到人工确认的流程原型。",
      category: "协作",
      icon: "流",
      workflowNodes: [
        { id: "start", type: "start", label: "开始", position: { x: 40, y: 120 } },
        { id: "agent", type: "agent", label: "研究助手", position: { x: 280, y: 120 } },
        { id: "approval", type: "approval", label: "人工确认", position: { x: 520, y: 120 } },
        { id: "end", type: "end", label: "结束", position: { x: 760, y: 120 } },
      ],
      workflowEdges: [
        { id: "e-start-agent", source: "start", target: "agent" },
        { id: "e-agent-approval", source: "agent", target: "approval" },
        { id: "e-approval-end", source: "approval", target: "end" },
      ],
    },
    {
      ...base,
      id: id(5),
      kind: "plugin",
      name: "微信 Connector",
      description: "微信消息渠道示例，当前仅展示配置。",
      category: "Connector",
      icon: "微",
      source: "Zimo Labs · Zimo Gallery",
      permissions: ["消息收发（未开放）"],
      capabilities: ["Connector"],
      installationStatus: "update_available",
    },
    {
      ...base,
      id: id(6),
      kind: "plugin",
      name: "Telegram Connector",
      description: "Telegram 消息渠道示例，当前不加载代码。",
      category: "Connector",
      icon: "T",
      source: "Zimo Labs · Zimo Gallery",
      permissions: ["网络访问（未开放）"],
      capabilities: ["Connector"],
      installationStatus: "not_installed",
      status: "disabled",
    },
    {
      ...base,
      id: id(7),
      kind: "mcp",
      name: "团队工具 MCP",
      description: "stdio 类型的 MCP Server 配置原型。",
      category: "stdio",
      icon: "M",
      status: "disabled",
      secretHint: "TOKEN •••• 4821",
      capabilities: ["Tools · 4", "Resources · 2", "Prompts · 1"],
    },
    {
      ...base,
      id: id(8),
      kind: "automation",
      name: "每周研究回顾",
      description: "每周汇总研究主题的自动化原型。",
      category: "计划",
      icon: "自",
      status: "draft",
      triggerType: "schedule",
      associations: ["研究审核流"],
    },
  ];
}

function id(value: number): PrototypeId {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}` as PrototypeId;
}
