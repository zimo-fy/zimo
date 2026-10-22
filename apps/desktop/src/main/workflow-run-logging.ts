import type { WorkflowStreamSink } from "@zimo/application";
import { IPC_CHANNELS } from "@zimo/contracts";
import type { StructuredLogger } from "@zimo/logging";
import type { WebContents } from "electron";

import type { SensitiveModelPayloadLogger } from "./model-payload-logger";

export function createWorkflowRunSink(
  sender: WebContents,
  logger: StructuredLogger | null,
  workflowId: string,
  payloadLogger: SensitiveModelPayloadLogger | null,
): WorkflowStreamSink {
  return {
    emit: (envelope) => {
      if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.workflowStream, envelope);
      if (envelope.event.type !== "run.completed" && envelope.event.type !== "run.failed") return;
      logger?.log({
        level: envelope.event.type === "run.failed" ? "error" : "info",
        category: "workflow",
        event: `workflow.${envelope.event.type}`,
        message: "Workflow test reached a terminal state",
        context: {
          workflowId,
          runId: envelope.runId,
          outcome: envelope.event.type === "run.completed" ? "success" : "failure",
        },
      });
    },
    inspectModelRequest: (diagnostic) => {
      logger?.log({
        level: "info",
        category: "model",
        event: "model.request.prepared",
        message: "Workflow LLM request prepared; message content omitted by policy",
        context: { ...diagnostic },
      });
    },
    ...(payloadLogger
      ? { captureModelPayload: (payload) => payloadLogger.logRequest(payload) }
      : {}),
  };
}
