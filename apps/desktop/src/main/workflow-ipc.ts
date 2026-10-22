import {
  USER_MEMORY_TOOL_ID,
  type ControlledToolService,
  type WorkflowRuntimeService,
} from "@zimo/application";
import {
  cancelResultSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  toolCapabilityViewSchema,
  workflowCancelRequestSchema,
  workflowRunAcceptedSchema,
  workflowRunRequestSchema,
} from "@zimo/contracts";
import type { StructuredLogger } from "@zimo/logging";

import type { RegisterIpcHandler } from "./ipc-handler";
import type { SensitiveModelPayloadLogger } from "./model-payload-logger";
import { createWorkflowRunSink } from "./workflow-run-logging";

export function registerWorkflowIpcHandlers(
  register: RegisterIpcHandler,
  options: {
    workflows: WorkflowRuntimeService;
    tools: ControlledToolService;
    logger: StructuredLogger | null;
    payloadLogger: SensitiveModelPayloadLogger | null;
  },
): void {
  register({
    channel: IPC_CHANNELS.workflowRun,
    input: workflowRunRequestSchema,
    output: workflowRunAcceptedSchema,
    handle: ({ payload }, event) =>
      options.workflows.start(
        payload.workflowId,
        payload.input,
        createWorkflowRunSink(
          event.sender,
          options.logger,
          payload.workflowId,
          options.payloadLogger,
        ),
        payload.confirmedToolIds,
      ),
  });
  register({
    channel: IPC_CHANNELS.workflowCancel,
    input: workflowCancelRequestSchema,
    output: cancelResultSchema,
    handle: ({ payload }) => ({ accepted: options.workflows.cancel(payload.runId) }),
  });
  register({
    channel: IPC_CHANNELS.toolsList,
    input: emptyRequestSchema,
    output: toolCapabilityViewSchema.array(),
    handle: () => options.tools.list().filter((tool) => tool.id !== USER_MEMORY_TOOL_ID),
  });
}
