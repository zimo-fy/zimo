import type { AgentStreamEnvelopeView, PendingApprovalView, ZimoDesktopApi } from "@zimo/contracts";
import { useCallback, useState } from "react";

type ApprovalApi = ZimoDesktopApi["approvals"];

export function useChatApprovals(onError: (message: string | null) => void) {
  const [pending, setPending] = useState<readonly PendingApprovalView[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (conversationId: string): Promise<void> => {
      try {
        const result = await requireApi().listPending(crypto.randomUUID(), conversationId);
        if (result.ok) setPending(result.data);
        else onError(result.error.message);
      } catch {
        onError("审批功能尚未加载，请完全退出并重新启动 Zimo 后重试。");
      }
    },
    [onError],
  );

  const applyStream = useCallback((envelope: AgentStreamEnvelopeView): void => {
    if (envelope.event.type === "approval.requested") {
      const event = envelope.event;
      setPending((current) => [
        ...current.filter((item) => item.event.approvalId !== event.approvalId),
        { runId: envelope.runId, event },
      ]);
    } else if (envelope.event.type === "approval.resolved") {
      const event = envelope.event;
      setPending((current) => current.filter((item) => item.event.approvalId !== event.approvalId));
    }
  }, []);

  async function resolve(item: PendingApprovalView, decision: "allowed_once" | "denied") {
    if (busy) return;
    setBusy(true);
    try {
      const result = await requireApi().resolve(
        crypto.randomUUID(),
        item.event.approvalId,
        item.event.actionDigest,
        decision,
      );
      if (!result.ok) onError(result.error.message);
      else if (!result.data.accepted) onError("审批已失效或不属于当前窗口，请重新发起操作。");
    } catch {
      onError("审批操作未能完成，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return { pending, busy, refresh, applyStream, resolve };
}

function requireApi(): ApprovalApi {
  const api = (window.zimo as Partial<ZimoDesktopApi>).approvals;
  if (!api) throw new Error("Approval bridge unavailable");
  return api;
}
