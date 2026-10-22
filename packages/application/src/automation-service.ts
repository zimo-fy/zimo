import type {
  AgentStreamEnvelope,
  AutomationDefinition,
  AutomationId,
  AutomationRepository,
  AutomationRunId,
  AutomationRunRecord,
  AutomationSchedule,
  AutomationTimeWindow,
  Clock,
  Conversation,
  IdGenerator,
  SessionStore,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import type { ConversationService } from "./conversation-service";
import { requireText } from "./input-validation";
import {
  getNextAutomationRunAt,
  isInsideAutomationTimeWindow,
  validateAutomationSchedule,
} from "./automation-schedule";

export interface AutomationSaveCommand {
  id?: string | undefined;
  name: string;
  prompt: string;
  enabled: boolean;
  modelId?: string | undefined;
  agentId: string | null;
  skillIds: readonly string[];
  knowledgeBaseIds: readonly string[];
  workflowId: string | null;
  mcpToolIds: readonly string[];
  schedule: AutomationSchedule;
  timeWindow: AutomationTimeWindow;
}

export interface AutomationDetail {
  automation: AutomationDefinition;
  conversation: Conversation;
  runs: readonly AutomationRunRecord[];
}

type AutomationDiagnostic = (value: {
  event: "automation.run.started" | "automation.run.completed" | "automation.run.record_failed";
  automationId: string;
  runId: string;
  outcome: "success" | "failure" | "cancelled";
  errorCode?: string | undefined;
}) => void;

export class AutomationService {
  private readonly activeConversationRuns = new Map<
    string,
    { automationId: string; conversationRunId: string }
  >();

  constructor(
    private readonly repository: AutomationRepository,
    private readonly sessions: SessionStore,
    private readonly conversations: ConversationService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly diagnostic?: AutomationDiagnostic | undefined,
    private readonly onConversationChanged?: (() => void) | undefined,
  ) {}

  async list(): Promise<readonly AutomationDefinition[]> {
    const owner = await this.requireOwner();
    return this.repository.list(owner);
  }

  async get(id: string): Promise<AutomationDetail> {
    const owner = await this.requireOwner();
    const automation = await this.requireAutomation(owner, id);
    return {
      automation,
      conversation: await this.conversations.get(automation.conversationId),
      runs: await this.repository.listRuns(owner, automation.id, 20),
    };
  }

  async save(command: AutomationSaveCommand): Promise<AutomationDetail> {
    const owner = await this.requireOwner();
    const now = this.clock.now();
    const name = requireText(command.name, "自动化名称", 120);
    const prompt = requireText(command.prompt, "执行指令", 20_000);
    validateAutomationSchedule(command.schedule, command.timeWindow);
    const nextRunAt = command.enabled
      ? getNextAutomationRunAt(command.schedule, command.timeWindow, now)
      : undefined;
    if (command.enabled && !nextRunAt) {
      throw automationError(
        "AUTOMATION_SCHEDULE_EXHAUSTED",
        "当前计划在生效时间范围内没有下一次执行时间。",
      );
    }

    if (!command.id) {
      const conversation = await this.conversations.create(command.modelId);
      try {
        await this.conversations.rename(conversation.id, `自动化 · ${name}`);
        await this.conversations.changeCapabilities(conversation.id, {
          ...command,
          browserEnabled: true,
        });
        const value: AutomationDefinition = {
          id: this.ids.create() as AutomationId,
          ownerExternalUserId: owner,
          conversationId: conversation.id,
          name,
          prompt,
          enabled: command.enabled,
          schedule: command.schedule,
          timeWindow: command.timeWindow,
          ...(nextRunAt ? { nextRunAt } : {}),
          createdAt: now,
          updatedAt: now,
        };
        await this.repository.save(value);
        return this.get(value.id);
      } catch (error) {
        await this.conversations.delete(conversation.id).catch(() => undefined);
        throw error;
      }
    }

    const current = await this.requireAutomation(owner, command.id);
    const conversation = await this.conversations.get(current.conversationId);
    if (conversation.activeRunId)
      throw automationError("AUTOMATION_RUN_ACTIVE", "任务正在执行，请完成后再修改。");
    if (command.modelId && command.modelId !== conversation.modelId) {
      await this.conversations.changeModel(conversation.id, command.modelId);
    }
    await this.conversations.changeCapabilities(conversation.id, {
      ...command,
      browserEnabled: true,
    });
    await this.conversations.rename(conversation.id, `自动化 · ${name}`);
    await this.repository.save({
      ...current,
      name,
      prompt,
      enabled: command.enabled,
      schedule: command.schedule,
      timeWindow: command.timeWindow,
      ...(nextRunAt ? { nextRunAt } : { nextRunAt: undefined }),
      updatedAt: now,
    });
    return this.get(current.id);
  }

  async setEnabled(id: string, enabled: boolean): Promise<AutomationDefinition> {
    const owner = await this.requireOwner();
    const current = await this.requireAutomation(owner, id);
    const nextRunAt = enabled
      ? getNextAutomationRunAt(current.schedule, current.timeWindow, this.clock.now())
      : undefined;
    if (enabled && !nextRunAt) {
      throw automationError(
        "AUTOMATION_SCHEDULE_EXHAUSTED",
        "当前计划在生效时间范围内没有下一次执行时间。",
      );
    }
    const next = {
      ...current,
      enabled,
      ...(nextRunAt ? { nextRunAt } : { nextRunAt: undefined }),
      updatedAt: this.clock.now(),
    };
    await this.repository.save(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    const owner = await this.requireOwner();
    const current = await this.requireAutomation(owner, id);
    if ([...this.activeConversationRuns.values()].some((run) => run.automationId === current.id)) {
      throw automationError("AUTOMATION_RUN_ACTIVE", "任务正在执行，请完成或取消后再删除。");
    }
    const conversation = await this.conversations.get(current.conversationId);
    if (conversation.activeRunId) {
      throw automationError("AUTOMATION_RUN_ACTIVE", "任务正在执行，请完成或取消后再删除。");
    }
    const now = this.clock.now();
    await this.repository.softDelete(owner, current.id, now);
    if (conversation.messages.length === 0) {
      await this.conversations.delete(current.conversationId);
    }
    this.onConversationChanged?.();
  }

  async assertConversationCanBeDeleted(conversationId: string): Promise<void> {
    const owner = await this.requireOwner();
    const managed = (await this.repository.list(owner)).some(
      (automation) => automation.conversationId === conversationId,
    );
    if (managed) {
      throw automationError(
        "AUTOMATION_CONVERSATION_MANAGED",
        "这是自动化任务的专用会话，请从自动化页面删除对应任务。",
      );
    }
  }

  async runNow(id: string): Promise<{ automationRunId: string }> {
    const owner = await this.requireOwner();
    const automation = await this.requireAutomation(owner, id);
    const now = this.clock.now();
    if (!isInsideAutomationTimeWindow(now, automation.timeWindow)) {
      throw automationError("AUTOMATION_OUTSIDE_ACTIVE_WINDOW", "当前不在任务的执行时间范围内。");
    }
    const automationRunId = await this.startExecution(owner, automation, "manual", now);
    if (!automationRunId) throw automationError("AUTOMATION_RUN_ACTIVE", "任务已经在执行中。");
    return { automationRunId };
  }

  async runDue(): Promise<number> {
    const session = await this.sessions.get();
    if (!session) return 0;
    const now = this.clock.now();
    const due = await this.repository.listDue(session.externalUserId, now, 3);
    let started = 0;
    for (const automation of due) {
      if (!isInsideAutomationTimeWindow(now, automation.timeWindow)) {
        const nextRunAt = getNextAutomationRunAt(automation.schedule, automation.timeWindow, now);
        await this.repository.save({
          ...automation,
          enabled: Boolean(nextRunAt),
          ...(nextRunAt ? { nextRunAt } : { nextRunAt: undefined }),
          updatedAt: now,
        });
        continue;
      }
      if (await this.startExecution(session.externalUserId, automation, "scheduled", now)) {
        started += 1;
      }
    }
    return started;
  }

  cancelAll(): void {
    for (const run of this.activeConversationRuns.values()) {
      this.conversations.cancel(run.conversationRunId);
    }
  }

  private async startExecution(
    owner: string,
    automation: AutomationDefinition,
    trigger: AutomationRunRecord["trigger"],
    now: Date,
  ): Promise<string | undefined> {
    const automationRunId = this.ids.create() as AutomationRunId;
    const scheduledFor = trigger === "scheduled" ? (automation.nextRunAt ?? now) : now;
    const nextRunAt =
      trigger === "scheduled"
        ? getNextAutomationRunAt(automation.schedule, automation.timeWindow, now)
        : automation.nextRunAt;
    const run: AutomationRunRecord = {
      id: automationRunId,
      automationId: automation.id,
      trigger,
      status: "running",
      scheduledFor,
      startedAt: now,
    };
    const began = await this.repository.beginRun(
      owner,
      run,
      nextRunAt,
      trigger === "scheduled" ? automation.nextRunAt : undefined,
    );
    if (!began) return undefined;
    this.diagnostic?.({
      event: "automation.run.started",
      automationId: automation.id,
      runId: automationRunId,
      outcome: "success",
    });

    let conversationRunId: string | undefined;
    try {
      const accepted = await this.conversations.send(
        { conversationId: automation.conversationId, content: automation.prompt },
        {
          emit: (envelope) =>
            this.handleConversationEvent(owner, automation.id, automationRunId, envelope),
        },
      );
      conversationRunId = accepted.runId;
      this.activeConversationRuns.set(automationRunId, {
        automationId: automation.id,
        conversationRunId: accepted.runId,
      });
      await this.repository.attachConversationRun(automationRunId, accepted.runId);
      this.onConversationChanged?.();
    } catch (error) {
      if (conversationRunId) this.conversations.cancel(conversationRunId);
      const errorCode = error instanceof AppError ? error.code : "INTERNAL_UNEXPECTED";
      await this.finish(owner, automation.id, automationRunId, "failed", errorCode);
    }
    return automationRunId;
  }

  private handleConversationEvent(
    owner: string,
    automationId: AutomationId,
    automationRunId: AutomationRunId,
    envelope: AgentStreamEnvelope,
  ): void {
    if (envelope.event.type === "run.completed") {
      this.finishFromEvent(owner, automationId, automationRunId, "completed");
    } else if (envelope.event.type === "run.cancelled") {
      this.finishFromEvent(owner, automationId, automationRunId, "cancelled");
    } else if (envelope.event.type === "run.failed") {
      this.finishFromEvent(
        owner,
        automationId,
        automationRunId,
        "failed",
        envelope.event.error.code,
      );
    }
  }

  private finishFromEvent(
    owner: string,
    automationId: AutomationId,
    automationRunId: AutomationRunId,
    status: "completed" | "failed" | "cancelled",
    errorCode?: string,
  ): void {
    void this.finish(owner, automationId, automationRunId, status, errorCode).catch(() => {
      this.diagnostic?.({
        event: "automation.run.record_failed",
        automationId,
        runId: automationRunId,
        outcome: "failure",
        errorCode: "AUTOMATION_RUN_RECORD_FAILED",
      });
    });
  }

  private async finish(
    owner: string,
    automationId: AutomationId,
    automationRunId: AutomationRunId,
    status: "completed" | "failed" | "cancelled",
    errorCode?: string,
  ): Promise<void> {
    await this.repository.finishRun(owner, automationRunId, status, this.clock.now(), errorCode);
    this.activeConversationRuns.delete(automationRunId);
    this.onConversationChanged?.();
    this.diagnostic?.({
      event: "automation.run.completed",
      automationId,
      runId: automationRunId,
      outcome:
        status === "completed" ? "success" : status === "cancelled" ? "cancelled" : "failure",
      ...(errorCode ? { errorCode } : {}),
    });
  }

  private async requireOwner(): Promise<string> {
    const session = await this.sessions.get();
    if (!session) throw automationError("AUTH_SESSION_REQUIRED", "请先登录后再管理自动化任务。");
    return session.externalUserId;
  }

  private async requireAutomation(owner: string, id: string): Promise<AutomationDefinition> {
    const value = await this.repository.getById(owner, id as AutomationId);
    if (!value) throw automationError("AUTOMATION_NOT_FOUND", "自动化任务不存在或已删除。");
    return value;
  }
}

function automationError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "configuration", userMessage });
}
