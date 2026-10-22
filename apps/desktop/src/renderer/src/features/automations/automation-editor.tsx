import type {
  AutomationDetailView,
  AutomationSaveInput,
  McpConnectionView,
  ModelView,
  PrototypeSummaryView,
  RouteTargetView,
} from "@zimo/contracts";
import { Button } from "@zimo/ui";
import { ChevronDown } from "lucide-react";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";

import { SelectControl } from "../../components/select-control";
import {
  CapabilityChecks,
  DateTimeField,
  Field,
  McpChecks,
  SectionTitle,
} from "./automation-form-controls";
import { AUTOMATION_WEEKDAYS, toggleValue } from "./automation-form-values";

interface AutomationEditorProps {
  detail?: AutomationDetailView | undefined;
  initialPrompt?: string | undefined;
  models: readonly ModelView[];
  agents: readonly RouteTargetView[];
  skills: readonly RouteTargetView[];
  knowledgeBases: readonly PrototypeSummaryView[];
  workflows: readonly RouteTargetView[];
  mcpConnections: readonly McpConnectionView[];
  onCancel(): void;
  onSave(value: AutomationSaveInput): void;
}

export function AutomationEditor(props: AutomationEditorProps) {
  const { detail } = props;
  const [name, setName] = useState(detail?.name ?? "");
  const [prompt, setPrompt] = useState(detail?.prompt ?? props.initialPrompt ?? "");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [enabled, setEnabled] = useState(detail?.enabled ?? true);
  const [modelId, setModelId] = useState(detail?.modelId ?? props.models[0]?.id ?? "");
  const [agentId, setAgentId] = useState(detail?.agentId ?? "");
  const [skillIds, setSkillIds] = useState<string[]>(detail?.skillIds ?? []);
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>(
    detail?.knowledgeBaseIds ?? [],
  );
  const [workflowId, setWorkflowId] = useState(detail?.workflowId ?? "");
  const [mcpToolIds, setMcpToolIds] = useState<string[]>(detail?.mcpToolIds ?? []);
  const [scheduleKind, setScheduleKind] = useState(detail?.schedule.kind ?? "daily");
  const [runAt, setRunAt] = useState(
    detail?.schedule.kind === "once" ? toLocalInput(detail.schedule.runAt) : "",
  );
  const [everyMinutes, setEveryMinutes] = useState(
    detail?.schedule.kind === "interval" ? detail.schedule.everyMinutes : 60,
  );
  const [time, setTime] = useState(
    detail?.schedule.kind === "daily" || detail?.schedule.kind === "weekly"
      ? detail.schedule.time
      : "09:00",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    detail?.schedule.kind === "weekly" ? detail.schedule.weekdays : [1],
  );
  const [windowStart, setWindowStart] = useState(detail?.timeWindow.startTime ?? "00:00");
  const [windowEnd, setWindowEnd] = useState(detail?.timeWindow.endTime ?? "23:59");
  const boundCapabilityCount =
    Number(Boolean(agentId)) +
    Number(Boolean(workflowId)) +
    skillIds.length +
    knowledgeBaseIds.length +
    mcpToolIds.length;

  useLayoutEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [prompt]);

  function submit(event: FormEvent): void {
    event.preventDefault();
    const schedule = buildSchedule({
      kind: scheduleKind,
      runAt,
      everyMinutes,
      time,
      weekdays,
    });
    props.onSave({
      ...(detail ? { id: detail.id } : {}),
      name,
      prompt,
      enabled,
      ...(modelId ? { modelId } : {}),
      agentId: agentId || null,
      skillIds,
      knowledgeBaseIds,
      workflowId: workflowId || null,
      mcpToolIds,
      schedule,
      timeWindow: { startTime: windowStart, endTime: windowEnd },
    });
  }

  return (
    <form className="space-y-7" onSubmit={submit}>
      <header>
        <h2 className="text-xl font-semibold">{detail ? "编辑自动化" : "新建自动化"}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          任务通过专用会话执行，能力权限与普通会话保持一致。
        </p>
      </header>

      <section className="grid gap-4">
        <Field label="名称">
          <input
            className="field"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="每次执行的指令">
          <textarea
            ref={promptRef}
            className="field min-h-32 resize-none overflow-hidden py-3"
            required
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：汇总今天的行业动态，并给出三条行动建议。"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          保存后启用定时执行
        </label>
      </section>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold">执行能力</span>
          <span className="ml-auto text-xs text-neutral-500">
            {boundCapabilityCount > 0 ? `已绑定 ${boundCapabilityCount} 项` : "按需展开配置"}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="text-neutral-500 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="px-1 pt-4">
          <p className="text-sm text-neutral-500">与会话相同，执行前会再次校验已安装和启用状态。</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="模型">
              <SelectControl
                ariaLabel="自动化模型"
                value={modelId}
                options={props.models.map((model) => ({
                  value: model.id,
                  label: model.displayName,
                }))}
                onValueChange={setModelId}
              />
            </Field>
            <Field label="Agent">
              <SelectControl
                ariaLabel="自动化 Agent"
                value={agentId}
                options={[
                  { value: "", label: "普通对话" },
                  ...props.agents.map((item) => ({ value: item.id, label: item.name })),
                ]}
                onValueChange={setAgentId}
              />
            </Field>
            <Field label="Workflow">
              <SelectControl
                ariaLabel="自动化 Workflow"
                value={workflowId}
                options={[
                  { value: "", label: "不使用 Workflow" },
                  ...props.workflows.map((item) => ({ value: item.id, label: item.name })),
                ]}
                onValueChange={setWorkflowId}
              />
            </Field>
          </div>
          <CapabilityChecks
            title="Skills"
            emptyText="暂无已安装 Skill"
            items={props.skills}
            selectedIds={skillIds}
            onChange={setSkillIds}
          />
          <CapabilityChecks
            title="知识库"
            emptyText="暂无已启用知识库"
            items={props.knowledgeBases}
            selectedIds={knowledgeBaseIds}
            onChange={setKnowledgeBaseIds}
          />
          <McpChecks
            connections={props.mcpConnections}
            selectedToolIds={mcpToolIds}
            onChange={setMcpToolIds}
          />
        </div>
      </details>

      <section>
        <SectionTitle title="执行计划" description="日/周时刻使用当前电脑的本地时区。" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="计划类型">
            <SelectControl
              ariaLabel="自动化计划类型"
              value={scheduleKind}
              options={[
                { value: "once", label: "定时执行一次" },
                { value: "interval", label: "固定间隔" },
                { value: "daily", label: "每天" },
                { value: "weekly", label: "每周" },
              ]}
              onValueChange={(value) => setScheduleKind(value as typeof scheduleKind)}
            />
          </Field>
          {scheduleKind === "once" && (
            <DateTimeField label="执行时间" value={runAt} onChange={setRunAt} required />
          )}
          {scheduleKind === "interval" && (
            <Field label="间隔分钟数（5—43200）">
              <input
                className="field"
                type="number"
                min={5}
                max={43_200}
                required
                value={everyMinutes}
                onChange={(event) => setEveryMinutes(event.target.valueAsNumber)}
              />
            </Field>
          )}
          {(scheduleKind === "daily" || scheduleKind === "weekly") && (
            <Field label="执行时刻">
              <input
                className="field"
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </Field>
          )}
        </div>
        {scheduleKind === "weekly" && (
          <fieldset className="mt-4 rounded-xl border border-neutral-200 p-4">
            <legend className="px-1 text-sm font-medium">执行星期</legend>
            <div className="flex flex-wrap gap-4">
              {AUTOMATION_WEEKDAYS.map((day) => (
                <label key={day.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={weekdays.includes(day.value)}
                    onChange={() => setWeekdays(toggleValue(weekdays, day.value))}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      <section>
        <SectionTitle
          title="每天执行时间范围"
          description="范围外暂停执行；开始晚于结束时表示跨午夜，例如 22:00—06:00。"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="开始时间">
            <input
              className="field"
              type="time"
              required
              value={windowStart}
              onChange={(event) => setWindowStart(event.target.value)}
            />
          </Field>
          <Field label="结束时间">
            <input
              className="field"
              type="time"
              required
              value={windowEnd}
              onChange={(event) => setWindowEnd(event.target.value)}
            />
          </Field>
        </div>
      </section>

      {detail && detail.runs.length > 0 && (
        <section>
          <SectionTitle title="最近运行" description="结果正文保存在关联会话中。" />
          <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {detail.runs.slice(0, 5).map((run) => (
              <li
                key={run.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span>
                  {run.trigger === "manual" ? "手动" : "计划"} · {formatDate(run.startedAt)}
                </span>
                <span className="text-neutral-500">{runStatus(run.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-end gap-2 border-t border-neutral-100 pt-5">
        <Button variant="secondary" onClick={props.onCancel}>
          取消
        </Button>
        <Button type="submit">保存自动化</Button>
      </div>
    </form>
  );
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
}
function runStatus(status: string): string {
  return (
    (
      { running: "执行中", completed: "已完成", failed: "失败", cancelled: "已取消" } as Record<
        string,
        string
      >
    )[status] ?? status
  );
}
function buildSchedule(value: {
  kind: AutomationSaveInput["schedule"]["kind"];
  runAt: string;
  everyMinutes: number;
  time: string;
  weekdays: number[];
}): AutomationSaveInput["schedule"] {
  if (value.kind === "once")
    return { kind: value.kind, runAt: new Date(value.runAt).toISOString() };
  if (value.kind === "interval") return { kind: value.kind, everyMinutes: value.everyMinutes };
  if (value.kind === "daily") return { kind: value.kind, time: value.time };
  return { kind: value.kind, time: value.time, weekdays: value.weekdays };
}
