import type { ConversationId, EntityId } from "./index";

export type AutomationId = EntityId<"Automation">;
export type AutomationRunId = EntityId<"AutomationRun">;
export type AutomationRunStatus = "running" | "completed" | "failed" | "cancelled";

export type AutomationSchedule =
  | Readonly<{ kind: "once"; runAt: Date }>
  | Readonly<{ kind: "interval"; everyMinutes: number }>
  | Readonly<{ kind: "daily"; time: string }>
  | Readonly<{ kind: "weekly"; time: string; weekdays: readonly number[] }>;

export interface AutomationTimeWindow {
  startTime: string;
  endTime: string;
}

export interface AutomationDefinition {
  id: AutomationId;
  ownerExternalUserId: string;
  conversationId: ConversationId;
  name: string;
  prompt: string;
  enabled: boolean;
  schedule: AutomationSchedule;
  timeWindow: AutomationTimeWindow;
  nextRunAt?: Date | undefined;
  lastRunAt?: Date | undefined;
  lastRunStatus?: AutomationRunStatus | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationRunRecord {
  id: AutomationRunId;
  automationId: AutomationId;
  conversationRunId?: string | undefined;
  trigger: "scheduled" | "manual";
  status: AutomationRunStatus;
  scheduledFor: Date;
  startedAt: Date;
  finishedAt?: Date | undefined;
  errorCode?: string | undefined;
}

export interface AutomationRepository {
  list(ownerExternalUserId: string): Promise<readonly AutomationDefinition[]>;
  getById(ownerExternalUserId: string, id: AutomationId): Promise<AutomationDefinition | null>;
  save(value: AutomationDefinition): Promise<void>;
  softDelete(ownerExternalUserId: string, id: AutomationId, deletedAt: Date): Promise<void>;
  listDue(
    ownerExternalUserId: string,
    now: Date,
    limit: number,
  ): Promise<readonly AutomationDefinition[]>;
  beginRun(
    ownerExternalUserId: string,
    run: AutomationRunRecord,
    nextRunAt: Date | undefined,
    expectedNextRunAt?: Date | undefined,
  ): Promise<boolean>;
  attachConversationRun(id: AutomationRunId, conversationRunId: string): Promise<void>;
  finishRun(
    ownerExternalUserId: string,
    id: AutomationRunId,
    status: Exclude<AutomationRunStatus, "running">,
    finishedAt: Date,
    errorCode?: string | undefined,
  ): Promise<void>;
  listRuns(
    ownerExternalUserId: string,
    automationId: AutomationId,
    limit: number,
  ): Promise<readonly AutomationRunRecord[]>;
  repairInterruptedRuns(updatedAt: Date): Promise<void>;
}
