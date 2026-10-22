import type { PendingApprovalView } from "@zimo/contracts";
import { Button } from "@zimo/ui";
import { ShieldAlert } from "lucide-react";

const actionLabels = {
  file_write: "修改文件",
  file_delete: "删除文件",
  command: "执行命令",
  network: "访问网络",
  external_app: "调用其他应用",
} as const;

export function ActionApprovalCard({
  approval,
  busy,
  onResolve,
}: {
  approval: PendingApprovalView;
  busy: boolean;
  onResolve(decision: "allowed_once" | "denied"): void;
}) {
  const event = approval.event;
  return (
    <section
      className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3"
      aria-label="操作审批请求"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-amber-950">
            请求审批 · {actionLabels[event.actionKind]}
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900">{event.summary}</p>
          {event.relativeTarget && (
            <p className="mt-1 truncate font-mono text-[11px] text-amber-700">
              {event.relativeTarget}
            </p>
          )}
          {event.command && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-amber-200/80 bg-white/70 px-2.5 py-2 font-mono text-[11px] leading-5 text-amber-950">
              {event.command}
            </pre>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="ghost"
          className="h-8 min-h-8 text-xs"
          disabled={busy}
          onClick={() => onResolve("denied")}
        >
          拒绝
        </Button>
        <Button
          className="h-8 min-h-8 text-xs"
          disabled={busy}
          onClick={() => onResolve("allowed_once")}
        >
          仅批准本次
        </Button>
      </div>
    </section>
  );
}
