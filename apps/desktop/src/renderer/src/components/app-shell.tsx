import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { AuthSessionView, ConversationSummaryView } from "@zimo/contracts";
import { Button } from "@zimo/ui";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import type { PropsWithChildren } from "react";

import { AppNavigation } from "./app-navigation";
import { TaskNavigation } from "./task-navigation";

export type AppPage =
  | "chat"
  | "agent"
  | "skill"
  | "knowledge"
  | "workflow"
  | "plugin"
  | "mcp"
  | "automation"
  | "settings";

interface AppShellProps extends PropsWithChildren {
  page: AppPage;
  session: AuthSessionView;
  tasks: readonly ConversationSummaryView[];
  activeTaskId?: string | undefined;
  newTaskActive: boolean;
  taskError?: string | undefined;
  onNavigate(page: AppPage): void;
  onCreateTask(): void;
  onSelectTask(id: string): void;
  onRenameTask(id: string, title: string): Promise<{ ok: boolean; message?: string }>;
  onSetTaskPinned(id: string, pinned: boolean): Promise<{ ok: boolean; message?: string }>;
  onDeleteTask(id: string): Promise<{ ok: boolean; message?: string }>;
  onLogout(): void;
}

export function AppShell({
  page,
  session,
  tasks,
  activeTaskId,
  newTaskActive,
  taskError,
  onNavigate,
  onCreateTask,
  onSelectTask,
  onRenameTask,
  onSetTaskPinned,
  onDeleteTask,
  onLogout,
  children,
}: AppShellProps) {
  const initials = session.displayName.slice(0, 1).toUpperCase();

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="grid min-h-screen grid-cols-[76px_1fr] bg-neutral-50 lg:grid-cols-[244px_1fr]">
        <aside className="sticky top-0 flex h-screen flex-col border-r border-neutral-200/70 bg-white px-3 py-5 lg:px-4">
          <div className="flex h-11 items-center justify-center gap-3 lg:justify-start lg:px-2">
            <img src="/icon.png" alt="" className="size-9 rounded-xl shadow-sm" />
            <span className="hidden text-lg font-semibold tracking-tight text-neutral-900 lg:block">
              Zimo
            </span>
          </div>

          <AppNavigation page={page} newTaskActive={newTaskActive} onNavigate={onNavigate} />
          <TaskNavigation
            tasks={tasks}
            activeId={activeTaskId}
            loadError={taskError}
            onCreate={onCreateTask}
            onSelect={onSelectTask}
            onRename={onRenameTask}
            onSetPinned={onSetTaskPinned}
            onDelete={onDeleteTask}
          />

          <div className="mt-4 grid gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center gap-3 rounded-xl p-2 text-left outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-800 lg:justify-start"
                  aria-label="打开 Zimo 账户菜单"
                >
                  <Avatar.Root className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-900 text-xs font-semibold text-white">
                    <Avatar.Fallback>{initials}</Avatar.Fallback>
                  </Avatar.Root>
                  <span className="hidden min-w-0 flex-1 lg:block">
                    <span className="block truncate text-sm font-medium text-neutral-800">
                      {session.displayName}
                    </span>
                    <span className="block truncate text-xs text-neutral-400">Zimo 账户</span>
                  </span>
                  <ChevronDown className="hidden text-neutral-400 lg:block" size={14} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-52 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-black/10"
                >
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-medium text-neutral-800">{session.displayName}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {session.email ?? session.account}
                    </p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-neutral-100" />
                  <DropdownMenu.Item asChild>
                    <Button
                      variant="ghost"
                      className="h-9 min-h-9 w-full justify-start px-2.5 text-neutral-700"
                      onClick={() => onNavigate("settings")}
                    >
                      <Settings size={15} className="text-indigo-600" aria-hidden="true" />
                      设置
                    </Button>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-neutral-100" />
                  <DropdownMenu.Item asChild>
                    <Button
                      variant="ghost"
                      className="h-9 min-h-9 w-full justify-start px-2.5 text-red-600"
                      onClick={onLogout}
                    >
                      <LogOut size={15} aria-hidden="true" />
                      退出登录
                    </Button>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </Tooltip.Provider>
  );
}
