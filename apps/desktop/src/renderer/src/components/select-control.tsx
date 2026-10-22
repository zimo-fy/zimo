import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@zimo/ui";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export type SelectControlOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SelectControlProps = {
  value: string;
  options: readonly SelectControlOption[];
  onValueChange(value: string): void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onOpenChange?(open: boolean): void;
  leadingIcon?: ReactNode;
};

export function SelectControl({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder = "请选择",
  className,
  disabled,
  onOpenChange,
  leadingIcon,
}: SelectControlProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu.Root {...(onOpenChange ? { onOpenChange } : {})}>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "group flex min-h-11 w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 text-left text-sm text-neutral-800 shadow-sm transition",
            "hover:border-neutral-300 hover:bg-neutral-50 focus-visible:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
            "data-[state=open]:border-neutral-400 data-[state=open]:ring-2 data-[state=open]:ring-neutral-900/10 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 disabled:shadow-none",
            className,
          )}
        >
          {leadingIcon && <span className="shrink-0 text-neutral-500">{leadingIcon}</span>}
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-neutral-400")}>
            {selected?.label ?? placeholder}
          </span>
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-500 transition group-data-[state=open]:rotate-180 group-data-[state=open]:bg-neutral-900 group-data-[state=open]:text-white">
            <ChevronDown size={15} strokeWidth={2.2} />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={7}
          collisionPadding={12}
          className="z-50 max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-black/10 data-[state=closed]:animate-out data-[state=open]:animate-in"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <DropdownMenu.Item
                key={option.value}
                {...(option.disabled !== undefined ? { disabled: option.disabled } : {})}
                onSelect={() => onValueChange(option.value)}
                className={cn(
                  "flex cursor-default select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition",
                  "focus:bg-neutral-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                  isSelected && "bg-neutral-900 text-white focus:bg-neutral-800",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.description && (
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-xs text-neutral-400",
                        isSelected && "text-neutral-300",
                      )}
                    >
                      {option.description}
                    </span>
                  )}
                </span>
                <Check
                  size={15}
                  className={cn("shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                />
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
