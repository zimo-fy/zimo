import type { ConversationDetail, ConversationSummary, ContextCompaction } from "@zimo/domain";

export function toConversationView(value: ConversationDetail) {
  return {
    id: value.id,
    title: value.title,
    modelId: value.modelId,
    ...(value.catalogModel ? { catalogModel: value.catalogModel } : {}),
    ...(value.agentId ? { agentId: value.agentId } : {}),
    skillIds: [...value.skillIds],
    knowledgeBaseIds: [...value.knowledgeBaseIds],
    ...(value.workflowId ? { workflowId: value.workflowId } : {}),
    mcpToolIds: [...value.mcpToolIds],
    browserEnabled: value.browserEnabled,
    ...(value.activeRunId ? { activeRunId: value.activeRunId } : {}),
    messages: value.messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      status: message.status,
      position: message.position,
      ...(message.replacesMessageId ? { replacesMessageId: message.replacesMessageId } : {}),
      ...(message.errorCode ? { errorCode: message.errorCode } : {}),
      ...(message.usage ? { usage: message.usage } : {}),
      ...(message.knowledgeCitations
        ? { knowledgeCitations: [...message.knowledgeCitations] }
        : {}),
      ...(message.steps ? { steps: [...message.steps] } : {}),
      ...(message.modelDisplayName ? { modelDisplayName: message.modelDisplayName } : {}),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    })),
    contextCompactions: value.contextCompactions.map(toContextCompactionView),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function toContextCompactionView(value: ContextCompaction) {
  return {
    id: value.id,
    conversationId: value.conversationId,
    version: value.version,
    status: value.status,
    trigger: value.trigger,
    sourceFromMessageId: value.sourceFromMessageId,
    sourceToMessageId: value.sourceToMessageId,
    coveredThroughPosition: value.coveredThroughPosition,
    retainedFromPosition: value.retainedFromPosition,
    ...(value.summary ? { summary: value.summary } : {}),
    inputTokens: value.inputTokens,
    ...(value.outputTokens !== undefined ? { outputTokens: value.outputTokens } : {}),
    ...(value.errorCode ? { errorCode: value.errorCode } : {}),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

export function toConversationSummaryView(value: ConversationSummary) {
  return {
    id: value.id,
    title: value.title,
    modelId: value.modelId,
    modelDisplayName: value.modelDisplayName,
    messageCount: value.messageCount,
    ...(value.lastMessagePreview ? { lastMessagePreview: value.lastMessagePreview } : {}),
    isPinned: value.isPinned,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
