import type { ConversationId, ModelId, RunId } from "@zimo/domain";

import type { ConversationStreamSink } from "./conversation-run";
import type { ModelToolRoundCapture } from "./model-tool-loop";

export function createConversationToolRoundCapture(input: {
  sink: ConversationStreamSink;
  conversationId: ConversationId;
  runId: RunId;
  providerId: string;
  modelId: ModelId;
  modelName: string;
  agentId: string | null;
  skillIds: readonly string[];
  knowledgeBaseIds: readonly string[];
}): (capture: ModelToolRoundCapture) => void {
  return (capture) =>
    input.sink.captureModelPayload?.({
      schemaVersion: 1,
      purpose: "conversation_tool_round",
      conversationId: input.conversationId,
      runId: input.runId,
      providerId: input.providerId,
      modelId: input.modelId,
      agentId: input.agentId,
      skillIds: [...input.skillIds],
      knowledgeBaseIds: [...input.knowledgeBaseIds],
      round: capture.round,
      request: {
        model: input.modelName,
        temperature: 0.7,
        stream: true,
        messages: capture.messages,
        tools: capture.tools,
      },
      response: { toolCalls: capture.toolCalls },
    });
}
