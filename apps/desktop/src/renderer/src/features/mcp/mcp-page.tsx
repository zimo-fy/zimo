import type { McpConnectionView } from "@zimo/contracts";
import { Badge, Button, Card, cn, Spinner, useAppDialog } from "@zimo/ui";
import {
  BookOpen,
  BriefcaseBusiness,
  Bug,
  CalendarDays,
  Code2,
  CreditCard,
  FileText,
  MapPinned,
  Palette,
  Pencil,
  Plus,
  Search,
  Server,
  RefreshCw,
  Unlink,
  CarFront,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MCP_CATALOG, type McpCatalogEntry, type McpCatalogIcon } from "./mcp-catalog";
import { McpEditorPage } from "./mcp-editor-page";
import {
  buildMcpListItems,
  createCustomMcpEntry,
  type McpConnectionFilter,
} from "./mcp-list-model";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; connections: readonly McpConnectionView[] }
  | { status: "error"; message: string };
type EditorState = { entry: McpCatalogEntry; isNew: boolean };

const connectionFilters: ReadonlyArray<{ value: McpConnectionFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "connected", label: "已连接" },
  { value: "not_connected", label: "未连接" },
];

export function McpPage() {
  const { confirm } = useAppDialog();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [editing, setEditing] = useState<EditorState>();
  const [query, setQuery] = useState("");
  const [connectionFilter, setConnectionFilter] = useState<McpConnectionFilter>("all");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string>();
  const reload = useCallback(async () => {
    const result = await window.zimo.mcp.list(crypto.randomUUID());
    setLoad(
      result.ok
        ? { status: "ready", connections: result.data }
        : { status: "error", message: result.error.message },
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const visibleItems = useMemo(
    () =>
      buildMcpListItems(
        MCP_CATALOG,
        load.status === "ready" ? load.connections : [],
        query,
        connectionFilter,
      ),
    [connectionFilter, load, query],
  );

  async function refresh(serverId: string) {
    setWorking(true);
    const result = await window.zimo.mcp.refresh(crypto.randomUUID(), serverId);
    setWorking(false);
    if (!result.ok) return setNotice(result.error.message);
    setNotice(`工具目录已刷新，共 ${result.data.tools.length} 个工具。`);
    await reload();
  }

  async function disconnect(connection: McpConnectionView) {
    if (!(await confirm(`解绑“${connection.name}”并删除保存的凭据？`))) return;
    setWorking(true);
    const result = await window.zimo.mcp.disconnect(crypto.randomUUID(), connection.serverId);
    setWorking(false);
    if (!result.ok) return setNotice(result.error.message);
    setNotice(`${connection.name} 已解绑。`);
    await reload();
  }

  if (editing) {
    return (
      <McpEditorPage
        entry={editing.entry}
        isNew={editing.isNew}
        onBack={() => setEditing(undefined)}
        onSaved={async (name) => {
          await reload();
          setEditing(undefined);
          setNotice(`${name} 已保存，可在会话、Agent 和 Workflow 中选择。`);
        }}
      />
    );
  }

  return (
    <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge>MCP Registry</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">MCP 服务</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            使用内置服务，或添加支持 Streamable HTTP 的公网 HTTPS MCP Server。
          </p>
        </div>
        <Button onClick={() => setEditing({ entry: createCustomMcpEntry(), isNew: true })}>
          <Plus size={16} /> 新增 MCP
        </Button>
      </header>
      {notice && (
        <p role="status" className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </p>
      )}
      <Card className="mt-7 overflow-hidden">
        <div className="border-b border-neutral-100 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-3 text-neutral-400" size={17} />
              <span className="sr-only">搜索 MCP 服务</span>
              <input
                className="field field-with-leading-icon"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 MCP 名称、描述或地址"
              />
            </label>
            <div className="flex rounded-xl bg-neutral-100 p-1" aria-label="MCP 连接状态筛选">
              {connectionFilters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-medium transition",
                    connectionFilter === option.value
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800",
                  )}
                  onClick={() => setConnectionFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {load.status === "loading" && (
          <div className="grid min-h-72 place-items-center">
            <Spinner />
          </div>
        )}
        {load.status === "error" && (
          <div className="p-10 text-center text-sm text-red-600">{load.message}</div>
        )}
        {load.status === "ready" && visibleItems.length === 0 && (
          <p className="p-12 text-center text-sm text-neutral-400">暂无匹配的 MCP 服务</p>
        )}
        {load.status === "ready" && visibleItems.length > 0 && (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="MCP 服务列表">
            {visibleItems.map(({ entry, connection }) => (
              <McpCard
                key={entry.input.serverId}
                entry={entry}
                {...(connection ? { connection } : {})}
                disabled={working}
                onEdit={() =>
                  setEditing({
                    entry: connection
                      ? { ...entry, input: { ...entry.input, endpoint: connection.endpoint } }
                      : entry,
                    isNew: false,
                  })
                }
                onRefresh={() => connection && void refresh(connection.serverId)}
                onDisconnect={() => connection && void disconnect(connection)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function McpCard({
  entry,
  connection,
  disabled,
  onEdit,
  onRefresh,
  onDisconnect,
}: {
  entry: McpCatalogEntry;
  connection?: McpConnectionView;
  disabled: boolean;
  onEdit(): void;
  onRefresh(): void;
  onDisconnect(): void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
            {renderIcon(entry.icon)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{entry.input.name}</h2>
              <Badge>{connection ? "已连接" : "未连接"}</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-500">{entry.description}</p>
            {connection && (
              <p className="mt-2 text-xs text-neutral-400">
                {connection.tools.length} 个工具 · {connection.serverName}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="secondary"
          aria-label={`编辑${entry.input.name}`}
          disabled={disabled}
          onClick={onEdit}
        >
          <Pencil size={14} />
          编辑
        </Button>
      </div>
      {connection && (
        <div className="mt-4 flex gap-2 border-t border-neutral-100 pt-4">
          <Button variant="secondary" disabled={disabled} onClick={onRefresh}>
            <RefreshCw size={14} />
            刷新
          </Button>
          <Button variant="danger" disabled={disabled} onClick={onDisconnect}>
            <Unlink size={14} />
            解绑
          </Button>
        </div>
      )}
    </Card>
  );
}

function renderIcon(icon: McpCatalogIcon) {
  if (icon === "business") return <BriefcaseBusiness size={19} />;
  if (icon === "code") return <Code2 size={19} />;
  if (icon === "custom") return <Server size={19} />;
  if (icon === "design") return <Palette size={19} />;
  if (icon === "docs") return <FileText size={19} />;
  if (icon === "issues") return <BriefcaseBusiness size={19} />;
  if (icon === "knowledge") return <BookOpen size={19} />;
  if (icon === "map") return <MapPinned size={19} />;
  if (icon === "meeting") return <CalendarDays size={19} />;
  if (icon === "observability") return <Bug size={19} />;
  if (icon === "travel") return <CarFront size={19} />;
  return <CreditCard size={19} />;
}
