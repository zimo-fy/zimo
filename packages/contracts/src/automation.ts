import { z } from "zod";

import { mcpToolIdSchema } from "./conversation-capabilities";
import type { IpcResult } from "./index";

const request = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const automationScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("once"), runAt: z.iso.datetime() }).strict(),
  z
    .object({
      kind: z.literal("interval"),
      everyMinutes: z.number().int().min(5).max(43_200),
    })
    .strict(),
  z
    .object({ kind: z.literal("daily"), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) })
    .strict(),
  z
    .object({
      kind: z.literal("weekly"),
      time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    })
    .strict(),
]);

export const automationTimeWindowSchema = z
  .object({
    startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  })
  .strict();

export const automationSummaryViewSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    name: z.string().min(1).max(120),
    enabled: z.boolean(),
    schedule: automationScheduleSchema,
    timeWindow: automationTimeWindowSchema,
    nextRunAt: z.iso.datetime().optional(),
    lastRunAt: z.iso.datetime().optional(),
    lastRunStatus: z.enum(["running", "completed", "failed", "cancelled"]).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type AutomationSummaryView = z.infer<typeof automationSummaryViewSchema>;

export const automationRunViewSchema = z
  .object({
    id: z.uuid(),
    conversationRunId: z.uuid().optional(),
    trigger: z.enum(["scheduled", "manual"]),
    status: z.enum(["running", "completed", "failed", "cancelled"]),
    scheduledFor: z.iso.datetime(),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().optional(),
    errorCode: z.string().min(1).max(80).optional(),
  })
  .strict();

export const automationDetailViewSchema = automationSummaryViewSchema
  .extend({
    prompt: z.string().min(1).max(20_000),
    modelId: z.uuid(),
    agentId: z.uuid().optional(),
    skillIds: z.array(z.uuid()).max(20),
    knowledgeBaseIds: z.array(z.uuid()).max(5),
    workflowId: z.uuid().optional(),
    mcpToolIds: z.array(mcpToolIdSchema).max(300),
    runs: z.array(automationRunViewSchema).max(20),
  })
  .strict();
export type AutomationDetailView = z.infer<typeof automationDetailViewSchema>;

export const automationSaveInputSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(1).max(20_000),
    enabled: z.boolean(),
    modelId: z.uuid().optional(),
    agentId: z.uuid().nullable(),
    skillIds: z.array(z.uuid()).max(20),
    knowledgeBaseIds: z.array(z.uuid()).max(5),
    workflowId: z.uuid().nullable(),
    mcpToolIds: z.array(mcpToolIdSchema).max(300),
    schedule: automationScheduleSchema,
    timeWindow: automationTimeWindowSchema,
  })
  .strict();
export type AutomationSaveInput = z.infer<typeof automationSaveInputSchema>;

export const automationIdInputSchema = z.object({ id: z.uuid() }).strict();
export const automationSetEnabledInputSchema = z
  .object({ id: z.uuid(), enabled: z.boolean() })
  .strict();
export const automationRunAcceptedSchema = z.object({ automationRunId: z.uuid() }).strict();
export const automationTaskListChangedSchema = z.object({}).strict();

export const automationListRequestSchema = request(z.object({}).strict());
export const automationGetRequestSchema = request(automationIdInputSchema);
export const automationSaveRequestSchema = request(automationSaveInputSchema);
export const automationDeleteRequestSchema = request(automationIdInputSchema);
export const automationSetEnabledRequestSchema = request(automationSetEnabledInputSchema);
export const automationRunNowRequestSchema = request(automationIdInputSchema);

export interface AutomationDesktopApi {
  list(requestId: string): Promise<IpcResult<AutomationSummaryView[]>>;
  get(requestId: string, id: string): Promise<IpcResult<AutomationDetailView>>;
  save(requestId: string, input: AutomationSaveInput): Promise<IpcResult<AutomationDetailView>>;
  delete(requestId: string, id: string): Promise<IpcResult<{ success: true }>>;
  setEnabled(
    requestId: string,
    id: string,
    enabled: boolean,
  ): Promise<IpcResult<AutomationSummaryView>>;
  runNow(
    requestId: string,
    id: string,
  ): Promise<IpcResult<z.infer<typeof automationRunAcceptedSchema>>>;
  onTaskListChanged(listener: () => void): () => void;
}
