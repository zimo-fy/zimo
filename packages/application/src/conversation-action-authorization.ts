import type { AgentStreamEvent, ConversationId, RunId } from "@zimo/domain";

import type { ApprovalService } from "./approval-service";
import type { ToolActionAuthorizer } from "./tool-runtime";

export function createConversationActionAuthorizer(input: {
  approvals: ApprovalService | undefined;
  conversationId: ConversationId;
  runId: RunId;
  ownerId: string | undefined;
  mode: "ask" | "auto_approve";
  signal: AbortSignal;
  emit(event: AgentStreamEvent): void;
}): ToolActionAuthorizer | undefined {
  if (!input.approvals) return undefined;
  return async (request) =>
    input.approvals!.authorize({
      conversationId: input.conversationId,
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      mode: input.mode,
      toolId: request.toolId,
      input: request.input,
      action: request.action,
      context: request.context,
      signal: input.signal,
      emit: input.emit,
    });
}

export function conversationActionAuthorizationOption(
  input: Parameters<typeof createConversationActionAuthorizer>[0],
): { authorizeAction?: ToolActionAuthorizer } {
  const authorizeAction = createConversationActionAuthorizer(input);
  return authorizeAction ? { authorizeAction } : {};
}
