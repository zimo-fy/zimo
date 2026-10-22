import type { AgentCatalogItemView, PrototypeSummaryView } from "@zimo/contracts";
import { Button, Card, cn, Spinner } from "@zimo/ui";
import { Download, Edit3, MessageSquare, Power, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CatalogCategoryFilter } from "./catalog-category-filter";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: AgentCatalogItemView[] }
  | { status: "error"; message: string };
type LocalLoadState =
  | { status: "loading" }
  | { status: "ready"; items: PrototypeSummaryView[] }
  | { status: "error"; message: string };
type InstallationFilter = "all" | "installed" | "not_installed";
type UnifiedAgentItem =
  { kind: "local"; value: PrototypeSummaryView } | { kind: "catalog"; value: AgentCatalogItemView };

const emptyItems: AgentCatalogItemView[] = [];
const filters: ReadonlyArray<{ value: InstallationFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "installed", label: "已安装" },
  { value: "not_installed", label: "未安装" },
];

export function AgentMarketplaceSection({
  localLoad,
  onChanged,
  onDelete,
  onEdit,
  onRetryLocal,
  onToggleStatus,
  onUseAgent,
  onCategoriesChange,
}: {
  localLoad: LocalLoadState;
  onChanged(): void;
  onDelete(item: PrototypeSummaryView): void;
  onEdit(agentId: string): void;
  onRetryLocal(): void;
  onToggleStatus(item: PrototypeSummaryView): void;
  onUseAgent(agentId: string): void;
  onCategoriesChange(categories: readonly string[]): void;
}) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [installation, setInstallation] = useState<InstallationFilter>("all");
  const [workingId, setWorkingId] = useState<string>();
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string }>();

  const reload = useCallback(async () => {
    setLoad({ status: "loading" });
    const result = await window.zimo.agents.listCatalog(crypto.randomUUID());
    setLoad(
      result.ok
        ? { status: "ready", items: result.data }
        : { status: "error", message: result.error.message },
    );
  }, []);

  useEffect(() => {
    let active = true;
    void window.zimo.agents.listCatalog(crypto.randomUUID()).then((result) => {
      if (!active) return;
      setLoad(
        result.ok
          ? { status: "ready", items: result.data }
          : { status: "error", message: result.error.message },
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const catalogItems = load.status === "ready" ? load.items : emptyItems;
  const catalogVersionByInstalledId = useMemo(() => {
    const versions = new Map<string, string>();
    for (const item of catalogItems) {
      if (item.installedAgentId) versions.set(item.installedAgentId, item.version);
    }
    return versions;
  }, [catalogItems]);
  const items = useMemo<UnifiedAgentItem[]>(() => {
    const localItems = localLoad.status === "ready" ? localLoad.items : [];
    return [
      ...localItems.map((value) => ({ kind: "local" as const, value })),
      ...catalogItems
        .filter((value) => !value.installedAgentId)
        .map((value) => ({ kind: "catalog" as const, value })),
    ];
  }, [catalogItems, localLoad]);
  const categories = useMemo(
    () => ["全部", ...new Set(items.map((item) => item.value.category || "未分类"))],
    [items],
  );
  useEffect(() => {
    onCategoriesChange(categories.slice(1));
  }, [categories, onCategoriesChange]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return items.filter((item) => {
      const value = item.value;
      const itemCategory = value.category || "未分类";
      const itemInstallation = item.kind === "local" ? "installed" : "not_installed";
      return (
        (category === "全部" || itemCategory === category) &&
        (installation === "all" || itemInstallation === installation) &&
        (!normalizedQuery ||
          `${value.name} ${value.description} ${itemCategory}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedQuery))
      );
    });
  }, [category, installation, items, query]);

  async function install(item: AgentCatalogItemView): Promise<void> {
    setWorkingId(item.catalogId);
    setNotice(undefined);
    const result = await window.zimo.agents.install(crypto.randomUUID(), item.catalogId);
    setWorkingId(undefined);
    if (!result.ok) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    setNotice({ type: "success", message: `“${result.data.name}”已安装，可用于会话和工作流。` });
    await reload();
    onChanged();
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-neutral-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-72 flex-wrap justify-end gap-2">
            <label className="relative min-w-82 max-w-md flex-1">
              <Search className="absolute left-3 top-3 text-neutral-400" size={17} />
              <span className="sr-only">搜索 Agent 人才库</span>
              <input
                className="field field-with-leading-icon"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 Agent 名称、描述或分类"
              />
            </label>
            <div className="flex rounded-xl bg-neutral-100 p-1" aria-label="Agent 安装状态筛选">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-medium transition",
                    installation === filter.value
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800",
                  )}
                  onClick={() => setInstallation(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <CatalogCategoryFilter
          ariaLabel="Agent 分类"
          categories={categories}
          selected={category}
          onSelect={setCategory}
        />
      </div>
      {notice && (
        <p
          role="status"
          className={cn(
            "mx-4 mt-4 rounded-xl px-4 py-3 text-sm",
            notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}
        >
          {notice.message}
        </p>
      )}
      {load.status === "error" && (
        <div className="mx-4 mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          <p>{load.message}</p>
          <Button className="mt-2" variant="secondary" onClick={() => void reload()}>
            <RefreshCw size={14} /> 重试
          </Button>
        </div>
      )}
      {localLoad.status === "error" && (
        <div className="mx-4 mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          <p>{localLoad.message}</p>
          <Button className="mt-2" variant="secondary" onClick={onRetryLocal}>
            <RefreshCw size={14} /> 重试本机 Agent
          </Button>
        </div>
      )}
      {(load.status === "loading" || localLoad.status === "loading") && items.length === 0 && (
        <div className="grid min-h-40 place-items-center">
          <Spinner />
        </div>
      )}
      {load.status !== "loading" && localLoad.status !== "loading" && visibleItems.length === 0 && (
        <p className="p-10 text-center text-sm text-neutral-400">暂无匹配的 Agent</p>
      )}
      {visibleItems.length > 0 && (
        <div
          className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="Agents列表"
        >
          {visibleItems.map((item) =>
            item.kind === "local" ? (
              <LocalAgentCard
                key={`local:${item.value.id}`}
                item={item.value}
                version={catalogVersionByInstalledId.get(item.value.id) ?? item.value.version}
                onDelete={() => onDelete(item.value)}
                onEdit={() => onEdit(item.value.id)}
                onToggleStatus={() => onToggleStatus(item.value)}
                onUse={() => onUseAgent(item.value.id)}
              />
            ) : (
              <CatalogAgentCard
                key={`catalog:${item.value.catalogId}`}
                item={item.value}
                working={workingId === item.value.catalogId}
                onInstall={() => void install(item.value)}
              />
            ),
          )}
        </div>
      )}
    </Card>
  );
}

function CatalogAgentCard({
  item,
  working,
  onInstall,
}: {
  item: AgentCatalogItemView;
  working: boolean;
  onInstall(): void;
}) {
  return (
    <article className="flex min-h-40 flex-col rounded-xl border border-neutral-200 bg-white p-3.5 transition hover:border-neutral-300 hover:shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-sm text-violet-700">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-5">{item.name}</span>
          <span className="mt-0.5 block truncate text-xs text-neutral-400">
            {item.category} · v{item.version}
          </span>
        </span>
        <span className="rounded-md bg-neutral-100 px-1.5 py-1 text-[11px] text-neutral-500">
          未安装
        </span>
      </div>
      <p className="mt-2.5 line-clamp-2 text-xs leading-[18px] text-neutral-500">
        {item.description || "暂无描述"}
      </p>
      <div className="mt-auto flex justify-end gap-1 border-t border-neutral-100 pt-2.5">
        <Button className="min-h-7 gap-1 px-2.5 text-[11px]" disabled={working} onClick={onInstall}>
          <Download size={12} /> {working ? "安装中…" : "安装"}
        </Button>
      </div>
    </article>
  );
}

function LocalAgentCard({
  item,
  version,
  onDelete,
  onEdit,
  onToggleStatus,
  onUse,
}: {
  item: PrototypeSummaryView;
  version: string;
  onDelete(): void;
  onEdit(): void;
  onToggleStatus(): void;
  onUse(): void;
}) {
  return (
    <article className="flex min-h-40 flex-col rounded-xl border border-neutral-200 bg-white p-3.5 transition hover:border-neutral-300 hover:shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-sm text-violet-700">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-5">{item.name}</span>
          <span className="mt-0.5 block truncate text-xs text-neutral-400">
            {item.category || "未分类"} · v{version}
          </span>
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-1 text-[11px]",
            item.status === "enabled"
              ? "bg-emerald-50 text-emerald-700"
              : item.status === "draft"
                ? "bg-amber-50 text-amber-700"
                : "bg-neutral-100 text-neutral-500",
          )}
        >
          {item.status === "enabled" ? "已启用" : item.status === "draft" ? "草稿" : "已禁用"}
        </span>
      </div>
      <p className="mt-2.5 line-clamp-2 text-xs leading-[18px] text-neutral-500">
        {item.description || "暂无描述"}
      </p>
      <div className="mt-auto flex items-center border-t border-neutral-100 pt-2.5">
        <Button variant="ghost" className="min-h-7 gap-1 px-2 text-[11px]" onClick={onEdit}>
          <Edit3 size={12} /> 编辑
        </Button>
        {item.status === "enabled" && (
          <Button variant="ghost" className="min-h-7 gap-1 px-2 text-[11px]" onClick={onUse}>
            <MessageSquare size={12} /> 使用
          </Button>
        )}
        <span className="ml-auto flex">
          <Button
            variant="ghost"
            className="size-7 min-h-7 px-0"
            aria-label={`${item.status === "enabled" ? "禁用" : "启用"}${item.name}`}
            onClick={onToggleStatus}
          >
            <Power size={12} />
          </Button>
          <Button
            variant="ghost"
            className="size-7 min-h-7 px-0 text-red-500 hover:bg-red-50 hover:text-red-700"
            aria-label={`${item.installationStatus === "installed" ? "卸载" : "删除"}${item.name}`}
            onClick={onDelete}
          >
            <Trash2 size={12} />
          </Button>
        </span>
      </div>
    </article>
  );
}
