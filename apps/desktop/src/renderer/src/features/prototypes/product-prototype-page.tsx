import type {
  ModelProviderView,
  McpConnectionView,
  PrototypeDetailView,
  PrototypeKindDto,
  PrototypeSummaryView,
} from "@zimo/contracts";
import { Badge, Button, Card, useAppDialog } from "@zimo/ui";
import { ChevronLeft, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { KnowledgeManagement } from "./knowledge-management";
import { AgentMarketplaceSection } from "./agent-marketplace-section";
import { PrototypeEditor } from "./prototype-editor";
import { PrototypeListGrid } from "./prototype-list-grid";
import { SkillMarketplacePage } from "./skill-marketplace-page";
import { WorkflowCanvas } from "./workflow-canvas";
import { AutomationPage } from "../automations/automation-page";

const metadata: Record<
  PrototypeKindDto,
  { title: string; description: string; createLabel: string }
> = {
  agent: {
    title: "Agents",
    description: "配置模型、指令、能力绑定与权限策略。",
    createLabel: "新建 Agent",
  },
  skill: {
    title: "Skills",
    description: "安装并管理安全的 instruction Skill 能力包。",
    createLabel: "新建 Skill",
  },
  knowledge: {
    title: "知识库",
    description: "导入本地文档，并使用全文与本地语义检索。",
    createLabel: "新建知识库",
  },
  workflow: {
    title: "工作流",
    description: "用节点编排 Agent、Skill 与知识检索流程。",
    createLabel: "新建工作流",
  },
  plugin: {
    title: "Plugins",
    description: "查看可发现扩展及 Mock 安装状态。",
    createLabel: "新建 Plugin",
  },
  mcp: {
    title: "MCP Servers",
    description: "管理连接配置与能力摘要原型。",
    createLabel: "新建 Server",
  },
  automation: {
    title: "Automations",
    description: "配置触发器、目标和运行历史原型。",
    createLabel: "新建 Automation",
  },
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: PrototypeSummaryView[] }
  | { status: "error"; message: string };
type PageMode = "list" | "editor" | "manage";

export function ProductPrototypePage({
  kind,
  onUseAgent,
}: {
  kind: PrototypeKindDto;
  onUseAgent(agentId: string): void;
}) {
  if (kind === "skill") return <SkillMarketplacePage />;
  if (kind === "automation") return <AutomationPage />;
  return <PrototypeCatalogPage key={kind} kind={kind} onUseAgent={onUseAgent} />;
}

function PrototypeCatalogPage({
  kind,
  onUseAgent,
}: {
  kind: Exclude<PrototypeKindDto, "skill">;
  onUseAgent(agentId: string): void;
}) {
  const { confirm } = useAppDialog();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [detail, setDetail] = useState<PrototypeDetailView>();
  const [mode, setMode] = useState<PageMode>("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "enabled" | "disabled">("all");
  const [notice, setNotice] = useState<string>();
  const [agentModels, setAgentModels] = useState<ModelProviderView["models"]>([]);
  const [availableSkills, setAvailableSkills] = useState<PrototypeSummaryView[]>([]);
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<PrototypeSummaryView[]>(
    [],
  );
  const [availableMcpServers, setAvailableMcpServers] = useState<readonly McpConnectionView[]>([]);
  const [agentCategories, setAgentCategories] = useState<readonly string[]>([]);

  const reload = useCallback(async () => {
    setLoad({ status: "loading" });
    const result = await window.zimo.prototypes.list(crypto.randomUUID(), {
      kind,
      ...(query.trim() ? { query } : {}),
      ...(status !== "all" ? { status } : {}),
    });
    setLoad(
      result.ok
        ? { status: "ready", items: result.data }
        : { status: "error", message: result.error.message },
    );
  }, [kind, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    if (kind !== "agent" && kind !== "workflow") return;
    void Promise.all([
      window.zimo.models.list(crypto.randomUUID()),
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "skill", status: "enabled" }),
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "knowledge", status: "enabled" }),
      window.zimo.mcp.list(crypto.randomUUID()),
    ]).then(([modelsResult, skillsResult, knowledgeResult, mcpResult]) => {
      if (modelsResult.ok)
        setAgentModels(
          modelsResult.data.flatMap((provider) =>
            provider.models.filter((model) => provider.enabled && model.enabled),
          ),
        );
      if (skillsResult.ok)
        setAvailableSkills(
          skillsResult.data.filter((skill) => skill.installationStatus === "installed"),
        );
      if (knowledgeResult.ok) setAvailableKnowledgeBases(knowledgeResult.data);
      if (mcpResult.ok) setAvailableMcpServers(mcpResult.data);
    });
  }, [kind]);

  async function mutate(
    input: Parameters<typeof window.zimo.prototypes.mutate>[1],
    message?: string,
  ) {
    const result = await window.zimo.prototypes.mutate(crypto.randomUUID(), input);
    if (!result.ok) {
      setNotice(result.error.message);
      return false;
    }
    setNotice(message);
    await reload();
    return true;
  }

  async function openPage(id: string, nextMode: Exclude<PageMode, "list">) {
    const result = await window.zimo.prototypes.get(crypto.randomUUID(), kind, id);
    if (!result.ok) {
      setNotice(result.error.message);
      return;
    }
    setDetail(result.data);
    setMode(nextMode);
    setNotice(undefined);
  }

  async function deleteItem(item: PrototypeSummaryView) {
    if (!(await confirm(`删除“${item.name}”？`))) return;
    if (kind === "agent" && item.installationStatus === "installed") {
      const result = await window.zimo.agents.uninstall(crypto.randomUUID(), item.id);
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }
      setNotice("已卸载");
      await reload();
      return;
    }
    await mutate({ action: "delete", kind, id: item.id }, "已删除");
  }

  async function contextAction(item: PrototypeSummaryView) {
    if (kind === "plugin") {
      await mutate(
        {
          action: "set-installation",
          kind,
          id: item.id,
          status: item.installationStatus === "not_installed" ? "installed" : "not_installed",
        },
        "安装状态已模拟更新",
      );
      return;
    }
    await mutate({ action: "preview", kind, id: item.id });
  }

  function backToList() {
    setMode("list");
    setDetail(undefined);
  }

  if (mode !== "list") {
    return (
      <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Button variant="ghost" className="mb-5 -ml-2" onClick={backToList}>
            <ChevronLeft size={17} /> 返回{metadata[kind].title}列表
          </Button>
          {notice && (
            <p
              role="status"
              className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              {notice}
            </p>
          )}
          <Card className="p-6 lg:p-8">
            {mode === "editor" ? (
              <PrototypeEditor
                key={detail?.id ?? "new"}
                kind={kind}
                detail={detail}
                models={agentModels}
                availableSkills={availableSkills}
                availableKnowledgeBases={availableKnowledgeBases}
                availableMcpServers={availableMcpServers}
                categoryOptions={kind === "agent" ? agentCategories : undefined}
                onCancel={backToList}
                onSubmit={(value) =>
                  void mutate(
                    detail
                      ? { action: "update", kind, id: detail.id, value }
                      : { action: "create", kind, value },
                    kind === "agent" || kind === "knowledge"
                      ? "配置已保存到本机"
                      : "已保存 Mock 配置",
                  ).then((saved) => {
                    if (saved) backToList();
                  })
                }
              />
            ) : detail && kind === "knowledge" ? (
              <ManagementHeading
                detail={detail}
                description="导入、索引并验证这个知识库中的本地文档。"
              >
                <KnowledgeManagement detail={detail} onNotice={setNotice} />
              </ManagementHeading>
            ) : detail && kind === "workflow" ? (
              <ManagementHeading detail={detail} description="配置节点、连接与受控能力调用。">
                <WorkflowCanvas
                  detail={detail}
                  availableMcpServers={availableMcpServers}
                  onSave={async (nodes, edges, mcpServerIds) => {
                    const saved = await mutate(
                      {
                        action: "save-workflow",
                        kind: "workflow",
                        id: detail.id,
                        nodes,
                        edges,
                        mcpServerIds: [...mcpServerIds],
                      },
                      "工作流定义已保存到本机",
                    );
                    if (!saved) throw new Error("Workflow save was rejected");
                  }}
                />
              </ManagementHeading>
            ) : null}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge>
            {kind === "knowledge"
              ? "Phase 6 · 本地检索"
              : kind === "workflow"
                ? "Workflow · 本地编排"
                : kind === "agent"
                  ? "Phase 5 · 本地持久化"
                  : "Phase 3 · Mock 原型"}
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{metadata[kind].title}</h1>
          <p className="mt-2 text-sm text-neutral-500">{metadata[kind].description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setDetail(undefined);
              setMode("editor");
            }}
          >
            <Plus size={16} />
            {metadata[kind].createLabel}
          </Button>
        </div>
      </header>
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      {kind === "agent" && (
        <div className="mt-7">
          <AgentMarketplaceSection
            localLoad={load}
            onChanged={() => void reload()}
            onDelete={(item) => void deleteItem(item)}
            onEdit={(id) => void openPage(id, "editor")}
            onRetryLocal={() => void reload()}
            onToggleStatus={(item) =>
              void mutate(
                {
                  action: "set-status",
                  kind: "agent",
                  id: item.id,
                  status: item.status === "enabled" ? "disabled" : "enabled",
                },
                "状态已更新",
              )
            }
            onUseAgent={onUseAgent}
            onCategoriesChange={setAgentCategories}
          />
        </div>
      )}
      {kind !== "agent" && (
        <div className="mt-7 min-h-[640px]">
          <PrototypeListGrid
            kind={kind}
            title={metadata[kind].title}
            query={query}
            status={status}
            load={load}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onEdit={(id) => void openPage(id, "editor")}
            onManage={(id) => void openPage(id, "manage")}
            onUseAgent={onUseAgent}
            onContextAction={(item) => void contextAction(item)}
            onToggleStatus={(item) =>
              void mutate(
                {
                  action: "set-status",
                  kind,
                  id: item.id,
                  status: item.status === "enabled" ? "disabled" : "enabled",
                },
                "状态已更新",
              )
            }
            onDelete={(item) => void deleteItem(item)}
            onRetry={() => void reload()}
          />
        </div>
      )}
    </div>
  );
}

function ManagementHeading({
  detail,
  description,
  children,
}: {
  detail: PrototypeDetailView;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6 border-b border-neutral-100 pb-5">
        <p className="text-xs font-medium text-neutral-400">{detail.category || "未分类"}</p>
        <h2 className="mt-1 text-xl font-semibold">{detail.name}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      {children}
    </div>
  );
}
