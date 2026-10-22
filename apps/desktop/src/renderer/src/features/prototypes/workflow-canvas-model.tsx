import type { Connection, Edge, Node } from "@xyflow/react";
import type { PrototypeDetailView } from "@zimo/contracts";
import {
  Bot,
  BookOpen,
  CircleStop,
  Diamond,
  GitBranch,
  Hand,
  Play,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

export type NodeKind =
  "start" | "agent" | "skill" | "knowledge" | "tool" | "condition" | "approval" | "end";
export type WorkflowNodeConfig = NonNullable<
  PrototypeDetailView["workflowNodes"][number]["config"]
>;
export type WorkflowNodeData = {
  [key: string]: unknown;
  label: string;
  zimoType: NodeKind;
  config: WorkflowNodeConfig;
  runtimeStatus?: "running" | "completed" | "skipped" | "failed";
};
export type WorkflowFlowNode = Node<WorkflowNodeData, "zimoWorkflow">;
export type WorkflowFlowEdge = Edge;
export type WorkflowSnapshot = { nodes: WorkflowFlowNode[]; edges: WorkflowFlowEdge[] };

export const workflowNodeCatalog: readonly {
  type: NodeKind;
  label: string;
  description: string;
  category: "系统" | "AI 能力" | "逻辑";
  icon: ComponentType<{ size?: number; className?: string }>;
}[] = [
  { type: "start", label: "流程开始", description: "接收用户输入", category: "系统", icon: Play },
  {
    type: "end",
    label: "流程结束",
    description: "输出最终结果",
    category: "系统",
    icon: CircleStop,
  },
  {
    type: "agent",
    label: "Agent",
    description: "调用已启用 Agent",
    category: "AI 能力",
    icon: Bot,
  },
  {
    type: "knowledge",
    label: "知识检索",
    description: "检索本地知识库",
    category: "AI 能力",
    icon: BookOpen,
  },
  {
    type: "skill",
    label: "Skill",
    description: "引用 instruction Skill",
    category: "AI 能力",
    icon: Sparkles,
  },
  {
    type: "tool",
    label: "Tool",
    description: "调用受控注册能力",
    category: "AI 能力",
    icon: Wrench,
  },
  {
    type: "condition",
    label: "条件分支",
    description: "按表达式选择路径",
    category: "逻辑",
    icon: Diamond,
  },
  {
    type: "approval",
    label: "人工确认",
    description: "暂停并等待确认",
    category: "逻辑",
    icon: Hand,
  },
];

export function mapWorkflowNodes(detail: PrototypeDetailView): WorkflowFlowNode[] {
  return detail.workflowNodes.map((node) => ({
    id: node.id,
    position: node.position,
    data: {
      label: node.label,
      zimoType: node.type,
      config: node.config ?? defaultWorkflowNodeConfig(node.type),
    },
    type: "zimoWorkflow",
  }));
}

export function mapWorkflowEdges(detail: PrototypeDetailView): WorkflowFlowEdge[] {
  return detail.workflowEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
    type: "smoothstep",
  }));
}

export function toWorkflowNodeDefinitions(
  nodes: readonly WorkflowFlowNode[],
): PrototypeDetailView["workflowNodes"] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.data.zimoType,
    label: node.data.label.trim() || "未命名节点",
    position: node.position,
    config: cleanWorkflowNodeConfig(node.data.config),
  }));
}

export function toWorkflowEdgeDefinitions(
  edges: readonly WorkflowFlowEdge[],
): PrototypeDetailView["workflowEdges"] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
  }));
}

export function isWorkflowConnectionAllowed(
  connection: Connection | WorkflowFlowEdge,
  nodes: readonly WorkflowFlowNode[],
): boolean {
  if (!connection.source || !connection.target || connection.source === connection.target) {
    return false;
  }
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  return Boolean(
    source && target && source.data.zimoType !== "end" && target.data.zimoType !== "start",
  );
}

export function defaultWorkflowNodeConfig(type: NodeKind): WorkflowNodeConfig {
  if (type === "start") return { outputKey: "userInput" };
  if (type === "end") return { inputKey: "result" };
  if (type === "knowledge") return { topK: 5 };
  return {};
}

export function cloneWorkflowSnapshot(snapshot: WorkflowSnapshot): WorkflowSnapshot {
  return { nodes: structuredClone(snapshot.nodes), edges: structuredClone(snapshot.edges) };
}

export function workflowNodeTypeLabel(type: NodeKind): string {
  return workflowNodeCatalog.find((item) => item.type === type)?.description ?? type;
}

export function workflowNodeSummary(data: WorkflowNodeData): string {
  if (data.zimoType === "agent") return data.config.agentId ? "已选择 Agent" : "等待选择 Agent";
  if (data.zimoType === "skill") return data.config.skillId ? "已选择 Skill" : "等待选择 Skill";
  if (data.zimoType === "knowledge") {
    return data.config.knowledgeBaseId ? `知识库 · Top ${data.config.topK ?? 5}` : "等待选择知识库";
  }
  if (data.zimoType === "tool") return data.config.toolId || "等待选择受控 Tool";
  if (data.zimoType === "condition") return data.config.expression || "等待配置条件";
  if (data.zimoType === "approval") return data.config.instruction || "等待用户确认";
  if (data.zimoType === "start") return `输出 ${data.config.outputKey ?? "userInput"}`;
  if (data.zimoType === "end") return `接收 ${data.config.inputKey ?? "result"}`;
  return data.config.instruction || "等待配置";
}

export function workflowNodeColor(type: NodeKind): string {
  return {
    start: "bg-emerald-50 text-emerald-700",
    end: "bg-rose-50 text-rose-700",
    agent: "bg-violet-50 text-violet-700",
    knowledge: "bg-sky-50 text-sky-700",
    skill: "bg-amber-50 text-amber-700",
    tool: "bg-indigo-50 text-indigo-700",
    condition: "bg-orange-50 text-orange-700",
    approval: "bg-cyan-50 text-cyan-700",
  }[type];
}

export function renderWorkflowNodeIcon(type: NodeKind, size: number) {
  const Icon = workflowNodeCatalog.find((item) => item.type === type)?.icon ?? GitBranch;
  return <Icon size={size} />;
}

export function cleanWorkflowNodeConfig(config: WorkflowNodeConfig): WorkflowNodeConfig {
  return Object.fromEntries(
    Object.entries(config).filter(
      ([, value]) =>
        value !== "" &&
        value !== undefined &&
        !(typeof value === "number" && !Number.isFinite(value)),
    ),
  ) as WorkflowNodeConfig;
}
