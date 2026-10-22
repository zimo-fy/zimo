import { z } from "zod";

import { updateSettingsInputSchema } from "./app";
import { loginInputSchema } from "./auth";
import { conversationCapabilityViewShape } from "./conversation-capabilities";
import { conversationCatalogModelShape } from "./model-catalog";
import {
  assistantStepSchema,
  knowledgeCitationViewSchema,
  serializedAppErrorSchema,
  tokenUsageSchema,
} from "./conversation-stream";
import type { SerializedAppError } from "./conversation-stream";
import { contextCompactionViewSchema } from "./context-compaction";
import { saveUserMemoryInputSchema } from "./user-memory";
import { modelCapabilitiesSchema } from "./model-capabilities";
import { knowledgeCloudSyncRequestSchema } from "./knowledge-catalog";

export * from "./communication-channels";
export * from "./model-catalog";
export * from "./knowledge-catalog";
export * from "./documents";
export * from "./document-image-url";
export * from "./agent-marketplace";
export * from "./app";
export * from "./app-updates";
export * from "./automation";
export * from "./conversation-capabilities";
export * from "./mcp";
export * from "./auth";
export * from "./skill-marketplace";
export * from "./approvals";
export * from "./conversation-stream";
export * from "./context-compaction";
export * from "./user-memory";
export * from "./user-questions";
export * from "./web-access";
export * from "./model-capabilities";
export * from "./conversation-tasks";
export { serializedAppErrorSchema };
export type { SerializedAppError } from "./conversation-stream";
export const requestIdSchema = z.uuid();

export function ipcRequestSchema<T extends z.ZodType>(payload: T) {
  return z.object({ requestId: requestIdSchema, payload }).strict();
}

export type IpcResult<T> =
  | { ok: true; requestId: string; data: T }
  | { ok: false; requestId: string; error: SerializedAppError };

export function ipcResultSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), requestId: requestIdSchema, data }).strict(),
    z
      .object({ ok: z.literal(false), requestId: requestIdSchema, error: serializedAppErrorSchema })
      .strict(),
  ]);
}

export const emptyPayloadSchema = z.object({}).strict();
export const successViewSchema = z.object({ success: z.literal(true) }).strict();
export const loginRequestSchema = ipcRequestSchema(loginInputSchema);
export const emptyRequestSchema = ipcRequestSchema(emptyPayloadSchema);
export const saveUserMemoryRequestSchema = ipcRequestSchema(saveUserMemoryInputSchema);
export const deleteUserMemoryRequestSchema = ipcRequestSchema(z.object({ id: z.uuid() }).strict());
export const compactConversationRequestSchema = ipcRequestSchema(
  z.object({ conversationId: z.uuid() }).strict(),
);
export const updateSettingsRequestSchema = ipcRequestSchema(updateSettingsInputSchema);

export const modelViewSchema = z
  .object({
    id: z.uuid(),
    providerId: z.uuid(),
    name: z.string().max(120),
    displayName: z.string().max(120),
    capabilities: modelCapabilitiesSchema,
    enabled: z.boolean(),
  })
  .strict();

export type ModelView = z.infer<typeof modelViewSchema>;

export const modelProviderViewSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(80),
    baseUrl: z.string().max(2_000),
    keyHint: z.string().min(1).max(20),
    kind: z.literal("openai-compatible"),
    enabled: z.boolean(),
    models: z.array(modelViewSchema).max(100),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type ModelProviderView = z.infer<typeof modelProviderViewSchema>;

export const saveProviderInputSchema = z
  .object({
    providerId: z.uuid().optional(),
    name: z.string().trim().min(1).max(80),
    baseUrl: z.url().max(2_000),
    apiKey: z.string().min(1).max(4_096).optional(),
    enabled: z.boolean().optional(),
    model: z
      .object({
        id: z.uuid().optional(),
        name: z.string().trim().min(1).max(120),
        displayName: z.string().trim().min(1).max(120),
        capabilities: modelCapabilitiesSchema.optional(),
      })
      .strict(),
  })
  .strict();

export type SaveProviderInput = z.infer<typeof saveProviderInputSchema>;

export const testProviderInputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("saved"), providerId: z.uuid() }).strict(),
  z.object({ mode: z.literal("native_search"), providerId: z.uuid() }).strict(),
  z
    .object({
      mode: z.literal("draft"),
      baseUrl: z.url().max(2_000),
      apiKey: z.string().min(1).max(4_096),
      modelName: z.string().trim().min(1).max(120),
    })
    .strict(),
]);

