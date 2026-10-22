import type { WorkspaceGrantView } from "@zimo/contracts";
import { FolderClosed, LoaderCircle, X } from "lucide-react";

export function WorkspaceGrantStrip({
  workspaces,
  disabled,
  busy,
  onRemove,
}: {
  workspaces: readonly WorkspaceGrantView[];
  disabled: boolean;
  busy: boolean;
  onRemove(id: string): void;
}) {
  const visibleWorkspaces = workspaces.filter((workspace) => workspace.kind === "external");
  if (visibleWorkspaces.length === 0 && !busy) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2" aria-label="已添加工作目录">
      {visibleWorkspaces.map((workspace) => (
        <span
          key={workspace.id}
          className="inline-flex max-w-56 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
          title={`${workspace.displayName} · 已授权读写`}
        >
          <FolderClosed size={12} className="shrink-0 text-sky-600" aria-hidden="true" />
          <span className="truncate">{workspace.displayName}</span>
          <span className="shrink-0 text-[10px] text-slate-400">已授权</span>
          <button
            type="button"
            aria-label={`移除工作目录 ${workspace.displayName}`}
            className="grid size-4 shrink-0 cursor-pointer place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled}
            onClick={() => onRemove(workspace.id)}
          >
            <X size={11} aria-hidden="true" />
          </button>
        </span>
      ))}
      {busy && (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400" role="status">
          <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />
          正在连接目录
        </span>
      )}
    </div>
  );
}
