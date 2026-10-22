import {
  AppError,
  type KnowledgeChunkId,
  type KnowledgeCitation,
  type KnowledgeDocumentId,
  type PrototypeDefinition,
  type PrototypeId,
} from "@zimo/domain";
import type { SerializedAppError, WorkflowStreamEnvelopeView } from "@zimo/contracts";

import type { ConversationStreamSink } from "./conversation-run";
import type { WorkflowRuntimeService } from "./workflow-runtime";

export interface ConversationWorkflowResult {
  output: string;
  citations: readonly KnowledgeCitation[];
}

export class ConversationWorkflowRunner {
  constructor(private readonly workflows: WorkflowRuntimeService) {}

  async run(input: {
    workflowId: string;
    conversationId: string;
    text: string;
    skills: readonly PrototypeDefinition[];
    mcpToolIds: readonly string[];
    signal: AbortSignal;
    sink: ConversationStreamSink;
  }): Promise<ConversationWorkflowResult> {
    let innerRunId: string | undefined;
    let settled = false;
    const terminal = new Promise<ConversationWorkflowResult>((resolve, reject) => {
      const consume = (envelope: WorkflowStreamEnvelopeView) => {
        if (envelope.event.type === "run.completed") {
          settled = true;
          resolve({
            output: envelope.event.output,
            citations: envelope.event.citations.map((citation) => ({
              ...citation,
              knowledgeBaseId: citation.knowledgeBaseId as PrototypeId,
              documentId: citation.documentId as KnowledgeDocumentId,
              chunkId: citation.chunkId as KnowledgeChunkId,
            })),
          });
        } else if (envelope.event.type === "run.failed") {
          settled = true;
          reject(toWorkflowError(envelope.event.error));
        } else if (envelope.event.type === "run.cancelled") {
          settled = true;
          reject(abortError());
        }
      };
      void this.workflows
        .start(
          input.workflowId,
          input.text,
          {
            emit: consume,
            inspectModelRequest: (value) => input.sink.inspectNestedWorkflowModelRequest?.(value),
            captureModelPayload: (value) => input.sink.captureNestedWorkflowModelPayload?.(value),
          },
          [],
          {
            skills: input.skills,
            mcpToolIds: input.mcpToolIds,
            authorizeConfiguredTools: true,
            artifactConversationId: input.conversationId,
          },
        )
        .then(({ runId }) => {
          innerRunId = runId;
          if (input.signal.aborted && !settled) this.workflows.cancel(runId);
        }, reject);
    });
    const cancel = () => {
      if (innerRunId && !settled) this.workflows.cancel(innerRunId);
    };
    input.signal.addEventListener("abort", cancel, { once: true });
    try {
      return await terminal;
    } finally {
      input.signal.removeEventListener("abort", cancel);
    }
  }
}

function toWorkflowError(error: SerializedAppError): AppError {
  return new AppError({
    code: error.code,
    category: error.category,
    userMessage: error.message,
    retryable: error.retryable,
  });
}

function abortError(): Error {
  return new DOMException("Aborted", "AbortError");
}
