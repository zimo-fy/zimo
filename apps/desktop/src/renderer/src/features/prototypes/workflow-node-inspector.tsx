import type { PrototypeSummaryView, ToolCapabilityView } from "@zimo/contracts";
import { Button, cn } from "@zimo/ui";
import { GitBranch, Trash2, X } from "lucide-react";

import { SelectControl } from "../../components/select-control";
import {
  type WorkflowFlowNode,
  type WorkflowNodeConfig,
  type WorkflowNodeData,
  workflowNodeColor,
  workflowNodeTypeLabel,
  renderWorkflowNodeIcon,
} from "./workflow-canvas-model";

export function WorkflowNodeInspector({
  selected,
  nodes,
  agents,
  knowledgeBases,
  skills,
  tools,
  onRemember,
  onClose,
  onUpdate,
  onUpdateConfig,
  onDelete,
}: {
  selected: WorkflowFlowNode | undefined;
  nodes: readonly WorkflowFlowNode[];
  agents: readonly PrototypeSummaryView[];
  knowledgeBases: readonly PrototypeSummaryView[];
  skills: readonly PrototypeSummaryView[];
  tools: readonly ToolCapabilityView[];
  onRemember(): void;
  onClose(): void;
  onUpdate(patch: Partial<WorkflowNodeData>): void;
  onUpdateConfig(patch: Partial<WorkflowNodeConfig>): void;
  onDelete(): void;
}) {
  return (
    <aside className="overflow-y-auto border-l border-neutral-200 bg-white" aria-label="节点配置">
      <div className="flex h-14 items-center justify-between border-b border-neutral-100 px-4">
        <h3 className="text-sm font-semibold text-neutral-900">节点配置</h3>
        {selected && (
          <Button
            variant="ghost"
            className="size-8 min-h-8 px-0"
            aria-label="关闭节点配置"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        )}
      </div>
      {selected ? (
        <div className="p-4">
          <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
            <span
              className={cn(
                "grid size-10 place-items-center rounded-xl",
                workflowNodeColor(selected.data.zimoType),
              )}
            >
              {renderWorkflowNodeIcon(selected.data.zimoType, 18)}
            </span>
            <div>
              <p className="text-sm font-semibold">{selected.data.label}</p>
              <p className="mt-0.5 text-xs text-neutral-400">
                {workflowNodeTypeLabel(selected.data.zimoType)}
              </p>
            </div>
          </div>
          <label className="mt-5 block text-xs font-medium text-neutral-600">
            显示名称
            <input
              className="field mt-2"
              value={selected.data.label}
              onFocus={onRemember}
              onChange={(event) => onUpdate({ label: event.target.value })}
            />
          </label>
          {selected.data.zimoType === "agent" && (
            <SelectConfig
              label="选择 Agent"
              value={selected.data.config.agentId ?? ""}
              items={agents}
              emptyText="暂无已启用 Agent"
              onFocus={onRemember}
              onChange={(agentId) => onUpdateConfig({ agentId })}
            />
          )}
          {selected.data.zimoType === "knowledge" && (
            <>
              <SelectConfig
                label="选择知识库"
                value={selected.data.config.knowledgeBaseId ?? ""}
                items={knowledgeBases}
                emptyText="暂无已启用知识库"
                onFocus={onRemember}
                onChange={(knowledgeBaseId) => onUpdateConfig({ knowledgeBaseId })}
              />
              <NumberConfig
                label="返回条数"
                value={selected.data.config.topK ?? 5}
                onFocus={onRemember}
                onChange={(topK) => onUpdateConfig({ topK })}
              />
            </>
          )}
          {selected.data.zimoType === "skill" && (
            <SelectConfig
              label="选择 Skill"
              value={selected.data.config.skillId ?? ""}
              items={skills}
              emptyText="暂无已启用 Skill"
              onFocus={onRemember}
              onChange={(skillId) => onUpdateConfig({ skillId })}
            />
          )}
          {selected.data.zimoType === "tool" && (
            <>
              <div className="mt-4 grid gap-2 text-xs font-medium text-neutral-600">
                选择受控 Tool
                <SelectControl
                  ariaLabel="选择受控 Tool"
                  value={selected.data.config.toolId ?? ""}
                  options={[
                    { value: "", label: tools.length ? "请选择" : "暂无已注册 Tool" },
                    ...tools.map((tool) => ({ value: tool.id, label: tool.title })),
                  ]}
                  onOpenChange={(open) => {
                    if (open) onRemember();
                  }}
                  onValueChange={(toolId) => onUpdateConfig({ toolId })}
                />
              </div>
              {selected.data.config.toolId === "zimo.knowledge.search" && (
                <>
                  <SelectConfig
                    label="允许检索的知识库"
                    value={selected.data.config.knowledgeBaseId ?? ""}
                    items={knowledgeBases}
                    emptyText="暂无已启用知识库"
                    onFocus={onRemember}
                    onChange={(knowledgeBaseId) => onUpdateConfig({ knowledgeBaseId })}
                  />
                  <NumberConfig
                    label="最大返回条数"
                    value={selected.data.config.topK ?? 5}
                    onFocus={onRemember}
                    onChange={(topK) => onUpdateConfig({ topK })}
                  />
                </>
              )}
              {selected.data.config.toolId === "mcp.github.search_repositories" && (
                <NumberConfig
                  label="最大返回仓库数"
                  value={selected.data.config.topK ?? 5}
                  onFocus={onRemember}
                  onChange={(topK) => onUpdateConfig({ topK })}
                />
              )}
            </>
          )}
          {selected.data.zimoType === "condition" && (
            <TextConfig
              label="条件表达式"
              value={selected.data.config.expression ?? ""}
              className="font-mono text-xs"
              placeholder="例如：input contains '退款'"
              onFocus={onRemember}
              onChange={(expression) => onUpdateConfig({ expression })}
            />
          )}
          {selected.data.zimoType === "approval" && (
            <TextConfig
              label="确认说明"
              value={selected.data.config.instruction ?? ""}
              placeholder="告诉用户需要确认什么"
              onFocus={onRemember}
              onChange={(instruction) => onUpdateConfig({ instruction })}
            />
          )}
          {selected.data.zimoType === "start" && (
            <StringConfig
              label="输入变量"
              value={selected.data.config.outputKey ?? "userInput"}
              onFocus={onRemember}
              onChange={(outputKey) => onUpdateConfig({ outputKey })}
            />
          )}
          {selected.data.zimoType === "end" && (
            <StringConfig
              label="输出变量"
              value={selected.data.config.inputKey ?? "result"}
              onFocus={onRemember}
              onChange={(inputKey) => onUpdateConfig({ inputKey })}
            />
          )}
          {!["start", "end"].includes(selected.data.zimoType) && (
            <TextConfig
              label="补充指令"
              value={selected.data.config.instruction ?? ""}
              placeholder="该节点执行时需要遵循的说明"
              onFocus={onRemember}
              onChange={(instruction) => onUpdateConfig({ instruction })}
            />
          )}
          <div className="mt-6 border-t border-neutral-100 pt-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600"
              disabled={
                selected.data.zimoType === "start" ||
                (selected.data.zimoType === "end" &&
                  nodes.filter((node) => node.data.zimoType === "end").length === 1)
              }
              onClick={onDelete}
            >
              <Trash2 size={15} /> 删除节点
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid h-[calc(100%-3.5rem)] place-items-center p-8 text-center">
          <div>
            <GitBranch className="mx-auto text-neutral-300" size={28} />
            <p className="mt-3 text-sm text-neutral-500">选择画布中的节点</p>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              配置节点引用、输入输出和执行说明。
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

function SelectConfig({
  label,
  value,
  items,
  emptyText,
  onFocus,
  onChange,
}: {
  label: string;
  value: string;
  items: readonly PrototypeSummaryView[];
  emptyText: string;
  onFocus(): void;
  onChange(value: string): void;
}) {
  return (
    <div className="mt-4 grid gap-2 text-xs font-medium text-neutral-600">
      {label}
      <SelectControl
        ariaLabel={label}
        value={value}
        options={[
          { value: "", label: items.length ? "请选择" : emptyText },
          ...items.map((item) => ({ value: item.id, label: item.name })),
        ]}
        onOpenChange={(open) => {
          if (open) onFocus();
        }}
        onValueChange={onChange}
      />
    </div>
  );
}

function NumberConfig({
  label,
  value,
  onFocus,
  onChange,
}: {
  label: string;
  value: number;
  onFocus(): void;
  onChange(value: number): void;
}) {
  return (
    <label className="mt-4 block text-xs font-medium text-neutral-600">
      {label}
      <input
        className="field mt-2"
        type="number"
        min={1}
        max={8}
        value={value}
        onFocus={onFocus}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function StringConfig({
  label,
  value,
  onFocus,
  onChange,
}: {
  label: string;
  value: string;
  onFocus(): void;
  onChange(value: string): void;
}) {
  return (
    <label className="mt-4 block text-xs font-medium text-neutral-600">
      {label}
      <input
        className="field mt-2 font-mono text-sm"
        value={value}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextConfig({
  label,
  value,
  className,
  placeholder,
  onFocus,
  onChange,
}: {
  label: string;
  value: string;
  className?: string;
  placeholder: string;
  onFocus(): void;
  onChange(value: string): void;
}) {
  return (
    <label className="mt-4 block text-xs font-medium text-neutral-600">
      {label}
      <textarea
        className={cn("field mt-2 min-h-24 py-3 text-sm", className)}
        value={value}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
