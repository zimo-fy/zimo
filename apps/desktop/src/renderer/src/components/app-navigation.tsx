import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@zimo/ui";
import {
  Bot,
  BookOpen,
  ChevronRight,
  GitBranch,
  MessageSquare,
  Plug,
  Radio,
  Sparkles,
  Timer,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { AppPage } from "./app-shell";

interface NavigationItem {
  id: AppPage;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  activeClassName: string;
}

const primaryItems: readonly NavigationItem[] = [
  {
    id: "chat",
    label: "新建任务",
    icon: MessageSquare,
    iconClassName: "bg-sky-50 text-sky-600",
    activeClassName: "bg-sky-50 text-sky-700",
  },
  {
    id: "agent",
    label: "Agent",
    icon: Bot,
    iconClassName: "bg-blue-50 text-blue-600",
    activeClassName: "bg-blue-50 text-blue-700",
  },
  {
    id: "skill",
    label: "Skill",
    icon: Sparkles,
    iconClassName: "bg-violet-50 text-violet-600",
    activeClassName: "bg-violet-50 text-violet-700",
  },
];

const toolItems: readonly NavigationItem[] = [
  {
    id: "knowledge",
    label: "知识库",
    icon: BookOpen,
    iconClassName: "bg-emerald-50 text-emerald-600",
    activeClassName: "bg-emerald-50 text-emerald-700",
  },
  {
    id: "workflow",
    label: "工作流",
    icon: GitBranch,
    iconClassName: "bg-amber-50 text-amber-600",
    activeClassName: "bg-amber-50 text-amber-700",
  },
  {
    id: "plugin",
    label: "通信渠道",
    icon: Radio,
    iconClassName: "bg-rose-50 text-rose-600",
    activeClassName: "bg-rose-50 text-rose-700",
  },
  {
    id: "mcp",
    label: "MCP",
    icon: Plug,
    iconClassName: "bg-cyan-50 text-cyan-600",
    activeClassName: "bg-cyan-50 text-cyan-700",
  },
  {
    id: "automation",
    label: "自动化",
    icon: Timer,
    iconClassName: "bg-orange-50 text-orange-600",
    activeClassName: "bg-orange-50 text-orange-700",
  },
];

const toolPages = new Set<AppPage>(toolItems.map((item) => item.id));

function NavigationButton({
  item,
  active,
  onNavigate,
}: {
  item: NavigationItem;
  active: boolean;
  onNavigate(page: AppPage): void;
}) {
  const Icon = item.icon;
  const button = (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={cn(
        "group flex h-10 w-full items-center justify-center gap-3 rounded-xl px-2 text-sm font-medium transition lg:justify-start",
        active
          ? item.activeClassName
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
      )}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg transition",
          item.iconClassName,
          active && "shadow-sm ring-1 ring-current/10",
        )}
      >
        <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
      </span>
      <span className="hidden truncate lg:block">{item.label}</span>
    </button>
  );
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          className="z-50 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs text-white shadow-lg lg:hidden"
        >
          {item.label}
          <Tooltip.Arrow className="fill-neutral-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function AppNavigation({
  page,
  newTaskActive,
  onNavigate,
}: {
  page: AppPage;
  newTaskActive: boolean;
  onNavigate(page: AppPage): void;
}) {
  return (
    <nav className="mt-5 grid content-start gap-1" aria-label="主导航">
      {primaryItems.map((item) => (
        <NavigationButton
          key={item.id}
          item={item}
          active={item.id === "chat" ? newTaskActive : page === item.id}
          onNavigate={onNavigate}
        />
      ))}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              "group flex h-10 items-center justify-center gap-3 rounded-xl px-2 text-sm font-medium text-neutral-500 outline-none transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-orange-300 lg:justify-start",
              toolPages.has(page) && "bg-orange-50/70 text-orange-700",
            )}
            aria-label="工具"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-orange-50 text-orange-600">
              <Wrench size={16} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="hidden flex-1 text-left lg:block">工具</span>
            <ChevronRight size={14} className="hidden lg:block" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="right"
            align="start"
            sideOffset={8}
            className="z-50 min-w-44 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-black/10"
          >
            {toolItems.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <DropdownMenu.Item
                  key={item.id}
                  onSelect={() => onNavigate(item.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-neutral-100",
                    active ? item.activeClassName : "text-neutral-600",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={cn("grid size-7 place-items-center rounded-lg", item.iconClassName)}
                  >
                    <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  {item.label}
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </nav>
  );
}