export type TestProviderInput = z.infer<typeof testProviderInputSchema>;

export const modelTestResultSchema = z
  .object({
    ok: z.literal(true),
    latencyMs: z.number().nonnegative(),
    sourceCount: z.number().int().nonnegative().optional(),
    errorCount: z.number().int().nonnegative().optional(),
  })
  .strict();

export type ModelTestResult = z.infer<typeof modelTestResultSchema>;

export const defaultModelViewSchema = z.object({ modelId: z.uuid().nullable() }).strict();
export type DefaultModelView = z.infer<typeof defaultModelViewSchema>;

export const messageStatusSchema = z.enum([
  "pending",
  "streaming",
  "completed",
  "cancelled",
  "failed",
]);

export const messageViewSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().max(2_000_000),
    status: messageStatusSchema,
    position: z.number().int().nonnegative(),
    replacesMessageId: z.uuid().optional(),
    errorCode: z.string().max(80).optional(),
    usage: tokenUsageSchema.optional(),
    knowledgeCitations: z.array(knowledgeCitationViewSchema).max(8).optional(),
    steps: z.array(assistantStepSchema).max(100).optional(),
    modelDisplayName: z.string().min(1).max(120).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type MessageView = z.infer<typeof messageViewSchema>;

export const routeTargetViewSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["agent", "skill", "workflow"]),
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    enabled: z.boolean(),
  })
  .strict();
export type RouteTargetView = z.infer<typeof routeTargetViewSchema>;

export const conversationDetailViewSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(120),
    modelId: z.uuid(),
    ...conversationCatalogModelShape,
    ...conversationCapabilityViewShape,
    activeRunId: z.uuid().optional(),
    messages: z.array(messageViewSchema).max(20_000),
    contextCompactions: z.array(contextCompactionViewSchema).max(100),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type ConversationDetailView = z.infer<typeof conversationDetailViewSchema>;

export const conversationSummaryViewSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(120),
    modelId: z.uuid(),
    modelDisplayName: z.string().min(1).max(120),
    messageCount: z.number().int().nonnegative(),
    lastMessagePreview: z.string().max(120).optional(),
    isPinned: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type ConversationSummaryView = z.infer<typeof conversationSummaryViewSchema>;

export const workflowRunInputSchema = z
  .object({
    workflowId: z.uuid(),
    input: z.string().trim().min(1).max(100_000),
    confirmedToolIds: z.array(z.string().min(1).max(128)).max(20).default([]),
  })
  .strict();
export const workflowRunRequestSchema = ipcRequestSchema(workflowRunInputSchema);
export const workflowRunAcceptedSchema = z.object({ runId: z.uuid() }).strict();
export const workflowCancelInputSchema = z.object({ runId: z.uuid() }).strict();
export const workflowCancelRequestSchema = ipcRequestSchema(workflowCancelInputSchema);
export const workflowNodeRunStatusSchema = z.enum(["running", "completed", "skipped", "failed"]);
export const workflowStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run.started"), workflowId: z.uuid() }).strict(),
  z
    .object({
      type: z.literal("node.started"),
      nodeId: z.string().min(1).max(80),
      nodeType: z.enum([
        "start",
        "agent",
        "skill",
        "knowledge",
        "tool",
        "condition",
        "approval",
        "end",
      ]),
      label: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({
      type: z.literal("node.completed"),
      nodeId: z.string().min(1).max(80),
      durationMs: z.number().int().nonnegative(),
      outputPreview: z.string().max(500).optional(),
      citations: z.array(knowledgeCitationViewSchema).max(8).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("node.skipped"),
      nodeId: z.string().min(1).max(80),
      reason: z.string().min(1).max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal("node.failed"),
      nodeId: z.string().min(1).max(80),
      error: serializedAppErrorSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("run.completed"),
      output: z.string().max(2_000_000),
      citations: z.array(knowledgeCitationViewSchema).max(8),
      durationMs: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ type: z.literal("run.cancelled") }).strict(),
  z.object({ type: z.literal("run.failed"), error: serializedAppErrorSchema }).strict(),
]);
export const workflowStreamEnvelopeSchema = z
  .object({
    runId: z.uuid(),
    sequence: z.number().int().nonnegative(),
    emittedAt: z.iso.datetime(),
    event: workflowStreamEventSchema,
  })
  .strict();
