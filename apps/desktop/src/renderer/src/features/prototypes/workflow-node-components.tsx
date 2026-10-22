import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@zimo/ui";
import { Check, LoaderCircle, Search } from "lucide-react";

import {
  type NodeKind,
  type WorkflowFlowNode,
  workflowNodeCatalog,
  workflowNodeColor,
  workflowNodeSummary,
  renderWorkflowNodeIcon,
} from "./workflow-canvas-model";

export function WorkflowNodeLibrary({
  items,
  query,
  hasStart,
  onQueryChange,
  onAdd,
}: {
  items: typeof workflowNodeCatalog;
  query: string;
  hasStart: boolean;
  onQueryChange(value: string): void;
  onAdd(type: NodeKind): void;
}) {
  return (
    <aside className="overflow-y-auto border-r border-neutral-200 bg-white p-4" aria-label="节点库">
      <h3 className="text-sm font-semibold text-neutral-900">添加节点</h3>
      <p className="mt-1 text-xs leading-5 text-neutral-400">
        选择节点加入画布，再通过端口建立连接。
      </p>
      <label className="relative mt-4 block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          size={15}
          aria-hidden="true"
        />
        <span className="sr-only">搜索节点</span>
        <input
          className="field field-with-leading-icon h-9 min-h-9 text-sm"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索节点"
        />
      </label>
      {["系统", "AI 能力", "逻辑"].map((category) => {
        const categoryItems = items.filter((item) => item.category === category);
        if (!categoryItems.length) return null;
        return (
          <section key={category} className="mt-5">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              {category}
            </h4>
            <div className="grid gap-2">
              {categoryItems.map((item) => {
                const Icon = item.icon;
                const disabled = item.type === "start" && hasStart;
                return (
                  <button
                    key={item.type}
                    type="button"
                    disabled={disabled}
                    onClick={() => onAdd(item.type)}
                    className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg",
                        workflowNodeColor(item.type),
                      )}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-800">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-400">
                        {disabled ? "已在画布中" : item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </aside>
  );
}

export function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  return (
    <div
      className={cn(
        "w-56 overflow-hidden rounded-2xl border bg-white shadow-sm transition",
        data.runtimeStatus === "running" && "border-amber-400 ring-2 ring-amber-300/30",
        data.runtimeStatus === "completed" && "border-emerald-400 ring-2 ring-emerald-300/20",
        data.runtimeStatus === "failed" && "border-red-400 ring-2 ring-red-300/20",
        data.runtimeStatus === "skipped" && "opacity-50",
        selected
          ? "border-neutral-900 shadow-lg ring-2 ring-neutral-900/10"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-md",
      )}
    >
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-white !bg-neutral-400"
      />
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!size-3 !border-2 !border-white !bg-neutral-400"
      />
      <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-xl",
            workflowNodeColor(data.zimoType),
          )}
        >
          {renderWorkflowNodeIcon(data.zimoType, 17)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{data.label}</p>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            {workflowNodeCatalog.find((item) => item.type === data.zimoType)?.category ?? "节点"}
          </p>
        </div>
        {data.runtimeStatus === "running" && (
          <LoaderCircle className="animate-spin text-amber-500" size={15} />
        )}
        {data.runtimeStatus === "completed" && <Check className="text-emerald-600" size={15} />}
      </div>
      <div className="px-4 py-3">
        <p className="truncate text-xs text-neutral-500">{workflowNodeSummary(data)}</p>
        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-400">
          <span>{data.zimoType === "start" ? "Input" : "In"}</span>
          <span>{data.zimoType === "end" ? "Output" : "Out"}</span>
        </div>
      </div>
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-white !bg-neutral-700"
      />
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!size-3 !border-2 !border-white !bg-neutral-700"
      />
    </div>
  );
}
