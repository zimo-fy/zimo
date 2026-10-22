import type { AgentStreamEnvelopeView, ConversationDetailView } from "@zimo/contracts";
import { useEffect, type Dispatch, type SetStateAction } from "react";

import { applyStreamEnvelope } from "./chat-stream";

export function useChatStreamSubscription(input: {
  setDetail: Dispatch<SetStateAction<ConversationDetailView | null>>;
  setSending: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  applyApproval(envelope: AgentStreamEnvelopeView): void;
  applyQuestion(envelope: AgentStreamEnvelopeView): void;
  onTerminal(): void;
}) {
  const { setDetail, setSending, setError, applyApproval, applyQuestion, onTerminal } = input;
  useEffect(
    () =>
      window.zimo.conversations.onStream((envelope) => {
        applyApproval(envelope);
        applyQuestion(envelope);
        applyStreamEnvelope(envelope, setDetail);
        if (!envelope.event.type.startsWith("run.")) return;
        setSending(false);
        onTerminal();
        if (envelope.event.type === "run.failed") setError(envelope.event.error.message);
      }),
    [applyApproval, applyQuestion, onTerminal, setDetail, setError, setSending],
  );
}