export type WorkflowStreamEnvelopeView = z.infer<typeof workflowStreamEnvelopeSchema>;

export const toolCapabilityViewSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
    title: z.string().min(1).max(120),
    description: z.string().min(1).max(500),
    source: z.enum(["builtin", "mcp", "skill"]),
    permissions: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            title: z.string().min(1).max(120),
            description: z.string().min(1).max(300),
            risk: z.enum(["low", "medium", "high"]),
          })
          .strict(),
      )
      .max(20),
    inputSchema: z.record(z.string(), z.unknown()),
    annotations: z
      .object({
        readOnly: z.boolean(),
        destructive: z.boolean(),
        idempotent: z.boolean(),
        openWorld: z.boolean(),
      })
      .strict(),
    confirmation: z.literal("per_run"),
    timeoutMs: z.number().int().min(100).max(60_000),
  })
  .strict();
export type ToolCapabilityView = z.infer<typeof toolCapabilityViewSchema>;

export const sendAcceptedSchema = z
  .object({ runId: z.uuid(), userMessageId: z.uuid(), assistantMessageId: z.uuid() })
  .strict();

export const regenerateAcceptedSchema = z
  .object({ runId: z.uuid(), assistantMessageId: z.uuid() })
  .strict();
export const cancelResultSchema = z.object({ accepted: z.boolean() }).strict();

export const conversationIdInputSchema = z.object({ conversationId: z.uuid() }).strict();
export const providerIdInputSchema = z.object({ providerId: z.uuid() }).strict();
export const modelIdInputSchema = z.object({ modelId: z.uuid() }).strict();
export const createConversationInputSchema = z.object({ modelId: z.uuid().optional() }).strict();
export const renameConversationInputSchema = z
  .object({ conversationId: z.uuid(), title: z.string().trim().min(1).max(120) })
  .strict();
export const changeConversationModelInputSchema = z
  .object({ conversationId: z.uuid(), modelId: z.uuid() })
  .strict();
export const sendMessageInputSchema = z
  .object({
    conversationId: z.uuid(),
    content: z.string().trim().min(1).max(100_000),
    artifactIds: z.array(z.uuid()).max(10).default([]),
  })
  .strict();
export const cancelRunInputSchema = z.object({ runId: z.uuid() }).strict();
export const regenerateMessageInputSchema = z
  .object({ conversationId: z.uuid(), messageId: z.uuid() })
  .strict();

export const saveProviderRequestSchema = ipcRequestSchema(saveProviderInputSchema);
export const deleteProviderRequestSchema = ipcRequestSchema(providerIdInputSchema);
export const testProviderRequestSchema = ipcRequestSchema(testProviderInputSchema);
export const setDefaultModelRequestSchema = ipcRequestSchema(modelIdInputSchema);
export const conversationIdRequestSchema = ipcRequestSchema(conversationIdInputSchema);
export const createConversationRequestSchema = ipcRequestSchema(createConversationInputSchema);
export const renameConversationRequestSchema = ipcRequestSchema(renameConversationInputSchema);
export const changeConversationModelRequestSchema = ipcRequestSchema(
  changeConversationModelInputSchema,
);
export const sendMessageRequestSchema = ipcRequestSchema(sendMessageInputSchema);
export const cancelRunRequestSchema = ipcRequestSchema(cancelRunInputSchema);
export const regenerateMessageRequestSchema = ipcRequestSchema(regenerateMessageInputSchema);

export const prototypeKindSchema = z.enum([
  "agent",
  "skill",
  "knowledge",
  "workflow",
  "plugin",
  "mcp",
  "automation",
]);
export type PrototypeKindDto = z.infer<typeof prototypeKindSchema>;

