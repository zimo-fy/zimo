import { Button, cn } from "@zimo/ui";
import { CircleAlert, X } from "lucide-react";

export function ConversationHeader({ title }: { title: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center border-b border-neutral-200/70 bg-white px-5">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-neutral-900">{title}</h1>
        <p className="mt-0.5 text-xs text-neutral-400">配置本次对话的模型与能力</p>
      </div>
    </header>
  );
}

export function ConversationNotice({ message, onDismiss }: { message: string; onDismiss(): void }) {
  return (
    <div className="flex justify-center px-4 pt-3">
      <div
        role="alert"
        className={cn(
          "flex max-w-xl items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-500",
        )}
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1 leading-5">{message}</p>
        <button
          type="button"
          aria-label="关闭提示"
          className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-red-400 hover:bg-red-100 hover:text-red-600"
          onClick={onDismiss}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function ConversationInitializing({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry(): void;
}) {
  return (
    <div className="grid flex-1 place-items-center text-center">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">正在初始化新任务</h1>
        <Button className="mt-5" onClick={onRetry}>
          重试初始化
        </Button>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
