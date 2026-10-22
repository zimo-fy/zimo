import { describe, expect, it, vi } from "vitest";
import type {
  AgentStreamEnvelope,
  AutomationDefinition,
  AutomationId,
  AutomationRepository,
  AutomationRunId,
  AutomationRunRecord,
  ConversationId,
  SessionStore,
} from "@zimo/domain";

import type * as ConversationRun from "./conversation-run";
import type { ConversationService } from "./conversation-service";
import { AutomationService } from "./automation-service";

describe("AutomationService", () => {
  it("keeps the built-in browser available when updating an automation", async () => {
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    const changeCapabilities = vi.fn(async () => undefined);
    const service = new AutomationService(
      new MemoryAutomationRepository(automation),
      sessionStore("account-1"),
      {
        get: async () => ({ id: automation.conversationId, activeRunId: undefined }),
        changeCapabilities,
        rename: async () => undefined,
      } as unknown as ConversationService,
      { now: () => now },
      { create: () => crypto.randomUUID() },
    );

    await service.save({
      id: automation.id,
      name: automation.name,
      prompt: automation.prompt,
      enabled: false,
      agentId: null,
      skillIds: [],
      knowledgeBaseIds: [],
      workflowId: null,
      mcpToolIds: [],
      schedule: automation.schedule,
      timeWindow: automation.timeWindow,
    });
    expect(changeCapabilities).toHaveBeenCalledWith(
      automation.conversationId,
      expect.objectContaining({ browserEnabled: true }),
    );
  });

  it("runs through the dedicated conversation and records the terminal state", async () => {
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    const repository = new MemoryAutomationRepository(automation);
    const onConversationChanged = vi.fn();
    let sink: ConversationRun.ConversationStreamSink | undefined;
    const conversations = {
      send: async (_input: unknown, value: ConversationRun.ConversationStreamSink) => {
        sink = value;
        return {
          runId: "00000000-0000-4000-8000-000000000004",
          userMessageId: "00000000-0000-4000-8000-000000000005",
          assistantMessageId: "00000000-0000-4000-8000-000000000006",
        };
      },
      cancel: () => true,
    } as unknown as ConversationService;
    const service = new AutomationService(
      repository,
      sessionStore("account-1"),
      conversations,
      { now: () => now },
      { create: () => "00000000-0000-4000-8000-000000000003" },
      undefined,
      onConversationChanged,
    );

    await expect(service.runNow(automation.id)).resolves.toEqual({
      automationRunId: "00000000-0000-4000-8000-000000000003",
    });
    expect(repository.runs[0]).toMatchObject({ status: "running" });
    expect(onConversationChanged).toHaveBeenCalledTimes(1);
    sink?.emit(completedEnvelope(now));
    await repository.finished;
    expect(repository.runs[0]).toMatchObject({ status: "completed" });
    await vi.waitFor(() => expect(onConversationChanged).toHaveBeenCalledTimes(2));
  });

  it("keeps an executed task conversation when its automation is deleted", async () => {
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    const removeConversation = vi.fn().mockResolvedValue(undefined);
    const repository = new MemoryAutomationRepository(automation);
    const softDeleteAutomation = vi.spyOn(repository, "softDelete");
    const onConversationChanged = vi.fn();
    const service = new AutomationService(
      repository,
      sessionStore("account-1"),
      {
        get: async () => ({ messages: [{ id: crypto.randomUUID() }], activeRunId: null }),
        delete: removeConversation,
      } as unknown as ConversationService,
      { now: () => now },
      { create: () => crypto.randomUUID() },
      undefined,
      onConversationChanged,
    );

    await service.delete(automation.id);

    expect(softDeleteAutomation).toHaveBeenCalledWith("account-1", automation.id, now);
    expect(removeConversation).not.toHaveBeenCalled();
    expect(onConversationChanged).toHaveBeenCalledOnce();
  });

  it("removes an empty dedicated conversation when its automation is deleted", async () => {
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    const removeConversation = vi.fn().mockResolvedValue(undefined);
    const service = new AutomationService(
      new MemoryAutomationRepository(automation),
      sessionStore("account-1"),
      {
        get: async () => ({ messages: [], activeRunId: null }),
        delete: removeConversation,
      } as unknown as ConversationService,
      { now: () => now },
      { create: () => crypto.randomUUID() },
    );

    await service.delete(automation.id);

    expect(removeConversation).toHaveBeenCalledWith(automation.conversationId);
  });

  it("does not delete an automation while its conversation is running", async () => {
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    const repository = new MemoryAutomationRepository(automation);
    const softDeleteAutomation = vi.spyOn(repository, "softDelete");
    const service = new AutomationService(
      repository,
      sessionStore("account-1"),
      {
        get: async () => ({ messages: [], activeRunId: crypto.randomUUID() }),
      } as unknown as ConversationService,
      { now: () => now },
      { create: () => crypto.randomUUID() },
    );

    await expect(service.delete(automation.id)).rejects.toThrow("任务正在执行");
    expect(softDeleteAutomation).not.toHaveBeenCalled();
  });

  it("notifies the task list when a scheduled run establishes its conversation messages", async () => {
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    const onConversationChanged = vi.fn();
    const service = new AutomationService(
      new MemoryAutomationRepository(automation),
      sessionStore("account-1"),
      {
        send: async () => ({
          runId: "00000000-0000-4000-8000-000000000004",
          userMessageId: "00000000-0000-4000-8000-000000000005",
          assistantMessageId: "00000000-0000-4000-8000-000000000006",
        }),
      } as unknown as ConversationService,
      { now: () => now },
      { create: () => "00000000-0000-4000-8000-000000000003" },
      undefined,
      onConversationChanged,
    );

    await expect(service.runDue()).resolves.toBe(1);
    expect(onConversationChanged).toHaveBeenCalledOnce();
  });

  it("pauses a due interval task until the next daily time window", async () => {
    const now = new Date(2026, 8, 15, 20, 0, 0);
    const automation = {
      ...createAutomation(now),
      schedule: { kind: "interval" as const, everyMinutes: 60 },
      timeWindow: { startTime: "09:00", endTime: "18:00" },
    };
    const repository = new MemoryAutomationRepository(automation);
    let sendCount = 0;
    const conversations = {
      send: async () => {
        sendCount += 1;
        throw new Error("should not run");
      },
    } as unknown as ConversationService;
    const service = new AutomationService(
      repository,
      sessionStore("account-1"),
      conversations,
      { now: () => now },
      { create: () => crypto.randomUUID() },
    );

    await expect(service.runDue()).resolves.toBe(0);
    expect(sendCount).toBe(0);
    expect(repository.automation.enabled).toBe(true);
    expect(repository.automation.nextRunAt?.getDate()).toBe(16);
    expect(repository.automation.nextRunAt?.getHours()).toBe(9);
  });

  it("rejects a manual run outside the daily time window", async () => {
    const now = new Date(2026, 8, 15, 20, 0, 0);
    const automation = {
      ...createAutomation(now),
      timeWindow: { startTime: "09:00", endTime: "18:00" },
    };
    const repository = new MemoryAutomationRepository(automation);
    let sendCount = 0;
    const service = new AutomationService(
      repository,
      sessionStore("account-1"),
      {
        send: async () => {
          sendCount += 1;
          throw new Error("should not run");
        },
      } as unknown as ConversationService,
      { now: () => now },
      { create: () => crypto.randomUUID() },
    );

    await expect(service.runNow(automation.id)).rejects.toThrow("当前不在任务的执行时间范围内");
    expect(sendCount).toBe(0);
  });

  it("protects its dedicated conversation from direct deletion", async () => {
    const now = new Date("2026-09-15T08:00:00.000Z");
    const automation = createAutomation(now);
    const service = new AutomationService(
      new MemoryAutomationRepository(automation),
      sessionStore("account-1"),
      {} as ConversationService,
      { now: () => now },
      { create: () => crypto.randomUUID() },
    );

    await expect(service.assertConversationCanBeDeleted(automation.conversationId)).rejects.toThrow(
      "这是自动化任务的专用会话",
    );
    await expect(
      service.assertConversationCanBeDeleted(crypto.randomUUID()),
    ).resolves.toBeUndefined();
  });
});

