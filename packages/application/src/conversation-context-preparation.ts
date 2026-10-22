import type {
  AgentStreamEvent,
  ConversationDetail,
  ModelGatewayMessage,
  PrototypeDefinition,
  ResolvedModel,
  UserMemory,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import type { ResolvedConversationCapabilities } from "./conversation-capability-service";
import type { ContextCompactionService } from "./context-compaction-service";
import { estimateTextTokens, latestCompletedCompaction } from "./context-compaction-service";
import { compileConversationMessages } from "./conversation-model-messages";
import type { ControlledToolService } from "./tool-runtime";

export async function prepareConversationModelContext(input: {
  conversation: ConversationDetail;
  resolved: ResolvedModel;
  apiKey: string;
  agentExecution?: ResolvedConversationCapabilities["agentExecution"];
  skills: readonly PrototypeDefinition[];
  knowledgeContext?: string;
  documentContext?: string;
  workspaceContext?: string;
  agentMcpServerIds: readonly string[];
  toolIds: readonly string[];
  tools: ControlledToolService;
  hasCapabilitySearch?: boolean;
  contextCompaction?: ContextCompactionService;
  userMemories?: readonly UserMemory[];
  signal: AbortSignal;
  emit(event: AgentStreamEvent): void;
}): Promise<{
  messages: readonly ModelGatewayMessage[];
  connection: { baseUrl: string; apiKey: string; modelName: string };
  hasTools: boolean;
}> {
  const hasTools =
    input.agentMcpServerIds.length > 0 ||
    input.toolIds.length > 0 ||
    Boolean(input.hasCapabilitySearch);
  const compileMessages = (
    contextCompaction = latestCompletedCompaction(input.conversation.contextCompactions),
  ) =>
    compileConversationMessages({
      history: input.conversation.messages,
      ...(input.agentExecution ? { agentExecution: input.agentExecution } : {}),
      skills: input.skills,
      hasTools,
      ...(input.knowledgeContext ? { knowledgeContext: input.knowledgeContext } : {}),
      ...(input.documentContext ? { documentContext: input.documentContext } : {}),
      ...(input.workspaceContext ? { workspaceContext: input.workspaceContext } : {}),
      ...(contextCompaction ? { contextCompaction } : {}),
      ...(input.userMemories ? { userMemories: input.userMemories } : {}),
    });
  let messages = compileMessages();
  const selectedToolIds = new Set(input.toolIds);
  const selectedTools = input.tools
    .list()
    .filter(
      (tool) =>
        selectedToolIds.has(tool.id) ||
        input.agentMcpServerIds.some((serverId) => tool.id.startsWith(`mcp.${serverId}.`)),
    );
  const extraContextTokens = hasTools ? estimateTextTokens(JSON.stringify(selectedTools)) : 0;
  const connection = {
    baseUrl: input.resolved.provider.baseUrl,
    apiKey: input.apiKey,
    modelName: input.resolved.model.name,
  };
  if (input.contextCompaction) {
    const compaction = await input.contextCompaction.prepare({
      conversation: input.conversation,
      contextCompactions: input.conversation.contextCompactions,
      surfaceMessages: messages,
      resolved: input.resolved,
      connection,
      extraContextTokens,
      signal: input.signal,
      emit: input.emit,
    });
    messages = compileMessages(compaction);
    if (
      input.contextCompaction.isHardLimitExceeded({
        messages,
        resolved: input.resolved,
        extraContextTokens,
      })
    ) {
      throw new AppError({
        code: "CONTEXT_LIMIT_EXCEEDED_AFTER_COMPACTION",
        category: "model",
        userMessage: "整理后的上下文仍超过模型安全限制，请减少最近消息中的大型内容后重试。",
        retryable: true,
      });
    }
  }
  return { messages, connection, hasTools };
}
