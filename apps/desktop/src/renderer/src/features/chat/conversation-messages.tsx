import type {
  ConversationDetailView,
  ContextCompactionView,
  DocumentArtifactView,
} from "@zimo/contracts";
import { Button, cn } from "@zimo/ui";
import { ArrowDown, LoaderCircle, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  conversationMessageKey,
  visibleConversationMessages,
} from "./conversation-display-messages";
import { MessageBubble } from "./message-bubble";
import { useConversationAutoScroll } from "./use-conversation-auto-scroll";

export function ConversationMessages({
  detail,
  containerLabel,
  artifacts,
  onExportArtifact,
  onPreviewArtifact,
  onCompact,
  compacting,
  onCancelCompaction,
  onRegenerate,
}: {
  detail: ConversationDetailView;
  containerLabel?: string | undefined;
  artifacts: readonly DocumentArtifactView[];
  onExportArtifact(id: string, revisionId: string): void;
  onPreviewArtifact(id: string, revisionId: string): void;
  onCompact(): void;
  compacting: boolean;
  onCancelCompaction(): void;
  onRegenerate?: ((messageId: string) => void) | undefined;
}) {
  const displayMessages = visibleConversationMessages(detail.messages);
  const userMessageCount = displayMessages.filter((message) => message.role === "user").length;
  const regenerateEnabled = Boolean(onRegenerate) && !detail.activeRunId && !compacting;
  const latestAssistantId = [...displayMessages]
    .reverse()
    .find((message) => message.role === "assistant" && message.status === "completed")?.id;
  const { viewportRef, contentRef, isAtBottom, handleScroll, scrollToBottom } =
    useConversationAutoScroll({
      conversationId: detail.id,
      forceVersion: userMessageCount,
    });

  return (
    <div className="relative min-h-0 flex-1" aria-label={containerLabel}>
      <div
        ref={viewportRef}
        aria-label="消息列表"
        className="h-full overflow-y-auto overscroll-contain px-5 py-7 [scrollbar-gutter:stable]"
        onScroll={handleScroll}
      >
        <div ref={contentRef} className="mx-auto max-w-3xl space-y-6 pb-4 [overflow-anchor:none]">
          {displayMessages.length === 0 && detail.contextCompactions.length === 0 && (
            <EmptyConversation />
          )}
          {conversationTimeline(detail, displayMessages).map((item) =>
            item.type === "message" ? (
              <MessageBubble
                key={conversationMessageKey(item.value, detail.messages)}
                message={item.value}
                artifacts={artifacts.filter((artifact) => artifact.messageId === item.value.id)}
                onExportArtifact={onExportArtifact}
                onPreviewArtifact={onPreviewArtifact}
                onCompact={
                  item.value.id === latestAssistantId &&
                  !detail.activeRunId &&
                  !detail.workflowId &&
                  !compacting
                    ? onCompact
                    : undefined
                }
                onRegenerate={
                  regenerateEnabled && assistantMessageRegeneratable(item.value)
                    ? () => onRegenerate?.(item.value.id)
                    : undefined
                }
              />
            ) : (
              <ContextCompactionCard
                key={item.value.id}
                compaction={item.value}
                onCancel={onCancelCompaction}
              />
            ),
          )}
        </div>
        <div className="h-px [overflow-anchor:auto]" aria-hidden="true" />
      </div>
      {!isAtBottom && (
        <Button
          variant="secondary"
          className="absolute bottom-4 left-1/2 min-h-9 -translate-x-1/2 rounded-full px-3 text-xs shadow-lg"
          aria-label="回到最新消息"
          onClick={() => scrollToBottom()}
        >
          <ArrowDown size={14} /> 回到最新
        </Button>
      )}
    </div>
  );
}

function assistantMessageRegeneratable(
  message: ConversationDetailView["messages"][number],
): boolean {
  return (
    message.role === "assistant" &&
    (message.status === "completed" ||
      message.status === "cancelled" ||
      message.status === "failed")
  );
}

function conversationTimeline(
  detail: ConversationDetailView,
  messages: readonly ConversationDetailView["messages"][number][],
) {
  const items: (
    | {
        type: "message";
        createdAt: string;
        order: number;
        value: ConversationDetailView["messages"][number];
      }
    | { type: "compaction"; createdAt: string; order: number; value: ContextCompactionView }
  )[] = [
    ...messages.map((value) => ({
      type: "message" as const,
      createdAt: value.createdAt,
      order: value.position,
      value,
    })),
    ...detail.contextCompactions.map((value) => ({
      type: "compaction" as const,
      createdAt: value.createdAt,
      order: Number.MAX_SAFE_INTEGER - 1_000 + value.version,
      value,
    })),
  ];
  return items.sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.order - right.order,
  );
}

function ContextCompactionCard({
  compaction,
  onCancel,
}: {
  compaction: ContextCompactionView;
  onCancel(): void;
}) {
  const isRunning = compaction.status === "running";
  const isFailed = compaction.status === "failed";
  const title = isRunning
    ? "正在整理较早的会话内容……"
    : isFailed
      ? compaction.errorCode === "CONTEXT_COMPACTION_CANCELLED"
        ? "已取消上下文整理"
        : "上下文整理失败，原始会话记录未受影响"
      : "已完成上下文压缩";
  return (
    <aside
      className={cn(
        "mx-auto w-full max-w-2xl rounded-xl border px-4 py-3 text-xs",
        isFailed
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-violet-200 bg-violet-50/70 text-violet-800",
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 font-medium">
        {isRunning ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles size={14} />}
        {title}
      </div>
      {isRunning && compaction.trigger === "manual" && (
        <button type="button" className="mt-2 underline" onClick={onCancel}>
          取消整理
        </button>
      )}
      {!isRunning && !isFailed && (
        <>
          <p className="mt-1.5 text-[11px] leading-5 text-violet-600">
            覆盖至消息位置 {compaction.coveredThroughPosition} · 压缩前约
            {formatTokenCount(compaction.inputTokens)} tokens · 摘要约
            {formatTokenCount(compaction.outputTokens ?? 0)} tokens
          </p>
          {compaction.summary && (
            <details className="mt-2 rounded-lg bg-white/70 px-3 py-2">
              <summary className="cursor-pointer select-none font-medium">查看交接摘要</summary>
              <div className="markdown mt-2 text-neutral-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{compaction.summary}</ReactMarkdown>
              </div>
            </details>
          )}
        </>
      )}
    </aside>
  );
}

function formatTokenCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function EmptyConversation() {
  return (
    <div className="py-20 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-600">
        <Sparkles size={20} />
      </span>
      <h2 className="mt-4 text-2xl font-semibold text-neutral-900">今天想聊些什么？</h2>
      <p className="mt-2 text-sm text-neutral-500">
        选择下方的模型、Agent 与资料，再描述你的任务。
      </p>
    </div>
  );
}
