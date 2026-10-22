import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type {
  McpConnectionView,
  PrototypeDetailView,
  PrototypeSummaryView,
  RouteTargetView,
} from "@zimo/contracts";
import { cn } from "@zimo/ui";
import {
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  GitBranch,
  FileUp,
  FolderPlus,
  Plus,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { isMcpServerSelected } from "./mcp-server-selection";

type ChatCapabilityMenuProps = {
  agents: readonly RouteTargetView[];
  skills: readonly RouteTargetView[];
  workflows: readonly RouteTargetView[];
  knowledgeBases: readonly PrototypeSummaryView[];
  selectedAgent: PrototypeDetailView | null;
  selectedKnowledgeBaseId: string;
  boundSkills: readonly RouteTargetView[];
  selectedSkillIds: readonly string[];
  selectedWorkflowId: string;
  mcpConnections: readonly McpConnectionView[];
  selectedMcpToolIds: readonly string[];
  disabled: boolean;
  onSelectAgent(agentId: string): void;
  onSelectKnowledgeBase(knowledgeBaseId: string): void;
  onToggleSkill(skillId: string): void;
  onSelectWorkflow(workflowId: string): void;
  onToggleMcpServer(connection: McpConnectionView): void;
  onAddFiles(): void;
  onAddWorkspace(): void;
};

export function ChatCapabilityMenu({
  agents,
  skills,
  workflows,
  knowledgeBases,
  selectedAgent,
  selectedKnowledgeBaseId,
  boundSkills,
  selectedSkillIds,
  selectedWorkflowId,
  mcpConnections,
  selectedMcpToolIds,
  disabled,
  onSelectAgent,
  onSelectKnowledgeBase,
  onToggleSkill,
  onSelectWorkflow,
  onToggleMcpServer,
  onAddFiles,
  onAddWorkspace,
}: ChatCapabilityMenuProps) {
  const selectedMcpServerCount = mcpConnections.filter((connection) =>
    isMcpServerSelected(connection, selectedMcpToolIds),
  ).length;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label="添加对话能力"
          title="添加文件、Agent、Skill、知识库、Workflow 或 MCP Server"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 data-[state=open]:bg-neutral-200 data-[state=open]:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 w-72 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl shadow-black/10"
        >
          <DropdownMenu.Label className="px-2.5 pb-2 pt-1.5 text-xs font-semibold text-neutral-900">
            添加到当前对话
          </DropdownMenu.Label>
          <CapabilitySubMenu
            icon={<Bot size={15} className="text-blue-600" />}
            label="Agent"
            value={selectedAgent?.name ?? "普通对话"}
          >
            <SelectionItem
              selected={!selectedAgent}
              label="普通对话"
              onSelect={() => onSelectAgent("")}
            />
            {agents.map((agent) => (
              <SelectionItem
                key={agent.id}
                selected={selectedAgent?.id === agent.id}
                label={agent.name}
                onSelect={() => onSelectAgent(agent.id)}
              />
            ))}
          </CapabilitySubMenu>
          <CapabilitySubMenu
            icon={<Sparkles size={15} className="text-violet-600" />}
            label="Skills"
            value={boundSkills.length > 0 ? `${boundSkills.length} 个` : "未挂载"}
          >
            {skills.length === 0 ? (
              <EmptyState>暂无已安装 Skill</EmptyState>
            ) : (
              skills.map((skill) => (
                <MultiSelectionItem
                  key={skill.id}
                  selected={
                    selectedSkillIds.includes(skill.id) ||
                    Boolean(selectedAgent?.skillIds?.includes(skill.id))
                  }
                  disabled={Boolean(selectedAgent?.skillIds?.includes(skill.id))}
                  label={skill.name}
                  suffix={selectedAgent?.skillIds?.includes(skill.id) ? "随 Agent" : undefined}
                  onToggle={() => onToggleSkill(skill.id)}
                />
              ))
            )}
          </CapabilitySubMenu>
          <CapabilitySubMenu
            icon={<BookOpen size={15} className="text-emerald-600" />}
            label="知识库"
            value={
              knowledgeBases.find((item) => item.id === selectedKnowledgeBaseId)?.name ?? "未选择"
            }
          >
            <SelectionItem
              selected={!selectedKnowledgeBaseId}
              label="无知识库"
              onSelect={() => onSelectKnowledgeBase("")}
            />
            {knowledgeBases.map((knowledgeBase) => (
              <SelectionItem
                key={knowledgeBase.id}
                selected={selectedKnowledgeBaseId === knowledgeBase.id}
                label={knowledgeBase.name}
                onSelect={() => onSelectKnowledgeBase(knowledgeBase.id)}
              />
            ))}
          </CapabilitySubMenu>
          <CapabilitySubMenu
            icon={<GitBranch size={15} className="text-amber-600" />}
            label="Workflow"
            value={workflows.find((item) => item.id === selectedWorkflowId)?.name ?? "未选择"}
          >
            <SelectionItem
              selected={!selectedWorkflowId}
              label="无 Workflow"
              onSelect={() => onSelectWorkflow("")}
            />
            {workflows.length === 0 ? (
              <EmptyState>暂无已启用 Workflow</EmptyState>
            ) : (
              workflows.map((workflow) => (
                <SelectionItem
                  key={workflow.id}
                  selected={workflow.id === selectedWorkflowId}
                  label={workflow.name}
                  onSelect={() => onSelectWorkflow(workflow.id)}
                />
              ))
            )}
          </CapabilitySubMenu>
          <CapabilitySubMenu
            icon={<Wrench size={15} className="text-cyan-700" />}
            label="MCP Servers"
            value={selectedMcpServerCount ? `${selectedMcpServerCount} 个` : "未选择"}
          >
            {mcpConnections.length === 0 ? (
              <EmptyState>暂无已连接 MCP Server</EmptyState>
            ) : (
              mcpConnections.map((connection) => (
                <MultiSelectionItem
                  key={connection.serverId}
                  selected={isMcpServerSelected(connection, selectedMcpToolIds)}
                  disabled={connection.tools.length === 0}
                  label={connection.name}
                  suffix={
                    connection.tools.length > 0 ? `${connection.tools.length} 个工具` : "无工具"
                  }
                  onToggle={() => onToggleMcpServer(connection)}
                />
              ))
            )}
          </CapabilitySubMenu>
          <DropdownMenu.Item
            onSelect={onAddFiles}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-neutral-500 outline-none data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-700"
          >
            <FileUp size={14} className="text-neutral-400" />
            <span>添加文件</span>
            <span className="ml-auto text-[10px] text-neutral-400">文档附件</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onAddWorkspace}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-neutral-500 outline-none data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-700"
          >
            <FolderPlus size={14} className="text-neutral-400" />
            <span>添加工作目录</span>
            <span className="ml-auto text-[10px] text-neutral-400">受控读写</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function CapabilitySummary({
  agentName,
  skills,
  knowledgeBaseName,
  workflowName,
  mcpServers,
  disabled,
  onRemoveAgent,
  onRemoveSkill,
  onRemoveKnowledgeBase,
  onRemoveWorkflow,
  onRemoveMcpServer,
}: {
  agentName?: string | undefined;
  skills: readonly RouteTargetView[];
  knowledgeBaseName?: string | undefined;
  workflowName?: string | undefined;
  mcpServers: readonly McpConnectionView[];
  disabled: boolean;
  onRemoveAgent(): void;
  onRemoveSkill(skillId: string): void;
  onRemoveKnowledgeBase(): void;
  onRemoveWorkflow(): void;
  onRemoveMcpServer(connection: McpConnectionView): void;
}) {
  const hasCapability = Boolean(
    agentName || skills.length > 0 || knowledgeBaseName || workflowName || mcpServers.length,
  );

  return (
    <div
      aria-label="已选能力"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 text-neutral-500"
    >
      {!hasCapability && <span className="truncate text-neutral-400">添加能力</span>}
      {agentName && (
        <SummaryItem
          icon={<Bot size={11} />}
          label={agentName}
          disabled={disabled}
          onRemove={onRemoveAgent}
        />
      )}
      {skills.map((skill) => (
        <SummaryItem
          key={skill.id}
          icon={<Sparkles size={11} />}
          label={skill.name}
          disabled={disabled}
          onRemove={() => onRemoveSkill(skill.id)}
        />
      ))}
      {knowledgeBaseName && (
        <SummaryItem
          icon={<BookOpen size={11} />}
          label={knowledgeBaseName}
          disabled={disabled}
          onRemove={onRemoveKnowledgeBase}
        />
      )}
      {workflowName && (
        <SummaryItem
          icon={<GitBranch size={11} />}
          label={workflowName}
          disabled={disabled}
          onRemove={onRemoveWorkflow}
        />
      )}
      {mcpServers.map((connection) => (
        <SummaryItem
          key={connection.serverId}
          icon={<Wrench size={11} />}
          label={connection.name}
          disabled={disabled}
          onRemove={() => onRemoveMcpServer(connection)}
        />
      ))}
    </div>
  );
}

function MultiSelectionItem({
  selected,
  disabled = false,
  label,
  suffix,
  onToggle,
}: {
  selected: boolean;
  disabled?: boolean;
  label: string;
  suffix?: string | undefined;
  onToggle(): void;
}) {
  return (
    <DropdownMenu.CheckboxItem
      checked={selected}
      disabled={disabled}
      onCheckedChange={() => onToggle()}
      onSelect={(event) => event.preventDefault()}
      className="flex cursor-default items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-neutral-700 outline-none data-[disabled]:opacity-55 data-[highlighted]:bg-neutral-100"
    >
      <Check size={13} className={cn("shrink-0 text-blue-600", !selected && "opacity-0")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {suffix && <span className="text-[10px] text-neutral-400">{suffix}</span>}
    </DropdownMenu.CheckboxItem>
  );
}

function CapabilitySubMenu({
  icon,
  label,
  value,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="flex cursor-default items-center gap-2 rounded-xl px-2.5 py-2.5 text-sm text-neutral-700 outline-none data-[state=open]:bg-neutral-100 data-[highlighted]:bg-neutral-100">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-neutral-50">
          {icon}
        </span>
        <span className="font-medium">{label}</span>
        <span className="ml-auto max-w-32 truncate text-xs text-neutral-400">{value}</span>
        <ChevronRight size={13} className="shrink-0 text-neutral-400" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={7}
          alignOffset={-6}
          className="z-50 max-h-80 w-72 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl shadow-black/10"
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function SelectionItem({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect(): void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex cursor-default items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-neutral-700 outline-none data-[highlighted]:bg-neutral-100"
    >
      <Check size={13} className={cn("shrink-0 text-blue-600", !selected && "opacity-0")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </DropdownMenu.Item>
  );
}

function SummaryItem({
  icon,
  label,
  disabled,
  onRemove,
}: {
  icon: ReactNode;
  label: string;
  disabled: boolean;
  onRemove(): void;
}) {
  return (
    <span
      className="group/summary inline-flex min-w-0 max-w-40 items-center gap-1 rounded-md px-1 py-0.5 transition hover:bg-neutral-200/70"
      title={label}
    >
      <span className="shrink-0 text-neutral-400" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`移除能力 ${label}`}
        className="pointer-events-none -mr-0.5 grid size-4 shrink-0 cursor-pointer place-items-center rounded text-neutral-400 opacity-0 transition hover:bg-white hover:text-neutral-700 focus-visible:pointer-events-auto focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 group-hover/summary:pointer-events-auto group-hover/summary:opacity-100"
      >
        <X size={10} aria-hidden="true" />
      </button>
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-2.5 py-3 text-xs text-neutral-400">{children}</p>;
}
