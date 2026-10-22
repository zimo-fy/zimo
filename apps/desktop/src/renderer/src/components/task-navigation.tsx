import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ConversationSummaryView } from "@zimo/contracts";
import { cn, useAppDialog } from "@zimo/ui";
import { Check, Ellipsis, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

function formatTaskTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function TaskNavigation({
  tasks,
  activeId,
  loadError,
  onCreate,
  onSelect,
  onRename,
  onSetPinned,
  onDelete,
}: {
  tasks: readonly ConversationSummaryView[];
  activeId?: string | undefined;
  loadError?: string | undefined;
  onCreate(): void;
  onSelect(id: string): void;
  onRename(id: string, title: string): Promise<{ ok: boolean; message?: string }>;
  onSetPinned(id: string, pinned: boolean): Promise<{ ok: boolean; message?: string }>;
  onDelete(id: string): Promise<{ ok: boolean; message?: string }>;
}) {
  const { confirm } = useAppDialog();
  const [editingId, setEditingId] = useState<string>();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>();

  async function saveRename(id: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const result = await onRename(id, nextTitle);
    if (result.ok) {
      setEditingId(undefined);
      setError(undefined);
    } else setError(result.message);
  }

  async function deleteTask(task: ConversationSummaryView) {
    if (!(await confirm(`确定删除任务“${task.title}”吗？`))) return;
    const result = await onDelete(task.id);
    if (!result.ok) setError(result.message);
  }

  async function setPinned(task: ConversationSummaryView) {
    const result = await onSetPinned(task.id, !task.isPinned);
    if (!result.ok) setError(result.message);
    else setError(undefined);
  }

  return (
    <section
      className="mt-4 hidden min-h-0 flex-1 flex-col border-t border-neutral-100 pt-3 lg:flex"
      aria-label="任务"
    >
      <div className="flex h-8 shrink-0 items-center justify-between px-2">
        <span className="text-xs font-semibold tracking-[0.12em] text-neutral-400">任务</span>
        <button
          type="button"
          className="grid size-7 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800"
          onClick={onCreate}
          aria-label="创建新任务"
          title="创建新任务"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="scrollbar-subtle mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
        {tasks.length === 0 && (
          <p className="hidden px-2 py-5 text-center text-xs text-neutral-400 lg:block">暂无任务</p>
        )}
        {tasks.map((task) => {
          const active = task.id === activeId;
          if (editingId === task.id) {
            return (
              <div
                key={task.id}
                className="flex h-9 items-center gap-1 rounded-lg bg-neutral-100 p-1"
              >
                <input
                  className="h-7 min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 text-[13px] outline-none focus:border-neutral-400"
                  aria-label="任务名称"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveRename(task.id);
                    if (event.key === "Escape") setEditingId(undefined);
                  }}
                  autoFocus
                />
                <button
                  className="icon-button size-7"
                  onClick={() => setEditingId(undefined)}
                  aria-label="取消修改"
                >
                  <X size={13} />
                </button>
                <button
                  className="icon-button size-7"
                  onClick={() => void saveRename(task.id)}
                  aria-label="保存任务名称"
                >
                  <Check size={13} />
                </button>
              </div>
            );
          }
          return (
            <div
              key={task.id}
              className={cn(
                "group relative flex h-9 items-center rounded-lg transition",
                active ? "bg-sky-50" : "hover:bg-neutral-50",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(task.id)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 pr-9 text-left"
                aria-label={`打开任务：${task.title}`}
                aria-current={active ? "page" : undefined}
                title={task.title}
              >
                {task.isPinned && (
                  <span
                    className="grid size-4 shrink-0 place-items-center text-sky-600"
                    aria-label="已置顶"
                    title="已置顶"
                  >
                    <Pin size={11} fill="currentColor" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] font-medium",
                    active ? "text-sky-800" : "text-neutral-700",
                  )}
                >
                  {task.title}
                </span>
                <time
                  dateTime={task.updatedAt}
                  className="shrink-0 text-[11px] tabular-nums text-neutral-400 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
                >
                  {formatTaskTime(task.updatedAt)}
                </time>
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="pointer-events-none absolute right-1 z-10 grid size-7 place-items-center rounded-md text-neutral-400 opacity-0 transition hover:bg-white hover:text-neutral-800 group-hover:pointer-events-auto group-hover:opacity-100 focus:pointer-events-auto focus:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                    aria-label={`管理任务：${task.title}`}
                  >
                    <Ellipsis size={14} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 min-w-32 rounded-xl bg-white p-1.5 text-xs shadow-xl ring-1 ring-black/10"
                    sideOffset={4}
                  >
                    <DropdownMenu.Item
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-neutral-700 outline-none hover:bg-neutral-100"
                      onSelect={() => void setPinned(task)}
                    >
                      {task.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                      {task.isPinned ? "取消置顶" : "置顶"}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-neutral-700 outline-none hover:bg-neutral-100"
                      onSelect={() => {
                        setTitle(task.title);
                        setEditingId(task.id);
                      }}
                    >
                      <Pencil size={13} /> 修改名称
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-red-600 outline-none hover:bg-red-50"
                      onSelect={() => void deleteTask(task)}
                    >
                      <Trash2 size={13} /> 删除
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          );
        })}
      </div>
      {(error ?? loadError) && (
        <p className="px-2 pt-2 text-[11px] text-red-600">{error ?? loadError}</p>
      )}
    </section>
  );
}
