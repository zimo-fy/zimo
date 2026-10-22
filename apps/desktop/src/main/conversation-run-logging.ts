import type {
  ConversationModelRequestDiagnostic,
  ConversationStreamSink,
  WorkflowModelRequestDiagnostic,
} from "@zimo/application";
import { IPC_CHANNELS } from "@zimo/contracts";
import type { StructuredLogger } from "@zimo/logging";
import type { WebContents } from "electron";

import type { SensitiveModelPayloadLogger } from "./model-payload-logger";

export function createConversationRunSink(
  sender: WebContents,
  logger: StructuredLogger | null,
  conversationId: string,
  payloadLogger: SensitiveModelPayloadLogger | null = null,
): ConversationStreamSink {
  return {
    ownerId: String(sender.id),
    emit: (envelope) => {
      if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.agentStream, envelope);
      if (envelope.event.type.startsWith("context.compaction.")) {
        logContextCompaction(logger, conversationId, envelope);
        return;
      }
      if (!envelope.event.type.startsWith("run.")) return;
      logger?.log({
        level: envelope.event.type === "run.failed" ? "error" : "info",
        category: "conversation",
        event: `conversation.${envelope.event.type}`,
        message: "Conversation run reached a terminal state",
        context: {
          conversationId,
          runId: envelope.runId,
          outcome:
            envelope.event.type === "run.completed"
              ? "success"
              : envelope.event.type === "run.cancelled"
                ? "cancelled"
                : "failure",
        },
      });
    },
    inspectModelRequest: (diagnostic) => logModelRequest(logger, diagnostic),
    inspectTitleGeneration: (diagnostic) => {
      logger?.log({
        level: diagnostic.outcome === "success" ? "info" : "warn",
        category: "conversation",
        event: "conversation.title.generated",
        message: "Conversation task title generation finished; title content omitted by policy",
        context: {
          conversationId: diagnostic.conversationId,
          runId: diagnostic.runId,
          ...(diagnostic.modelId ? { modelId: diagnostic.modelId } : {}),
          outcome: diagnostic.outcome === "timeout" ? "failure" : diagnostic.outcome,
          durationMs: diagnostic.durationMs,
          ...(diagnostic.errorCode ? { errorCode: diagnostic.errorCode } : {}),
          ...(diagnostic.titleCharacters !== undefined
            ? { titleCharacters: diagnostic.titleCharacters }
            : {}),
        },
      });
    },
    inspectNestedWorkflowModelRequest: (diagnostic) => logWorkflowModelRequest(logger, diagnostic),
    ...(payloadLogger
      ? {
          captureModelPayload: (payload) => payloadLogger.logRequest(payload),
          captureNestedWorkflowModelPayload: (payload) => payloadLogger.logRequest(payload),
        }
      : {}),
  };
}

function logContextCompaction(
  logger: StructuredLogger | null,
  conversationId: string,
  envelope: Parameters<ConversationStreamSink["emit"]>[0],
): void {
  const event = envelope.event;
  if (
    event.type !== "context.compaction.started" &&
    event.type !== "context.compaction.completed" &&
    event.type !== "context.compaction.failed"
  )
    return;
  const compaction = "compaction" in event ? event.compaction : undefined;
  logger?.log({
    level: event.type === "context.compaction.failed" ? "warn" : "info",
    category: "conversation",
    event: event.type,
    message: "Conversation context compaction state changed; summary content omitted by policy",
    context: {
      conversationId,
      runId: envelope.runId,
      compactionId:
        event.type === "context.compaction.failed" ? event.compactionId : event.compaction.id,
      trigger:
        event.type === "context.compaction.failed" ? event.trigger : event.compaction.trigger,
      ...(compaction ? { inputTokens: compaction.inputTokens } : {}),
      ...(compaction?.outputTokens !== undefined ? { outputTokens: compaction.outputTokens } : {}),
      ...(event.type === "context.compaction.failed" ? { errorCode: event.errorCode } : {}),
      ...(event.type === "context.compaction.completed"
        ? { outcome: "success" as const }
        : event.type === "context.compaction.failed"
          ? { outcome: "failure" as const }
          : {}),
    },
  });
}

function logWorkflowModelRequest(
  logger: StructuredLogger | null,
  diagnostic: WorkflowModelRequestDiagnostic,
): void {
  logger?.log({
    level: "info",
    category: "model",
    event: "model.request.prepared",
    message: "Conversation Workflow LLM request prepared; message content omitted by policy",
    context: { ...diagnostic },
  });
}

function logModelRequest(
  logger: StructuredLogger | null,
  diagnostic: ConversationModelRequestDiagnostic,
): void {
  logger?.log({
    level: "info",
    category: "model",
    event: "model.request.prepared",
    message: "LLM request prepared; message content omitted by policy",
    context: { ...diagnostic },
  });
}
