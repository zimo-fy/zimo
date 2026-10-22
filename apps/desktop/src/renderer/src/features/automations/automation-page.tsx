import type {
  AutomationDetailView,
  AutomationSaveInput,
  AutomationSummaryView,
  McpConnectionView,
  ModelView,
  PrototypeSummaryView,
  RouteTargetView,
} from "@zimo/contracts";
import { Badge, Button, Card, useAppDialog } from "@zimo/ui";
import { Edit3, Play, Plus, Power, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AutomationEditor } from "./automation-editor";
import { RECRUITMENT_GREETING_PROMPT } from "./automation-prompt-presets";

interface Catalogs {
  models: ModelView[];
  agents: RouteTargetView[];
  skills: RouteTargetView[];
  knowledgeBases: PrototypeSummaryView[];
  workflows: RouteTargetView[];
  mcpConnections: McpConnectionView[];
}

const EMPTY_CATALOGS: Catalogs = {
  models: [],
  agents: [],
  skills: [],
  knowledgeBases: [],
  workflows: [],
  mcpConnections: [],
};

export function AutomationPage() {
  const { confirm } = useAppDialog();
  const [items, setItems] = useState<AutomationSummaryView[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [detail, setDetail] = useState<AutomationDetailView>();
  const [initialPrompt, setInitialPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    const [automations, models, agents, skills, knowledge, workflows, mcp] = await Promise.all([
      window.zimo.automations.list(crypto.randomUUID()),
      window.zimo.models.list(crypto.randomUUID()),
      window.zimo.router.listTargets(crypto.randomUUID(), "agent"),
      window.zimo.router.listTargets(crypto.randomUUID(), "skill"),
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "knowledge", status: "enabled" }),
      window.zimo.router.listTargets(crypto.randomUUID(), "workflow"),
      window.zimo.mcp.list(crypto.randomUUID()),
    ]);
    if (!automations.ok) {
      setError(automations.error.message);
      return;
    }
    setItems(automations.data);
    setCatalogs({
      models: models.ok
        ? models.data.flatMap((provider) =>
            provider.models.filter((model) => provider.enabled && model.enabled),
          )
        : [],
      agents: agents.ok ? agents.data : [],
      skills: skills.ok ? skills.data : [],
      knowledgeBases: knowledge.ok ? knowledge.data : [],
      workflows: workflows.ok ? workflows.data : [],
      mcpConnections: mcp.ok ? [...mcp.data] : [],
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  async function openEditor(id?: string, prompt = ""): Promise<void> {
    setError(undefined);
    setNotice(undefined);
    if (!id) {
      setDetail(undefined);
      setInitialPrompt(prompt);
      setEditing(true);
      return;
    }
    const result = await window.zimo.automations.get(crypto.randomUUID(), id);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setDetail(result.data);
    setInitialPrompt("");
    setEditing(true);
  }

  async function save(value: AutomationSaveInput): Promise<void> {
    const result = await window.zimo.automations.save(crypto.randomUUID(), value);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setEditing(false);
    setDetail(undefined);
    setNotice("自动化配置已保存");
    await reload();
  }

  async function runNow(id: string): Promise<void> {
    const result = await window.zimo.automations.runNow(crypto.randomUUID(), id);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("任务已开始，结果会写入对应的“自动化”会话");
    await reload();
  }

  async function toggleEnabled(item: AutomationSummaryView): Promise<void> {
    const result = await window.zimo.automations.setEnabled(
      crypto.randomUUID(),
      item.id,
      !item.enabled,
    );
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(result.data.enabled ? "定时执行已启用" : "定时执行已停用");
    await reload();
  }

  async function remove(item: AutomationSummaryView): Promise<void> {
    if (
      !(await confirm(`删除自动化“${item.name}”的调度配置？已执行的任务会话仍保留在左侧任务列表。`))
    )
      return;
    const result = await window.zimo.automations.delete(crypto.randomUUID(), item.id);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice("自动化已删除，已执行的任务会话仍保留");
    await reload();
  }

  if (editing) {
    return (
      <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Card className="p-6 lg:p-8">
            <AutomationEditor
              detail={detail}
              initialPrompt={initialPrompt}
              {...catalogs}
              onCancel={() => setEditing(false)}
              onSave={(value) => void save(value)}
            />
          </Card>
          {error && <Message tone="error">{error}</Message>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge>自动化 · 本地调度</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">自动化</h1>
            <p className="mt-2 text-sm text-neutral-500">
              按计划运行带 Agent、Skill、知识库、Workflow 和 MCP 的专用会话。
              {/* <button
                type="button"
                className="ml-2 inline text-sky-700 underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                onClick={() => void openEditor(undefined, RECRUITMENT_GREETING_PROMPT)}
              >
                快捷创建打招呼自动化任务
              </button> */}
            </p>
          </div>
          <Button onClick={() => void openEditor()}>
            <Plus size={16} />
            新建 自动化任务
          </Button>
        </header>
        {notice && <Message tone="success">{notice}</Message>}
        {error && <Message tone="error">{error}</Message>}
        {items.length === 0 ? (
          <Card className="mt-7 p-10 text-center text-sm text-neutral-500">
            暂无自动化任务。创建后，Zimo 在应用运行且已登录时按计划执行。
          </Card>
        ) : (
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <Card key={item.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{item.name}</h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      {scheduleLabel(item)} · {item.timeWindow.startTime}—{item.timeWindow.endTime}{" "}
                      · {item.enabled ? "已启用" : "已停用"}
                    </p>
                  </div>
                  <span
                    className={
                      item.enabled ? "text-xs text-emerald-700" : "text-xs text-neutral-400"
                    }
                  >
                    {item.lastRunStatus ? statusLabel(item.lastRunStatus) : "尚未运行"}
                  </span>
                </div>
                <div className="mt-4 text-sm text-neutral-500">
                  {item.nextRunAt ? `下次：${formatDate(item.nextRunAt)}` : "当前没有下一次执行"}
                </div>
                <div className="mt-5 flex flex-wrap gap-1 border-t border-neutral-100 pt-3">
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => void openEditor(item.id)}
                  >
                    <Edit3 size={14} />
                    编辑
                  </Button>
                  <Button variant="ghost" className="text-xs" onClick={() => void runNow(item.id)}>
                    <Play size={14} />
                    立即运行
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => void toggleEnabled(item)}
                  >
                    <Power size={14} />
                    {item.enabled ? "停用" : "启用"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="ml-auto text-xs text-red-600"
                    onClick={() => void remove(item)}
                  >
                    <Trash2 size={14} />
                    删除
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Message({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={`mt-5 rounded-xl px-4 py-3 text-sm ${tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
    >
      {children}
    </p>
  );
}
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
}
function statusLabel(status: string): string {
  return (
    (
      {
        running: "执行中",
        completed: "最近成功",
        failed: "最近失败",
        cancelled: "最近取消",
      } as Record<string, string>
    )[status] ?? status
  );
}
function scheduleLabel(item: AutomationSummaryView): string {
  const schedule = item.schedule;
  if (schedule.kind === "once") return `定时 ${formatDate(schedule.runAt)}`;
  if (schedule.kind === "interval") return `每 ${schedule.everyMinutes} 分钟`;
  if (schedule.kind === "daily") return `每天 ${schedule.time}`;
  return `每周 ${schedule.weekdays.map((day) => "日一二三四五六"[day]).join("、")} ${schedule.time}`;
}
