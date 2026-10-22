import { z } from "zod";
import { contextCompactionTriggerSchema, contextCompactionViewSchema } from "./context-compaction";
import { pendingUserQuestionSchema } from "./user-questions";

export const serializedAppErrorSchema = z
  .object({
    code: z.string().min(1).max(80),
    category: z.enum([
      "user",
      "configuration",
      "network",
      "model",
      "storage",
      "security",
      "internal",
    ]),
    message: z.string().min(1).max(500),
    retryable: z.boolean(),
    details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .strict();
export type SerializedAppError = z.infer<typeof serializedAppErrorSchema>;

export const tokenUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
    cachedInputTokens: z.number().int().nonnegative().optional(),
  })
  .strict();

export const knowledgeCitationViewSchema = z
  .object({
    index: z.number().int().min(1).max(8),
    knowledgeBaseId: z.uuid(),
    knowledgeBaseName: z.string().min(1).max(120),
    documentId: z.uuid(),
    documentName: z.string().min(1).max(180),
    chunkId: z.uuid(),
    score: z.number().min(0).max(1),
    metadata: z
      .object({
        pageNumber: z.number().int().positive().optional(),
        slideNumber: z.number().int().positive().optional(),
        sheetName: z.string().max(160).optional(),
        heading: z.string().max(500).optional(),
        startIndex: z.number().int().nonnegative().optional(),
        endIndex: z.number().int().nonnegative().optional(),
      })
      .strict(),
  })
  .strict();
export type KnowledgeCitationView = z.infer<typeof knowledgeCitationViewSchema>;

export const assistantStepSchema = z
  .object({
    id: z.string().min(1).max(120),
    kind: z.enum([
      "file_read",
      "file_write",
      "file_delete",
      "command",
      "network",
      "external_app",
      "tool",
    ]),
    title: z.string().min(1).max(80),
    status: z.enum(["running", "completed", "denied", "failed", "cancelled"]),
    resultTitle: z.string().min(1).max(80).optional(),
    relativeTarget: z.string().min(1).max(80).optional(),
  })
  .strict();
export type AssistantStepView = z.infer<typeof assistantStepSchema>;

export const routeIntentSchema = z.enum(["chat", "agent", "skill", "workflow", "unknown"]);
export const intentRouteSchema = z
  .object({
    intent: routeIntentSchema,
    targetId: z.uuid().optional(),
    confidence: z.number().min(0).max(1),
    parameters: z.record(z.string().max(80), z.unknown()),
    reason: z.string().max(300).optional(),
    shouldExecute: z.literal(false),
  })
  .strict();
export type IntentRouteView = z.infer<typeof intentRouteSchema>;

export const approvalRequestedSchema = z
  .object({
    type: z.literal("approval.requested"),
    approvalId: z.uuid(),
    conversationId: z.uuid(),
    actionDigest: z.string().regex(/^[a-f0-9]{64}$/),
    actionKind: z.enum(["file_write", "file_delete", "command", "network", "external_app"]),
    risk: z.enum(["low", "medium", "high"]),
    summary: z.string().min(1).max(300),
    workspaceId: z.uuid().optional(),
    relativeTarget: z.string().min(1).max(1_000).optional(),
    command: z.string().min(1).max(20_000).optional(),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export const agentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message.started"), messageId: z.uuid() }).strict(),
  z.object({ type: z.literal("message.delta"), messageId: z.uuid(), text: z.string() }).strict(),
  z.object({ type: z.literal("message.completed"), messageId: z.uuid() }).strict(),
  z
    .object({
      type: z.literal("agent.started"),
      agentId: z.uuid(),
      agentName: z.string().min(1).max(120),
      skillIds: z.array(z.uuid()).max(50),
    })
    .strict(),
  z
    .object({
      type: z.literal("knowledge.retrieved"),
      messageId: z.uuid(),
      citations: z.array(knowledgeCitationViewSchema).max(8),
    })
    .strict(),
  z.object({ type: z.literal("route.completed"), route: intentRouteSchema }).strict(),
  z
    .object({
      type: z.literal("usage.updated"),
      usage: tokenUsageSchema,
      messageId: z.uuid().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("message.steps.updated"),
      messageId: z.uuid(),
      steps: z.array(assistantStepSchema).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("context.compaction.started"),
      compaction: contextCompactionViewSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("context.compaction.completed"),
      compaction: contextCompactionViewSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("context.compaction.failed"),
      compactionId: z.uuid(),
      trigger: contextCompactionTriggerSchema,
      errorCode: z.string().min(1).max(80),
    })
    .strict(),
  approvalRequestedSchema,
  z.object({ type: z.literal("question.requested"), question: pendingUserQuestionSchema }).strict(),
  z.object({ type: z.literal("question.resolved"), questionId: z.uuid() }).strict(),
  z
    .object({
      type: z.literal("approval.resolved"),
      approvalId: z.uuid(),
      conversationId: z.uuid(),
      decision: z.enum(["allowed_once", "denied", "expired", "cancelled"]),
    })
    .strict(),
  z.object({ type: z.literal("run.cancelled") }).strict(),
  z.object({ type: z.literal("run.completed") }).strict(),
  z.object({ type: z.literal("run.failed"), error: serializedAppErrorSchema }).strict(),
]);

export const agentStreamEnvelopeSchema = z
  .object({
    runId: z.uuid(),
    sequence: z.number().int().nonnegative(),
    emittedAt: z.iso.datetime(),
    event: agentStreamEventSchema,
  })
  .strict();
export type AgentStreamEnvelopeView = z.infer<typeof agentStreamEnvelopeSchema>;
export type ApprovalRequestedView = z.infer<typeof approvalRequestedSchema>;
