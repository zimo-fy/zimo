import type { SkillCatalogItemView } from "@zimo/contracts";
import { Badge, Button, Card, cn, Spinner, useAppDialog } from "@zimo/ui";
import { Download, PackageOpen, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CatalogCategoryFilter } from "./catalog-category-filter";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: SkillCatalogItemView[] }
  | { status: "error"; message: string };

type InstallationFilter = "all" | "installed" | "not_installed";

const installationFilters: ReadonlyArray<{ value: InstallationFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "installed", label: "已安装" },
  { value: "not_installed", label: "未安装" },
];
const emptyItems: SkillCatalogItemView[] = [];

export function SkillMarketplacePage() {
  const { confirm } = useAppDialog();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [installation, setInstallation] = useState<InstallationFilter>("all");
  const [workingId, setWorkingId] = useState<string>();
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string }>();

  const reload = useCallback(async () => {
    setLoad({ status: "loading" });
    const result = await window.zimo.skills.listCatalog(crypto.randomUUID());
    setLoad(
      result.ok
        ? { status: "ready", items: result.data }
        : { status: "error", message: result.error.message },
    );
  }, []);

  useEffect(() => {
    let active = true;
    void window.zimo.skills.listCatalog(crypto.randomUUID()).then((result) => {
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

  const items = load.status === "ready" ? load.items : emptyItems;
  const categories = useMemo(
    () => ["全部", ...new Set(items.map((item) => item.category))],
    [items],
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return items
      .filter(
        (item) =>
          (category === "全部" || item.category === category) &&
          (installation === "all" || item.installationStatus === installation) &&
          (!normalizedQuery ||
            `${item.name} ${item.description} ${item.category}`
              .toLocaleLowerCase("zh-CN")
              .includes(normalizedQuery)),
      )
      .sort((left, right) => {
        if (left.installationStatus === right.installationStatus) return 0;
        return left.installationStatus === "installed" ? -1 : 1;
      });
  }, [category, installation, items, query]);

  async function install(item: SkillCatalogItemView) {
    setWorkingId(item.catalogId);
    setNotice(undefined);
    const result = await window.zimo.skills.install(crypto.randomUUID(), item.catalogId);
    setWorkingId(undefined);
    if (!result.ok) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    setNotice({
      type: "success",
      message: `“${result.data.name}”安装完成，包内脚本已同步，可以绑定到会话、Agent 或 Workflow。`,
    });
    await reload();
  }

  async function uninstall(item: SkillCatalogItemView) {
    if (!item.installedSkillId || !(await confirm(`卸载“${item.name}”？`))) return;
    setWorkingId(item.catalogId);
    setNotice(undefined);
    const result = await window.zimo.skills.uninstall(crypto.randomUUID(), item.installedSkillId);
    setWorkingId(undefined);
    if (!result.ok) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    setNotice({ type: "success", message: `“${item.name}”已卸载。` });
    await reload();
  }

  async function installLocal() {
    setNotice(undefined);
    const result = await window.zimo.skills.installLocal(crypto.randomUUID());
    if (!result.ok) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    if (!result.data) return;
    setNotice({ type: "success", message: `“${result.data.name}”已安装。` });
    await reload();
  }

  return (
    <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge>Skill Store</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Skills</h1>
          <p className="mt-2 text-sm text-neutral-500">
            浏览 Zimo Skill Store；安装后即可绑定到 Agent、会话和工作流。
          </p>
        </div>
        <Button variant="secondary" onClick={() => void installLocal()}>
          <PackageOpen size={16} /> 从本地文件夹安装
        </Button>
      </header>

      {notice && (
        <p
          role="status"
          className={cn(
            "mt-5 rounded-xl px-4 py-3 text-sm",
            notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}
        >
          {notice.message}
        </p>
      )}

      <Card className="mt-7 overflow-hidden">
        <div className="border-b border-neutral-100 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-3 text-neutral-400" size={17} />
              <span className="sr-only">搜索 Skills</span>
              <input
                className="field field-with-leading-icon"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 Skill 名称、描述或分类"
              />
            </label>
            <div className="flex rounded-xl bg-neutral-100 p-1" aria-label="安装状态筛选">
              {installationFilters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-medium transition",
                    installation === option.value
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800",
                  )}
                  onClick={() => setInstallation(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <CatalogCategoryFilter
            ariaLabel="Skill 分类"
            categories={categories}
            selected={category}
            onSelect={setCategory}
          />
        </div>

        {load.status === "loading" && (
          <div className="grid min-h-72 place-items-center">
            <Spinner />
          </div>
        )}
        {load.status === "error" && (
          <div className="p-10 text-center text-sm text-red-600">
            <p>{load.message}</p>
            <Button className="mt-4" variant="secondary" onClick={() => void reload()}>
              重试
            </Button>
          </div>
        )}
        {load.status === "ready" && visibleItems.length === 0 && (
          <p className="p-12 text-center text-sm text-neutral-400">暂无匹配的 Skill</p>
        )}
        {load.status === "ready" && visibleItems.length > 0 && (
          <div
            className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
            aria-label="Skills列表"
          >
            {visibleItems.map((item) => (
              <SkillCard
                key={item.catalogId}
                item={item}
                working={workingId === item.catalogId}
                onInstall={() => void install(item)}
                onUninstall={() => void uninstall(item)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SkillCard({
  item,
  working,
  onInstall,
  onUninstall,
}: {
  item: SkillCatalogItemView;
  working: boolean;
  onInstall(): void;
  onUninstall(): void;
}) {
  const installed = item.installationStatus === "installed";
  return (
    <article className="flex min-h-40 flex-col rounded-xl border border-neutral-200 bg-white p-3.5 transition hover:border-neutral-300 hover:shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sm font-semibold text-sky-700">
          {item.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-5">{item.name}</span>
          <span className="mt-0.5 block truncate text-xs text-neutral-400">
            {item.category} · v{item.version}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-1 text-xs font-medium leading-none",
            installed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500",
          )}
        >
          {installed ? "已安装" : "未安装"}
        </span>
      </div>
      <p className="mt-2.5 line-clamp-2 text-xs leading-[18px] text-neutral-500">
        {item.description || "暂无描述"}
      </p>
      <div className="mt-auto flex justify-end border-t border-neutral-100 pt-2.5">
        {installed ? (
          <div className="flex items-center gap-1">
            {!item.catalogId.startsWith("local:") && (
              <Button
                variant="ghost"
                className="min-h-7 gap-1.5 rounded-lg bg-neutral-100 px-2 text-[11px] text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                disabled={working}
                onClick={onInstall}
              >
                <RefreshCw size={12} /> {working ? "同步中…" : "重新安装"}
              </Button>
            )}
            <Button
              variant="ghost"
              className="min-h-7 gap-1.5 rounded-lg px-2 text-[11px] text-red-500 hover:bg-red-50 hover:text-red-700"
              disabled={working}
              onClick={onUninstall}
            >
              <Trash2 size={12} /> 卸载
            </Button>
          </div>
        ) : (
          <Button
            className="min-h-7 gap-1.5 rounded-lg px-2.5 text-[11px] shadow-sm"
            disabled={working}
            onClick={onInstall}
          >
            <Download size={12} /> {working ? "安装中…" : "安装"}
          </Button>
        )}
      </div>
    </article>
  );
}
