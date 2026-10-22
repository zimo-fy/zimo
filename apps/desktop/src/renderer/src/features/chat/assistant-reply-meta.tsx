import type { MessageView } from "@zimo/contracts";
import { Zap } from "lucide-react";

import { consumedTokens, formatTokenCount } from "./assistant-reply-format";

export function AssistantReplyMeta({
  usage,
  modelDisplayName,
}: {
  usage?: MessageView["usage"];
  modelDisplayName?: string | undefined;
}) {
  const tokens = consumedTokens(usage);
  return (
    <div
      role="group"
      aria-label="回复用量与模型"
      className="min-w-0 flex-1 text-[11px] leading-5 text-neutral-400"
    >
      {tokens !== undefined ? `共消耗 ${formatTokenCount(tokens)} tokens` : null}
      {tokens !== undefined ? <span aria-hidden="true"> · </span> : null}
      {modelDisplayName ? (
        <span className="inline-flex items-center gap-0.5 align-middle">
          <Zap size={11} className="shrink-0" aria-hidden="true" />
          {modelDisplayName}
        </span>
      ) : null}
    </div>
  );
}
