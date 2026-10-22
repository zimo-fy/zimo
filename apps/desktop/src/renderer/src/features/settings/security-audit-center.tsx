import { useCallback, useEffect, useState } from "react";
import type { SecurityAuditEventView } from "@zimo/contracts";
import { Badge, Button, Spinner } from "@zimo/ui";
import { RefreshCw } from "lucide-react";

import { SelectControl } from "../../components/select-control";
import { AuthorizedWorkspaceList } from "./authorized-workspace-list";

const eventLabels: Record<SecurityAuditEventView["eventType"], string> = {
  action_policy_allowed: "策略放行",
  action_policy_denied: "策略拦截",
  approval_requested: "请求审批",
  approval_resolved: "审批完成",
  approval_expired: "审批超时",
  approval_cancelled: "审批取消",
  tool_execution_started: "开始执行",
  tool_execution_completed: "执行完成",
};

const outcomeLabels: Record<SecurityAuditEventView["outcome"], string> = {
  allowed: "已放行",
  denied: "已拦截",
  pending: "等待中",
  success: "成功",
  failure: "失败",
  cancelled: "已取消",
  timed_out: "已超时",
};

export function SecurityAuditCenter() {
  const [events, setEvents] = useState<SecurityAuditEventView[]>([]);
  const [risk, setRisk] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(
    () =>
      window.zimo.securityAudit.list(crypto.randomUUID(), {
        ...(risk === "all" ? {} : { risk: risk as "low" | "medium" | "high" | "critical" }),
        ...(outcome === "all" ? {} : { outcome: outcome as SecurityAuditEventView["outcome"] }),
        limit: 100,
      }),
    [outcome, risk],
  );

  const applyResult = useCallback((result: Awaited<ReturnType<typeof fetchEvents>>) => {
    if (!result.ok) setError(result.error.message);
    else {
      setError(null);
      setEvents(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchEvents().then((result) => {
      if (active) applyResult(result);
    });
    return () => {
      active = false;
    };
  }, [applyResult, fetchEvents]);

  return (
    <div>
      <AuthorizedWorkspaceList />
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Filter
          label="风险"
          value={risk}
          options={[
            { value: "all", label: "全部风险" },
            { value: "low", label: "低" },
            { value: "medium", label: "中" },
            { value: "high", label: "高" },
            { value: "critical", label: "关键" },
          ]}
          onChange={(value) => {
            setLoading(true);
            setRisk(value);
          }}
        />
        <Filter
          label="结果"
          value={outcome}
          options={[
            { value: "all", label: "全部结果" },
            { value: "allowed", label: "已放行" },
            { value: "denied", label: "已拦截" },
            { value: "success", label: "成功" },
            { value: "failure", label: "失败" },
            { value: "cancelled", label: "已取消" },
            { value: "timed_out", label: "已超时" },
          ]}
          onChange={(value) => {
            setLoading(true);
            setOutcome(value);
          }}
        />
        <Button
          variant="ghost"
          className="h-9 min-h-9 px-3 text-xs"
          onClick={() => {
            setLoading(true);
            void fetchEvents().then(applyResult);
          }}
          disabled={loading}
        >
          <RefreshCw size={13} aria-hidden="true" /> 刷新
        </Button>
      </div>

      {loading ? (
        <div className="grid min-h-28 place-items-center">
          <Spinner label="正在读取审计记录" />
        </div>
      ) : error ? (
        <p className="mt-4 text-xs text-red-600">{error}</p>
      ) : events.length === 0 ? (
        <p className="mt-5 rounded-xl bg-neutral-50 px-4 py-5 text-center text-xs text-neutral-400">
          暂无符合条件的安全记录
        </p>
      ) : (
        <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-neutral-100">
          {events.map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-neutral-100 px-3.5 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-neutral-800">
                    {eventLabels[event.eventType]}
                  </span>
                  <OutcomeBadge outcome={event.outcome} />
                  {event.risk && <Badge className="text-[10px]">{riskLabel(event.risk)}</Badge>}
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-neutral-400">
                  {event.toolId ?? event.actionKind ?? "受控操作"}
                  {event.errorCode ? ` · ${event.errorCode}` : ""}
                </p>
                {event.actionLabel && (
                  <p className="mt-1 truncate text-[11px] text-neutral-500">
                    {event.actionLabel}
                    {event.workspaceLabel ? ` · ${event.workspaceLabel}` : ""}
                    {event.relativeTarget ? `/${event.relativeTarget}` : ""}
                  </p>
                )}
              </div>
              <time className="whitespace-nowrap text-[11px] text-neutral-400">
                {new Date(event.createdAt).toLocaleString("zh-CN", { hour12: false })}
              </time>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-5 text-neutral-400">
        最多展示最近 100
        条；文件动作仅保存授权目录名称和相对目标，不保存文件正文、模型消息或凭据。当前版本尚未开放
        Shell 命令。
      </p>
    </div>
  );
}

function Filter(props: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange(value: string): void;
}) {
  return (
    <label className="grid min-w-32 gap-1.5 text-[11px] text-neutral-500">
      {props.label}
      <SelectControl
        ariaLabel={props.label}
        value={props.value}
        options={props.options}
        onValueChange={props.onChange}
      />
    </label>
  );
}

function OutcomeBadge({ outcome }: { outcome: SecurityAuditEventView["outcome"] }) {
  const warning = ["denied", "failure", "timed_out"].includes(outcome);
  return (
    <Badge className={warning ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}>
      {outcomeLabels[outcome]}
    </Badge>
  );
}

function riskLabel(risk: NonNullable<SecurityAuditEventView["risk"]>): string {
  return { low: "低风险", medium: "中风险", high: "高风险", critical: "关键风险" }[risk];
}
