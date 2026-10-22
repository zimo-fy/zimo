import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "./cn";

export { cn } from "./cn";
export { Button, type ButtonProps } from "./button";
export { AppDialogProvider, useAppDialog, type AppDialogApi } from "./app-dialog";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl bg-white ring-1 ring-black/5 shadow-sm", className)}
      {...props}
    />
  );
}

export function Badge({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = "正在加载" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-neutral-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-700" />
      {label}
    </span>
  );
}
