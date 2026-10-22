import type {
  ErrorCategory,
  IntentRoute,
  KnowledgeCitation,
  MessageId,
  PrototypeId,
  TokenUsage,
  AssistantStep,
} from "./index";
import type { ActionKind } from "./approvals";
import type { ContextCompactionStreamItem, ContextCompactionTrigger } from "./context-compaction";
import type { PendingUserQuestion } from "./user-questions";

export type ApprovalStreamDecision = "allowed_once" | "denied" | "expired" | "cancelled";

export type AgentStreamEvent =
  | { type: "message.started"; messageId: string }
  | { type: "message.delta"; messageId: string; text: string }
  | { type: "message.completed"; messageId: string }
  | {
      type: "agent.started";
      agentId: PrototypeId;
      agentName: string;
      skillIds: readonly PrototypeId[];
    }
  | {
      type: "knowledge.retrieved";
      messageId: MessageId;
      citations: readonly KnowledgeCitation[];
    }
  | { type: "route.completed"; route: IntentRoute }
  | { type: "usage.updated"; usage: TokenUsage; messageId?: string }
  | { type: "message.steps.updated"; messageId: MessageId; steps: readonly AssistantStep[] }
  | { type: "question.requested"; question: PendingUserQuestion }
  | { type: "question.resolved"; questionId: string }
  | {
      type: "context.compaction.started";
      compaction: ContextCompactionStreamItem;
    }
  | {
      type: "context.compaction.completed";
      compaction: ContextCompactionStreamItem;
    }
  | {
      type: "context.compaction.failed";
      compactionId: string;
      trigger: ContextCompactionTrigger;
      errorCode: string;
    }
  | {
      type: "approval.requested";
      approvalId: string;
      conversationId: string;
      actionDigest: string;
      actionKind: Exclude<ActionKind, "file_read">;
      risk: "low" | "medium" | "high";
      summary: string;
      workspaceId?: string;
      relativeTarget?: string;
      command?: string;
      expiresAt: string;
    }
  | {
      type: "approval.resolved";
      approvalId: string;
      conversationId: string;
      decision: ApprovalStreamDecision;
    }
  | { type: "run.cancelled" }
  | { type: "run.completed" }
  | {
      type: "run.failed";
      error: {
        code: string;
        category: ErrorCategory;
        message: string;
        retryable: boolean;
      };
    };

export interface AgentStreamEnvelope {
  runId: string;
  sequence: number;
  emittedAt: string;
  event: AgentStreamEvent;
}