class MemoryAutomationRepository implements AutomationRepository {
  readonly runs: AutomationRunRecord[] = [];
  automation: AutomationDefinition;
  private finishRunPromise: Promise<void>;
  private resolveFinished!: () => void;

  constructor(automation: AutomationDefinition) {
    this.automation = automation;
    this.finishRunPromise = new Promise((resolve) => {
      this.resolveFinished = resolve;
    });
  }

  get finished(): Promise<void> {
    return this.finishRunPromise;
  }

  async list(owner: string): Promise<readonly AutomationDefinition[]> {
    return owner === this.automation.ownerExternalUserId ? [this.automation] : [];
  }

  async getById(owner: string, id: AutomationId): Promise<AutomationDefinition | null> {
    return owner === this.automation.ownerExternalUserId && id === this.automation.id
      ? this.automation
      : null;
  }

  async save(value: AutomationDefinition): Promise<void> {
    this.automation = value;
  }

  async softDelete(): Promise<void> {}

  async listDue(owner: string, now: Date): Promise<readonly AutomationDefinition[]> {
    return owner === this.automation.ownerExternalUserId &&
      this.automation.nextRunAt &&
      this.automation.nextRunAt <= now
      ? [this.automation]
      : [];
  }

  async beginRun(
    _owner: string,
    run: AutomationRunRecord,
    nextRunAt: Date | undefined,
  ): Promise<boolean> {
    this.runs.push(run);
    this.automation = { ...this.automation, nextRunAt };
    return true;
  }