export const prototypeStatusSchema = z.enum(["draft", "enabled", "disabled"]);
export const installationStatusSchema = z.enum(["not_installed", "installed", "update_available"]);
export const workflowNodeTypeSchema = z.enum([
  "start",
  "agent",
  "skill",
  "knowledge",
  "tool",
  "condition",
  "approval",
  "end",
]);
export const workflowNodeSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    type: workflowNodeTypeSchema,
    label: z.string().trim().min(1).max(80),
    position: z
      .object({
        x: z.number().finite().min(-100_000).max(100_000),
        y: z.number().finite().min(-100_000).max(100_000),
      })
      .strict(),
    config: z
      .object({
        agentId: z.uuid().optional(),
        skillId: z.uuid().optional(),
        knowledgeBaseId: z.uuid().optional(),
        toolId: z
          .string()
          .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
          .optional(),
        instruction: z.string().trim().max(4_000).optional(),
        expression: z.string().trim().max(1_000).optional(),
        inputKey: z.string().trim().min(1).max(80).optional(),
        outputKey: z.string().trim().min(1).max(80).optional(),
        topK: z.number().int().min(1).max(20).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const workflowEdgeSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    source: z.string().trim().min(1).max(80),
    target: z.string().trim().min(1).max(80),
    sourceHandle: z.string().trim().min(1).max(80).optional(),
    targetHandle: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export const prototypeDocumentSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(180),
    sizeLabel: z.string().trim().min(1).max(40),
    status: z.enum(["queued", "processing", "ready", "failed"]),
  })
  .strict();

export const prototypeSummaryViewSchema = z
  .object({
    id: z.uuid(),
    kind: prototypeKindSchema,
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    status: prototypeStatusSchema,
    category: z.string().max(80),
    tags: z.array(z.string().min(1).max(40)).max(20),
    icon: z.string().min(1).max(8),
    version: z.string().min(1).max(40),
    installationStatus: installationStatusSchema.optional(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type PrototypeSummaryView = z.infer<typeof prototypeSummaryViewSchema>;

export const prototypeDetailViewSchema = prototypeSummaryViewSchema
  .extend({
    source: z.string().max(160),
    modelId: z.uuid().optional(),
    systemPrompt: z.string().max(20_000).optional(),
    skillIds: z.array(z.uuid()).max(50).optional(),
    knowledgeBaseIds: z.array(z.uuid()).max(5).optional(),
    mcpServerIds: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/))
      .max(20)
      .optional(),
    skillPackageId: z.string().max(80).optional(),
    skillInstructions: z.string().max(262_144).optional(),
    permissions: z.array(z.string().min(1).max(80)).max(30),
    capabilities: z.array(z.string().min(1).max(80)).max(50),
    associations: z.array(z.string().min(1).max(120)).max(50),
    secretHint: z.string().max(80).optional(),
    triggerType: z.enum(["manual", "schedule", "webhook", "message", "file_change"]).optional(),
    workflowNodes: z.array(workflowNodeSchema).max(200),
    workflowEdges: z.array(workflowEdgeSchema).max(500),
    documents: z.array(prototypeDocumentSchema).max(500),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type PrototypeDetailView = z.infer<typeof prototypeDetailViewSchema>;

export const prototypeListInputSchema = z
  .object({
    kind: prototypeKindSchema,
    query: z.string().trim().max(120).optional(),
    status: prototypeStatusSchema.optional(),
  })
  .strict();
export const prototypeGetInputSchema = z
  .object({ kind: prototypeKindSchema, id: z.uuid() })
  .strict();
const prototypeEditableSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500),
    category: z.string().trim().max(80),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    status: prototypeStatusSchema,
    modelId: z.uuid().optional(),
    systemPrompt: z.string().max(20_000).optional(),
    skillIds: z.array(z.uuid()).max(50).optional(),
    knowledgeBaseIds: z.array(z.uuid()).max(5).optional(),
    mcpServerIds: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/))
      .max(20)
      .optional(),
    permissions: z.array(z.string().trim().min(1).max(80)).max(30),
    associations: z.array(z.string().trim().min(1).max(120)).max(50),
    triggerType: z.enum(["manual", "schedule", "webhook", "message", "file_change"]).optional(),
  })
  .strict();
