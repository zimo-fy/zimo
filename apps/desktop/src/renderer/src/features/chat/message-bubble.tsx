import type {
  ConversationDetailView,
  DocumentArtifactView,
  KnowledgeCitationView,
} from "@zimo/contracts";
import { cn } from "@zimo/ui";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AssistantReplyMeta } from "./assistant-reply-meta";
import { copyMessageText } from "./copy-message-text";
import { AssistantReplyProgress } from "./assistant-reply-progress";
import { MessageAttachmentCards } from "./document-attachments";
import { AssistantMessageFooter, UserMessageFooter } from "./message-footers";

export function MessageBubble({
  message,
  artifacts,
  onExportArtifact,
  onPreviewArtifact,
  onCompact,
  onRegenerate,
}: {
  message: ConversationDetailView["messages"][number];
  artifacts: readonly DocumentArtifactView[];
  onExportArtifact(id: string, revisionId: string): void;
  onPreviewArtifact(id: string, revisionId: string): void;
  onCompact?: (() => void) | undefined;
  onRegenerate?: (() => void) | undefined;
}) {
  const assistant = message.role === "assistant";
  const [copyError, setCopyError] = useState(false);
  const showBubble = shouldShowReplyBubble({
    role: message.role,
    status: message.status,
    content: message.content,
    hasArtifacts: artifacts.length > 0,
    hasCitations: Boolean(message.knowledgeCitations && message.knowledgeCitations.length > 0),
  });
  return (
    <article className={cn("group flex", assistant ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[88%]", assistant ? "w-full" : undefined)}>
        {assistant ? (
          <AssistantReplyProgress
            status={message.status}
            createdAt={message.createdAt}
            updatedAt={message.updatedAt}
            {...(message.steps ? { steps: message.steps } : {})}
          />
        ) : null}
        {showBubble ? (
          <>
            <div
              aria-label={assistant ? "回复内容" : "用户消息"}
              className={cn(
                "rounded-[14px] px-4 py-2.5 text-sm leading-6",
                assistant
                  ? "rounded-tl-none bg-white text-neutral-700 shadow-sm ring-1 ring-black/5"
                  : "rounded-tr-none bg-neutral-900 text-white shadow-sm",
              )}
            >
              <div className="markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ children }) => (
                      <span
                        className="underline decoration-neutral-300 underline-offset-2"
                        title="外部链接暂未开放"
                      >
                        {children}
                      </span>
                    ),
                  }}
                >
                  {message.content || ""}
                </ReactMarkdown>
              </div>
              <MessageAttachmentCards
                artifacts={artifacts}
                dark={!assistant}
                onExport={onExportArtifact}
                onPreview={onPreviewArtifact}
              />
              {assistant && message.knowledgeCitations && message.knowledgeCitations.length > 0 && (
                <Citations citations={message.knowledgeCitations} />
              )}
              {assistant &&
                (message.status === "completed" ||
                  message.status === "cancelled" ||
                  message.status === "failed") && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {(message.status === "cancelled" || message.status === "failed") && (
                        <p className="text-[11px] leading-5 text-neutral-400">
                          {statusLabel(message.status)}
                        </p>
                      )}
                      <AssistantReplyMeta
                        usage={message.usage}
                        modelDisplayName={message.modelDisplayName}
                      />
                    </div>
                    {(onRegenerate || message.status === "completed") && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        {onRegenerate ? (
                          <RegenerateReplyButton onRegenerate={onRegenerate} />
                        ) : null}
                        {message.status === "completed" ? (
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                type="button"
                                aria-label="回复操作"
                                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-violet-500"
                              >
                                <MoreHorizontal size={17} />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                className="z-50 min-w-40 rounded-xl border border-neutral-200 bg-white p-1 text-sm shadow-lg"
                              >
                                <DropdownMenu.Item
                                  className="cursor-pointer rounded-lg px-3 py-2 outline-none focus:bg-neutral-100"
                                  onSelect={() => {
                                    void copyMessageText(message.content)
                                      .then(() => setCopyError(false))
                                      .catch(() => setCopyError(true));
                                  }}
                                >
                                  复制当前内容
                                </DropdownMenu.Item>
                                {onCompact && (
                                  <DropdownMenu.Item
                                    className="cursor-pointer rounded-lg px-3 py-2 outline-none focus:bg-neutral-100"
                                    onSelect={onCompact}
                                  >
                                    压缩当前会话
                                  </DropdownMenu.Item>
                                )}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        ) : null}
                        {copyError && (
                          <span role="alert" className="ml-2 text-xs text-red-600">
                            复制失败，请重试
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
            </div>
            {assistant ? (
              <AssistantMessageFooter
                timestamp={
                  message.status === "pending" || message.status === "streaming"
                    ? message.createdAt
                    : message.updatedAt
                }
              />
            ) : (
              <UserMessageFooter createdAt={message.createdAt} content={message.content} />
            )}
          </>
        ) : null}
      </div>
    </article>
  );
}

export function shouldShowReplyBubble({
  role,
  status,
  content,
  hasArtifacts,
  hasCitations,
}: {
  role: ConversationDetailView["messages"][number]["role"];
  status: ConversationDetailView["messages"][number]["status"];
  content: string;
  hasArtifacts: boolean;
  hasCitations: boolean;
}): boolean {
  if (role !== "assistant") return true;
  const live = status === "pending" || status === "streaming";
  if (!live) return true;
  return content.trim().length > 0 || hasArtifacts || hasCitations;
}

function Citations({ citations }: { citations: readonly KnowledgeCitationView[] }) {
  return (
    <div className="mt-3 border-t border-neutral-100 pt-3">
      <p className="text-[11px] font-medium text-neutral-500">本次参考来源</p>
      <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-neutral-500">
        {citations.map((citation) => (
          <li key={citation.chunkId}>
            [资料{citation.index}] {citation.knowledgeBaseName} / {citation.documentName} ·{" "}
            {citationLocation(citation.metadata)}
          </li>
        ))}
      </ul>
    </div>
  );
}

const REGENERATE_WARNING = "点击将重新生成内容，此会话后的内容都将被覆盖，请谨慎操作";

function RegenerateReplyButton({ onRegenerate }: { onRegenerate(): void }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label="重新生成"
          className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-violet-500"
          onClick={onRegenerate}
        >
          <RefreshCw size={15} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          className="z-50 max-w-xs rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs leading-5 text-white shadow-lg"
        >
          {REGENERATE_WARNING}
          <Tooltip.Arrow className="fill-neutral-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function statusLabel(status: ConversationDetailView["messages"][number]["status"]) {
  if (status === "streaming" || status === "pending") return "生成中";
  if (status === "cancelled") return "已停止";
  if (status === "failed") return "生成失败，可重新生成";
  return "";
}

function citationLocation(metadata: KnowledgeCitationView["metadata"]): string {
  if (metadata.pageNumber) return `第 ${metadata.pageNumber} 页`;
  if (metadata.slideNumber) return `第 ${metadata.slideNumber} 张幻灯片`;
  if (metadata.sheetName) return `Sheet：${metadata.sheetName}`;
  if (metadata.heading) return `章节：${metadata.heading}`;
  return "正文";
}
