import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatReplyTime } from "./assistant-reply-format";
import { copyMessageText } from "./copy-message-text";

const COPY_SUCCESS_MS = 2000;

export function AssistantMessageFooter({ timestamp }: { timestamp: string }) {
  return (
    <div className="mt-2 px-1 text-left text-[11px] leading-5 text-neutral-400">
      <time dateTime={timestamp}>{formatReplyTime(timestamp)}</time>
    </div>
  );
}

export function UserMessageFooter({ createdAt, content }: { createdAt: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const resetCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetCopiedTimer.current) clearTimeout(resetCopiedTimer.current);
    };
  }, []);

  const markCopied = () => {
    setCopyError(false);
    setCopied(true);
    if (resetCopiedTimer.current) clearTimeout(resetCopiedTimer.current);
    resetCopiedTimer.current = setTimeout(() => setCopied(false), COPY_SUCCESS_MS);
  };

  return (
    <div className="mt-2 flex items-center justify-end gap-1.5 px-1 text-[11px] leading-5 text-neutral-400">
      <button
        type="button"
        aria-label={copied ? "已复制" : "复制"}
        className="grid size-6 shrink-0 place-items-center rounded-md bg-neutral-100 text-neutral-500 opacity-0 pointer-events-none transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-neutral-200 hover:text-neutral-700 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-violet-500"
        onClick={() => {
          void copyMessageText(content)
            .then(markCopied)
            .catch(() => {
              setCopied(false);
              setCopyError(true);
            });
        }}
      >
        {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
      </button>
      {copyError ? (
        <span role="alert" className="text-[11px] leading-5 text-red-600">
          复制失败
        </span>
      ) : null}
      <time dateTime={createdAt}>{formatReplyTime(createdAt)}</time>
    </div>
  );
}