export type PrototypeEditableInput = z.infer<typeof prototypeEditableSchema>;
export const prototypeMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      kind: prototypeKindSchema,
      value: prototypeEditableSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("update"),
      kind: prototypeKindSchema,
      id: z.uuid(),
      value: prototypeEditableSchema,
    })
    .strict(),
  z.object({ action: z.literal("duplicate"), kind: prototypeKindSchema, id: z.uuid() }).strict(),
  z.object({ action: z.literal("delete"), kind: prototypeKindSchema, id: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("set-status"),
      kind: prototypeKindSchema,
      id: z.uuid(),
      status: prototypeStatusSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("set-installation"),
      kind: z.enum(["skill", "plugin"]),
      id: z.uuid(),
      status: installationStatusSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("save-workflow"),
      kind: z.literal("workflow"),
      id: z.uuid(),
      nodes: z.array(workflowNodeSchema).max(200),
      edges: z.array(workflowEdgeSchema).max(500),
      mcpServerIds: z
        .array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/))
        .max(20)
        .optional(),
    })
    .strict(),
  z.object({ action: z.literal("preview"), kind: prototypeKindSchema, id: z.uuid() }).strict(),
]);
export type PrototypeMutation = z.infer<typeof prototypeMutationSchema>;
export const prototypeListRequestSchema = ipcRequestSchema(prototypeListInputSchema);
export const prototypeGetRequestSchema = ipcRequestSchema(prototypeGetInputSchema);
export const prototypeMutationRequestSchema = ipcRequestSchema(prototypeMutationSchema);
export const routeTargetListInputSchema = z
  .object({ type: z.enum(["agent", "skill", "workflow"]).optional() })
  .strict();
export const routeTargetListRequestSchema = ipcRequestSchema(routeTargetListInputSchema);

export const knowledgeDocumentViewSchema = z
  .object({
    id: z.uuid(),
    knowledgeBaseId: z.uuid(),
    name: z.string().min(1).max(180),
    mediaType: z.string().min(1).max(160),
    sizeBytes: z
      .number()
      .int()
      .nonnegative()
      .max(20 * 1_024 * 1_024),
    status: z.enum(["queued", "processing", "ready", "failed"]),
    errorCode: z.string().max(80).optional(),
    chunkCount: z.number().int().nonnegative().max(100_000),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type KnowledgeDocumentView = z.infer<typeof knowledgeDocumentViewSchema>;

export const embeddingModelViewSchema = z
  .object({
    key: z.literal("bge-small-zh-v1.5-int8"),
    displayName: z.string().min(1).max(120),
    revision: z.string().min(7).max(40),
    dimensions: z.literal(512),
    status: z.enum(["ready", "failed"]),
    localOnly: z.boolean(),
    errorCode: z.string().max(80).optional(),
  })
  .strict();
export type EmbeddingModelView = z.infer<typeof embeddingModelViewSchema>;

export const knowledgeBaseIdInputSchema = z.object({ knowledgeBaseId: z.uuid() }).strict();
export const knowledgeDroppedImportInputSchema = z
  .object({
    knowledgeBaseId: z.uuid(),
    sourcePaths: z.array(z.string().min(1).max(4_096)).min(1).max(20),
  })
  .strict();
export const knowledgeDeleteDocumentInputSchema = z
  .object({ knowledgeBaseId: z.uuid(), documentId: z.uuid() })
  .strict();
export const knowledgeSearchInputSchema = z
  .object({
    knowledgeBaseId: z.uuid(),
    query: z.string().trim().min(1).max(2_000),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();
export const knowledgeSearchHitViewSchema = z
  .object({
    chunkId: z.uuid(),
    documentId: z.uuid(),
    documentName: z.string().min(1).max(180),
    text: z.string().min(1).max(8_000),
    score: z.number().min(0).max(1),
    matchType: z.enum(["keyword", "semantic", "hybrid"]),
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
export type KnowledgeSearchHitView = z.infer<typeof knowledgeSearchHitViewSchema>;
export const knowledgeImportResultViewSchema = z
  .object({
    imported: z.array(knowledgeDocumentViewSchema).max(20),
    duplicates: z.array(knowledgeDocumentViewSchema).max(20),
  })
  .strict();
export type KnowledgeImportResultView = z.infer<typeof knowledgeImportResultViewSchema>;

const droppedImportInput = knowledgeDroppedImportInputSchema;
const deleteDocumentInput = knowledgeDeleteDocumentInputSchema;
export const knowledgeBaseIdRequestSchema = ipcRequestSchema(knowledgeBaseIdInputSchema);
export const knowledgeDroppedImportRequestSchema = ipcRequestSchema(droppedImportInput);
export const knowledgeDeleteDocumentRequestSchema = ipcRequestSchema(deleteDocumentInput);
export const knowledgeSearchRequestSchema = ipcRequestSchema(knowledgeSearchInputSchema);
export const knowledgeCloudSyncDirectoryRequestSchema = ipcRequestSchema(
  knowledgeCloudSyncRequestSchema,
);

export { IPC_CHANNELS } from "./ipc-channels";
export * from "./workspaces";
export * from "./security-audit";
export type { ZimoDesktopApi } from "./desktop-api";