  async attachConversationRun(id: AutomationRunId, conversationRunId: string): Promise<void> {
    const run = this.runs.find((item) => item.id === id);
    if (run) Object.assign(run, { conversationRunId });
  }

  async finishRun(
    _owner: string,
    id: AutomationRunId,
    status: "completed" | "failed" | "cancelled",
    finishedAt: Date,
    errorCode?: string,
  ): Promise<void> {
    const index = this.runs.findIndex((item) => item.id === id);
    const run = this.runs[index];
    if (run) this.runs[index] = { ...run, status, finishedAt, ...(errorCode ? { errorCode } : {}) };
    this.resolveFinished();
  }

  async listRuns(): Promise<readonly AutomationRunRecord[]> {
    return this.runs;
  }

  async repairInterruptedRuns(): Promise<void> {}
}

function sessionStore(externalUserId: string): SessionStore {
  return {
    get: async () => ({
      id: "00000000-0000-4000-8000-000000000010" as never,
      provider: "zimo-cloud",
      externalUserId,
      account: "tester",
      displayName: "Tester",
      tokenSecretRef: "secret-ref",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    }),
    save: async () => undefined,
    clear: async () => undefined,
  };
}

function createAutomation(now: Date): AutomationDefinition {
  return {
    id: "00000000-0000-4000-8000-000000000001" as AutomationId,
    ownerExternalUserId: "account-1",
    conversationId: "00000000-0000-4000-8000-000000000002" as ConversationId,
    name: "日报",
    prompt: "生成日报",
    enabled: true,
    schedule: { kind: "daily", time: "16:00" },
    timeWindow: { startTime: "00:00", endTime: "23:59" },
    nextRunAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function completedEnvelope(now: Date): AgentStreamEnvelope {
  return {
    runId: "00000000-0000-4000-8000-000000000004" as never,
    sequence: 1,
    emittedAt: now.toISOString(),
    event: { type: "run.completed" },
  };
}
