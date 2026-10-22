import type { AssistantStepView, MessageView } from "@zimo/contracts";
import { cn } from "@zimo/ui";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { elapsedSeconds, formatThinkingElapsed } from "./assistant-reply-format";

export function AssistantReplyProgress({
  status,
  createdAt,
  updatedAt,
  steps,
}: {
  status: MessageView["status"];
  createdAt: string;
  updatedAt: string;
  steps?: readonly AssistantStepView[];
}) {
  const live = status === "pending" || status === "streaming";
  const hasSteps = Boolean(steps && steps.length > 0);
  const [expanded, setExpanded] = useState(false);
  const seconds = useLiveElapsedSeconds(createdAt, live ? undefined : updatedAt);
  const label = formatThinkingElapsed(status, seconds);
  useEffect(() => {
    if (!live) setExpanded(false);
  }, [live]);
  return (
    <div className="mb-2 w-full min-w-0 pl-1" aria-label="思考过程">
      {hasSteps && !live ? (
        <button
          type="button"
          aria-expanded={expanded}
          className="inline-flex items-center gap-0.5 rounded-sm text-[11px] leading-5 text-neutral-400 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-violet-500"
          onClick={() => setExpanded((open) => !open)}
        >
          <ChevronRight
            size={12}
            aria-hidden="true"
            className={cn("shrink-0 transition-transform", expanded && "rotate-90")}
          />
          {label}
        </button>
      ) : (
        <p className="text-[11px] leading-5 text-neutral-400">{label}</p>
      )}
      {steps && (live || expanded) ? <AssistantStepList steps={steps} /> : null}
    </div>
  );
}

function AssistantStepList({ steps }: { steps: readonly AssistantStepView[] }) {
  return (
    <ol className="mt-1 space-y-0.5 text-[11px] leading-5 text-neutral-400">
      {steps.map((step) => (
        <li key={step.id}>
          <p>{step.title}</p>
          {step.status === "completed" && step.resultTitle ? <p>{step.resultTitle}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function useLiveElapsedSeconds(createdAt: string, endedAt: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [endedAt]);
  return elapsedSeconds(createdAt, endedAt ?? now);
}
