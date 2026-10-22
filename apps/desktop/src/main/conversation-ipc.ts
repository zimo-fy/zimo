import type {
  AutomationService,
  ConversationService,
  DocumentArtifactService,
} from "@zimo/application";
import {
  cancelResultSchema,
  cancelRunRequestSchema,
  changeConversationAgentRequestSchema,
  changeConversationCapabilitiesRequestSchema,
  changeConversationKnowledgeRequestSchema,
  changeConversationModelRequestSchema,
  selectCatalogModelRequestSchema,
  conversationDetailViewSchema,
  compactConversationRequestSchema,
  conversationIdRequestSchema,
  conversationSummaryViewSchema,
  createConversationRequestSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  regenerateAcceptedSchema,
  regenerateMessageRequestSchema,
  renameConversationRequestSchema,
  setConversationPinnedRequestSchema,
  sendAcceptedSchema,
  sendMessageRequestSchema,
  successViewSchema,
} from "@zimo/contracts";
import type { StructuredLogger } from "@zimo/logging";

import { toConversationSummaryView, toConversationView } from "./conversation-view-mappers";
import { createConversationRunSink } from "./conversation-run-logging";
import type { RegisterIpcHandler } from "./ipc-handler";
import type { SensitiveModelPayloadLogger } from "./model-payload-logger";

export function registerConversationIpcHandlers(
  register: RegisterIpcHandler,
  options: {
    conversations: ConversationService;
    automations: AutomationService;
    documents: DocumentArtifactService;
    logger: StructuredLogger | null;
    modelPayloadLogger: SensitiveModelPayloadLogger | null;
  },
): void {
  register({
    channel: IPC_CHANNELS.conversationsList,
    input: emptyRequestSchema,
    output: conversationSummaryViewSchema.array(),
    handle: async () => (await options.conversations.list()).map(toConversationSummaryView),
  });
  register({
    channel: IPC_CHANNELS.conversationsGet,
    input: conversationIdRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }) =>
      toConversationView(await options.conversations.get(payload.conversationId)),
  });
  register({
    channel: IPC_CHANNELS.conversationsCreate,
    input: createConversationRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }) =>
      toConversationView(await options.conversations.create(payload.modelId)),
  });
  register({
    channel: IPC_CHANNELS.conversationsRename,
    input: renameConversationRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }) =>
      toConversationView(await options.conversations.rename(payload.conversationId, payload.title)),
  });
  register({
    channel: IPC_CHANNELS.conversationsSetPinned,
    input: setConversationPinnedRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.conversations.setPinned(payload.conversationId, payload.pinned);
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.conversationsChangeModel,
    input: changeConversationModelRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }) =>
      toConversationView(
        await options.conversations.changeModel(payload.conversationId, payload.modelId),
      ),
  });
  register({
    channel: IPC_CHANNELS.conversationsSelectCatalogModel,
    input: selectCatalogModelRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }) => {
      const detail = await options.conversations.selectCatalogModel(
        payload.conversationId,
        payload.catalogId,
      );
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "conversation.catalog_model.selected",
        message: "Conversation selected a cloud model",
        context: { conversationId: payload.conversationId, outcome: "success" },
      });
      return toConversationView(detail);
    },
  });
  register({
    channel: IPC_CHANNELS.conversationsChangeKnowledge,
    input: changeConversationKnowledgeRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }) =>
      toConversationView(
        await options.conversations.changeKnowledgeBases(
          payload.conversationId,
          payload.knowledgeBaseIds,
        ),
      ),
  });
  register({
    channel: IPC_CHANNELS.conversationsChangeAgent,
    input: changeConversationAgentRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }) =>
      toConversationView(
        await options.conversations.changeAgent(payload.conversationId, payload.agentId),
      ),
  });
  register({
    channel: IPC_CHANNELS.conversationsChangeCapabilities,
    input: changeConversationCapabilitiesRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }) =>
      toConversationView(
        await options.conversations.changeCapabilities(payload.conversationId, payload),
      ),
  });
  register({
    channel: IPC_CHANNELS.conversationsDelete,
    input: conversationIdRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.automations.assertConversationCanBeDeleted(payload.conversationId);
      await options.conversations.delete(payload.conversationId);
      await options.documents.deleteConversationAssets(payload.conversationId).catch(() => {
        options.logger?.log({
          level: "warn",
          category: "storage",
          event: "document.conversation_cleanup.deferred",
          message: "Conversation deleted but managed document cleanup was incomplete",
          context: { conversationId: payload.conversationId, outcome: "failure" },
        });
      });
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.conversationSend,
    input: sendMessageRequestSchema,
    output: sendAcceptedSchema,
    handle: async ({ payload }, event) => {
      const accepted = await options.conversations.send(
        payload,
        createConversationRunSink(
          event.sender,
          options.logger,
          payload.conversationId,
          options.modelPayloadLogger,
        ),
      );
      options.logger?.log({
        level: "info",
        category: "conversation",
        event: "conversation.run.accepted",
        message: "Conversation run accepted",
        context: {
          conversationId: payload.conversationId,
          runId: accepted.runId,
          outcome: "success",
        },
      });
      return accepted;
    },
  });
  register({
    channel: IPC_CHANNELS.conversationCancel,
    input: cancelRunRequestSchema,
    output: cancelResultSchema,
    handle: ({ payload }) => ({ accepted: options.conversations.cancel(payload.runId) }),
  });
  register({
    channel: IPC_CHANNELS.conversationCompact,
    input: compactConversationRequestSchema,
    output: conversationDetailViewSchema,
    handle: async ({ payload }, event) =>
      toConversationView(
        await options.conversations.compact(
          payload.conversationId,
          createConversationRunSink(event.sender, options.logger, payload.conversationId),
        ),
      ),
  });
  register({
    channel: IPC_CHANNELS.conversationCompactCancel,
    input: compactConversationRequestSchema,
    output: cancelResultSchema,
    handle: ({ payload }) => ({
      accepted: options.conversations.cancelCompaction(payload.conversationId),
    }),
  });
  register({
    channel: IPC_CHANNELS.conversationRegenerate,
    input: regenerateMessageRequestSchema,
    output: regenerateAcceptedSchema,
    handle: ({ payload }, event) =>
      options.conversations.regenerate(
        payload.conversationId,
        payload.messageId,
        createConversationRunSink(
          event.sender,
          options.logger,
          payload.conversationId,
          options.modelPayloadLogger,
        ),
      ),
  });
}
