import type { ConversationId, MessageId } from "./index";

export type ContextCompactionStatus = "running" | "completed" | "failed";
export type ContextCompactionTrigger = "threshold" | "overflow_recovery" | "manual";

export interface ContextCompaction {
  id: string;
  conversationId: ConversationId;
  version: number;
  status: ContextCompactionStatus;
  trigger: ContextCompactionTrigger;
  sourceFromMessageId: MessageId;
  sourceToMessageId: MessageId;
  coveredThroughPosition: number;
  retainedFromPosition: number;
  summary?: string;
  inputTokens: number;
  outputTokens?: number;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ContextCompactionStreamItem = Omit<ContextCompaction, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export interface ContextCompactionRepository {
  listByConversation(conversationId: ConversationId): Promise<readonly ContextCompaction[]>;
  create(value: ContextCompaction): Promise<void>;
  complete(
    id: string,
    value: Readonly<{ summary: string; outputTokens: number; updatedAt: Date }>,
  ): Promise<void>;
  fail(id: string, value: Readonly<{ errorCode: string; updatedAt: Date }>): Promise<void>;
  repairInterrupted(updatedAt: Date): Promise<void>;
}
