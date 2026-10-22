import type { AutomationDetail, AutomationService } from "@zimo/application";
import {
  automationDeleteRequestSchema,
  automationDetailViewSchema,
  automationGetRequestSchema,
  automationListRequestSchema,
  automationRunAcceptedSchema,
  automationRunNowRequestSchema,
  automationSaveRequestSchema,
  automationSetEnabledRequestSchema,
  automationSummaryViewSchema,
  IPC_CHANNELS,
  successViewSchema,
  type AutomationSummaryView,
} from "@zimo/contracts";
import type { AutomationDefinition, AutomationSchedule } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerAutomationIpcHandlers(
  register: RegisterIpcHandler,
  options: { automations: AutomationService; logger: StructuredLogger },
): void {
  register({
    channel: IPC_CHANNELS.automationsList,
    input: automationListRequestSchema,
    output: automationSummaryViewSchema.array(),
    handle: async () => (await options.automations.list()).map(toSummaryView),
  });
  register({
    channel: IPC_CHANNELS.automationsGet,
    input: automationGetRequestSchema,
    output: automationDetailViewSchema,
    handle: async ({ payload }) => toDetailView(await options.automations.get(payload.id)),
  });
  register({
    channel: IPC_CHANNELS.automationsSave,
    input: automationSaveRequestSchema,
    output: automationDetailViewSchema,
    handle: async ({ payload }) =>
      toDetailView(
        await options.automations.save({
          ...payload,
          schedule: fromScheduleView(payload.schedule),
          timeWindow: payload.timeWindow,
        }),
      ),
  });
  register({
    channel: IPC_CHANNELS.automationsDelete,
    input: automationDeleteRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.automations.delete(payload.id);
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.automationsSetEnabled,
    input: automationSetEnabledRequestSchema,
    output: automationSummaryViewSchema,
    handle: async ({ payload }) =>
      toSummaryView(await options.automations.setEnabled(payload.id, payload.enabled)),
  });
  register({
    channel: IPC_CHANNELS.automationsRunNow,
    input: automationRunNowRequestSchema,
    output: automationRunAcceptedSchema,
    handle: async ({ payload }) => {
      const result = await options.automations.runNow(payload.id);
      options.logger.log({
        level: "info",
        category: "automation",
        event: "automation.run.accepted",
        message: "Manual automation run accepted",
        context: { automationId: payload.id, runId: result.automationRunId, outcome: "success" },
      });
      return result;
    },
  });
}

function toSummaryView(value: AutomationDefinition): AutomationSummaryView {
  return {
    id: value.id,
    conversationId: value.conversationId,
    name: value.name,
    enabled: value.enabled,
    schedule: toScheduleView(value.schedule),
    timeWindow: value.timeWindow,
    ...(value.nextRunAt ? { nextRunAt: value.nextRunAt.toISOString() } : {}),
    ...(value.lastRunAt ? { lastRunAt: value.lastRunAt.toISOString() } : {}),
    ...(value.lastRunStatus ? { lastRunStatus: value.lastRunStatus } : {}),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function toDetailView(value: AutomationDetail) {
  return {
    ...toSummaryView(value.automation),
    prompt: value.automation.prompt,
    modelId: value.conversation.modelId,
    agentId: value.conversation.agentId,
    skillIds: [...value.conversation.skillIds],
    knowledgeBaseIds: [...value.conversation.knowledgeBaseIds],
    workflowId: value.conversation.workflowId,
    mcpToolIds: [...value.conversation.mcpToolIds],
    runs: value.runs.map((run) => ({
      id: run.id,
      ...(run.conversationRunId ? { conversationRunId: run.conversationRunId } : {}),
      trigger: run.trigger,
      status: run.status,
      scheduledFor: run.scheduledFor.toISOString(),
      startedAt: run.startedAt.toISOString(),
      ...(run.finishedAt ? { finishedAt: run.finishedAt.toISOString() } : {}),
      ...(run.errorCode ? { errorCode: run.errorCode } : {}),
    })),
  };
}

function toScheduleView(schedule: AutomationSchedule) {
  if (schedule.kind === "once") return { kind: schedule.kind, runAt: schedule.runAt.toISOString() };
  if (schedule.kind === "interval") {
    return { kind: schedule.kind, everyMinutes: schedule.everyMinutes };
  }
  return schedule.kind === "daily"
    ? { kind: schedule.kind, time: schedule.time }
    : { kind: schedule.kind, time: schedule.time, weekdays: [...schedule.weekdays] };
}

function fromScheduleView(
  schedule:
    | { kind: "once"; runAt: string }
    | { kind: "interval"; everyMinutes: number }
    | { kind: "daily"; time: string }
    | { kind: "weekly"; time: string; weekdays: number[] },
): AutomationSchedule {
  if (schedule.kind === "once") return { kind: schedule.kind, runAt: new Date(schedule.runAt) };
  return schedule;
}
