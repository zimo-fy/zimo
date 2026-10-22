import type { PrototypeKindDto, PrototypeSummaryView } from "@zimo/contracts";
import { Badge, Button, Card, cn, Spinner } from "@zimo/ui";
import { Edit3, MessageSquare, Play, Power, Search, Settings2, Trash2 } from "lucide-react";

import { SelectControl } from "../../components/select-control";

type PrototypeStatusFilter = "all" | "draft" | "enabled" | "disabled";

type PrototypeListGridProps = {
  kind: PrototypeKindDto;
  title: string;
  query: string;
  status: PrototypeStatusFilter;
  load:
    | { status: "loading" }
    | { status: "ready"; items: PrototypeSummaryView[] }
    | { status: "error"; message: string };
  onQueryChange(value: string): void;
  onStatusChange(value: PrototypeStatusFilter): void;
  onEdit(id: string): void;
  onManage(id: string): void;
  onContextAction(item: PrototypeSummaryView): void;
  onUseAgent(id: string): void;
  onToggleStatus(item: PrototypeSummaryView): void;
  onDelete(item: PrototypeSummaryView): void;
  onRetry(): void;
};

const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "enabled", label: "已启用" },
  { value: "disabled", label: "已禁用" },
] as const;

export function PrototypeListGrid({
  kind,
  title,
  query,
  status,
  load,
  onQueryChange,
  onStatusChange,
  onEdit,
  onManage,
  onContextAction,
  onUseAgent,
  onToggleStatus,
  onDelete,
  onRetry,
}: PrototypeListGridProps) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-3 border-b border-neutral-100 p-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-center">
        <label className="relative block">
          <Search className="absolute left-3 top-3 text-neutral-400" size={17} />
          <span className="sr-only">搜索{title}</span>
          <input
            className="field field-with-leading-icon"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索名称、描述或标签"
          />
        </label>
        <SelectControl
          ariaLabel="状态筛选"
          value={status}
          options={statusOptions}
          onValueChange={(value) => onStatusChange(value as PrototypeStatusFilter)}
        />
        <p className="min-w-20 text-right text-sm text-neutral-400">
          {load.status === "ready" ? `共 ${load.items.length} 项` : "加载中"}
        </p>
      </div>

      {load.status === "loading" && (
        <div className="grid min-h-44 place-items-center">
          <Spinner />
        </div>
      )}
      {load.status === "error" && (
        <div className="p-8 text-center text-sm text-red-600">
          <p>{load.message}</p>
          <Button className="mt-4" variant="secondary" onClick={onRetry}>
            重试
          </Button>
        </div>
      )}
      {load.status === "ready" && load.items.length === 0 && (
        <p className="p-10 text-center text-sm text-neutral-400">暂无匹配项目</p>
      )}
      {load.status === "ready" && load.items.length > 0 && (
        <div
          className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          aria-label={`${title}列表`}
        >
          {load.items.map((item) => (
            <article
              key={item.id}
              className="group flex min-h-52 flex-col rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-lg">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.name}</span>
                  <span className="mt-1 block text-xs text-neutral-400">
                    {item.category || "未分类"} · v{item.version}
                  </span>
                </span>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-neutral-500">
                {item.description || "暂无描述"}
              </p>
              <div className="mt-3 flex min-h-6 gap-1.5 overflow-hidden">
                {item.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} className="max-w-24 truncate">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-neutral-100 pt-3">
                <Button
                  variant="ghost"
                  className="min-h-8 px-2.5 text-xs"
                  onClick={() => onEdit(item.id)}
                >
                  <Edit3 size={14} /> 编辑
                </Button>
                {(kind === "knowledge" || kind === "workflow") && (
                  <Button
                    variant="ghost"
                    className="min-h-8 px-2.5 text-xs"
                    onClick={() => onManage(item.id)}
                  >
                    <Settings2 size={14} /> {kind === "knowledge" ? "文档" : "编排"}
                  </Button>
                )}
                {kind === "agent" && item.status === "enabled" && (
                  <Button
                    variant="ghost"
                    className="min-h-8 px-2.5 text-xs"
                    onClick={() => onUseAgent(item.id)}
                  >
                    <MessageSquare size={14} /> 使用
                  </Button>
                )}
                {(kind === "plugin" || kind === "mcp" || kind === "automation") && (
                  <Button
                    variant="ghost"
                    className="min-h-8 px-2.5 text-xs"
                    onClick={() => onContextAction(item)}
                  >
                    <Play size={14} />{" "}
                    {kind === "plugin"
                      ? item.installationStatus === "not_installed"
                        ? "安装"
                        : "卸载"
                      : kind === "mcp"
                        ? "测试"
                        : "运行记录"}
                  </Button>
                )}
                <span className="ml-auto flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    className="size-8 min-h-8 px-0"
                    aria-label={`${item.status === "enabled" ? "禁用" : "启用"}${item.name}`}
                    title={item.status === "enabled" ? "禁用" : "启用"}
                    onClick={() => onToggleStatus(item)}
                  >
                    <Power size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="size-8 min-h-8 px-0 text-red-600"
                    aria-label={`删除${item.name}`}
                    title="删除"
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: PrototypeSummaryView["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium",
        status === "enabled" && "bg-emerald-50 text-emerald-700",
        status === "disabled" && "bg-neutral-100 text-neutral-500",
        status === "draft" && "bg-amber-50 text-amber-700",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "enabled"
            ? "bg-emerald-500"
            : status === "disabled"
              ? "bg-neutral-400"
              : "bg-amber-400",
        )}
      />
      {status === "enabled" ? "已启用" : status === "disabled" ? "已禁用" : "草稿"}
    </span>
  );
}
