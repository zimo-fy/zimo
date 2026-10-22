import { describe, expect, it } from "vitest";
import type {
  ConversationId,
  MessageId,
  SessionStore,
  UserMemory,
  UserMemoryRepository,
} from "@zimo/domain";

import { UserMemoryService } from "./user-memory-service";
import { compileConversationMessages } from "./conversation-model-messages";
import { createUserMemoryTool } from "./user-memory-tool";

const now = new Date("2026-09-20T00:00:00.000Z");
const repository: UserMemoryRepository & { values: UserMemory[] } = {
  values: [],
  async list(owner) {
    return this.values.filter((item) => item.ownerUserId === owner);
  },
  async get(owner, id) {
    return this.values.find((item) => item.ownerUserId === owner && item.id === id) ?? null;
  },
  async create(value) {
    this.values.push(value);
  },
  async update(owner, id, value) {
    const index = this.values.findIndex((item) => item.ownerUserId === owner && item.id === id);
    if (index < 0) return false;
    this.values[index] = { ...this.values[index]!, ...value };
    return true;
  },
  async delete(owner, id) {
    const index = this.values.findIndex((item) => item.ownerUserId === owner && item.id === id);
    if (index < 0) return false;
    this.values.splice(index, 1);
    return true;
  },
};

describe("UserMemoryService", () => {
  it("saves a model tool proposal for the current account and injects it into later requests", async () => {
    repository.values = [];
    let owner = "alice";
    let sequence = 0;
    const service = new UserMemoryService(
      repository,
      { get: async () => ({ externalUserId: owner }) } as SessionStore,
      { now: () => now },
      { create: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` },
    );
    const tool = createUserMemoryTool(service);
    const args = tool.parse({ kind: "preference", content: "请称呼我为大力" });
    const context = {
      runId: "run-1",
      workflowId: "conversation-1",
      nodeId: "conversation-agent",
      toolCallId: "call-1",
      ownerUserId: "alice",
      signal: new AbortController().signal,
    };

    await expect(tool.execute(args, context)).resolves.toEqual({ saved: true });
    await expect(tool.execute(args, context)).resolves.toEqual({ saved: false });
    const messages = compileConversationMessages({
      history: [],
      skills: [],
      hasTools: true,
      userMemories: await service.listActive(),
    });
    expect(messages.some((message) => message.content.includes("请称呼我为大力"))).toBe(true);

    owner = "bob";
    await expect(tool.execute(args, context)).rejects.toMatchObject({
      code: "USER_MEMORY_OWNER_CHANGED",
    });
    expect(await service.listActive()).toEqual([]);
    expect(repository.values).toHaveLength(1);
  });

  it("rejects malformed memory tool arguments and missing run ownership", async () => {
    repository.values = [];
    const service = new UserMemoryService(
      repository,
      { get: async () => ({ externalUserId: "alice" }) } as SessionStore,
      { now: () => now },
      { create: () => "00000000-0000-4000-8000-000000000001" },
    );
    const tool = createUserMemoryTool(service);
    expect(() => tool.parse({ kind: "preference", content: "x", extra: true })).toThrow();
    expect(() => tool.parse({ kind: "identity", content: "x" })).toThrow();
    expect(() => tool.parse({ kind: "preference", content: " " })).toThrow();
    await expect(
      tool.execute(tool.parse({ kind: "preference", content: "请称呼我为大力" }), {
        runId: "run-1",
        workflowId: "conversation-1",
        nodeId: "conversation-agent",
        toolCallId: "call-1",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "USER_MEMORY_OWNER_REQUIRED" });
    expect(repository.values).toEqual([]);
  });

  it("isolates owner, updates and deletes memories", async () => {
    repository.values = [];
    let owner = "alice";
    const session = { get: async () => ({ externalUserId: owner }) } as SessionStore;
    let sequence = 0;
    const service = new UserMemoryService(
      repository,
      session,
      { now: () => now },
      { create: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` },
    );
    const saved = await service.save({
      kind: "preference",
      content: "  使用中文  ",
      enabled: true,
    });
    expect(saved.content).toBe("使用中文");
    owner = "bob";
    expect(await service.list()).toEqual([]);
    await expect(service.delete(saved.id)).rejects.toMatchObject({ code: "USER_MEMORY_NOT_FOUND" });
    owner = "alice";
    await service.save({ id: saved.id, kind: "preference", content: "简体中文", enabled: false });
    expect(await service.listActive()).toEqual([]);
    await service.delete(saved.id);
    expect(await service.list()).toEqual([]);
  });

  it("injects only enabled bounded memory before conversation history", () => {
    const memory: UserMemory = {
      id: "m",
      ownerUserId: "alice",
      kind: "preference",
      content: "简体中文",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    const messages = compileConversationMessages({
      history: [],
      skills: [],
      hasTools: false,
      userMemories: [memory, { ...memory, id: "off", content: "not used", enabled: false }],
    });
    expect(messages[1]?.content).toContain("简体中文");
    expect(messages.some((message) => message.content.includes("not used"))).toBe(false);
  });

  it("places current memory after an older checkpoint so edits take precedence", () => {
    const memory: UserMemory = {
      id: "m",
      ownerUserId: "alice",
      kind: "preference",
      content: "使用中文",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    const messages = compileConversationMessages({
      history: [],
      skills: [],
      hasTools: false,
      userMemories: [memory],
      contextCompaction: {
        id: "checkpoint",
        conversationId: "conversation" as ConversationId,
        version: 1,
        status: "completed",
        trigger: "threshold",
        sourceFromMessageId: "from" as MessageId,
        sourceToMessageId: "to" as MessageId,
        coveredThroughPosition: 1,
        retainedFromPosition: 2,
        summary: "旧偏好：使用英文",
        inputTokens: 100,
        outputTokens: 10,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(messages[1]?.content).toContain("旧偏好");
    expect(messages[2]?.content).toContain("使用中文");
  });
});
