import { describe, expect, it, vi } from "vitest";
import type {
  ContextCompaction,
  ContextCompactionRepository,
  ConversationDetail,
  ConversationId,
  ModelGateway,
  ModelRepository,
  SecretStore,
  ResolvedModel,
} from "@zimo/domain";

import type { ConversationCapabilityService } from "./conversation-capability-service";
import { ManualConversationCompactionService } from "./manual-conversation-compaction-service";

describe("ManualConversationCompactionService", () => {
  it("allows a development-sized two-message retention after two completed exchanges", async () => {
    const now = new Date("2026-09-20T00:00:00.000Z");
    const conversationId = "00000000-0000-4000-8000-000000000002" as ConversationId;
    const messages = Array.from({ length: 4 }, (_, position) => ({
      id: `message-${position}`,
      conversationId,
      role: position % 2 === 0 ? "user" : "assistant",
      status: "completed",
      content: `message-${position}`,
      position,
      createdAt: now,
      updatedAt: now,
    }));
    const conversation = {
      id: conversationId,
      modelId: "model-id",
      messages,
      contextCompactions: [],
    } as unknown as ConversationDetail;
    const resolved = {
      provider: { enabled: true, secretRef: "secret-ref", baseUrl: "https://example.test/v1" },
      model: { enabled: true, name: "test-model", capabilities: { maxContextTokens: 1_200_000 } },
    } as ResolvedModel;
    const repository = {
      create: vi.fn(async (_value: ContextCompaction) => undefined),
      complete: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    } as unknown as ContextCompactionRepository;
    const gateway = {
      testConnection: async () => undefined,
      stream: async function* () {
        yield { type: "text" as const, text: "## 当前任务\n继续" };
      },
    } satisfies ModelGateway;
    const secrets: SecretStore = {
      getStatus: async () => ({ available: true, backend: "memory", persistent: false }),
      get: async () => "fake-key",
      set: async () => undefined,
      delete: async () => undefined,
    };
    const service = new ManualConversationCompactionService(
      { getModel: async () => resolved } as unknown as ModelRepository,
      secrets,
      { resolve: async () => ({ skills: [] }) } as unknown as ConversationCapabilityService,
      { now: () => now },
      { create: () => "compaction-id" },
      gateway,
      repository,
      { retainMessageCount: 2 },
    );
    await service.compact(conversation, { emit: () => undefined });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "manual",
        coveredThroughPosition: 1,
        retainedFromPosition: 2,
      }),
    );
  });

  it("rejects concurrent operations and releases the slot after cancellation", async () => {
    const service = new ManualConversationCompactionService(
      {} as ModelRepository,
      {} as SecretStore,
      {
        resolve: async () => ({ workflowId: "workflow" }),
      } as unknown as ConversationCapabilityService,
      { now: () => new Date("2026-09-20T00:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000001" },
      {} as ModelGateway,
      {} as ContextCompactionRepository,
    );
    const conversation = {
      id: "00000000-0000-4000-8000-000000000002" as ConversationId,
      contextCompactions: [],
    } as unknown as ConversationDetail;
    const sink = { emit: () => undefined };
    const pending = service.compact(conversation, sink);
    expect(service.isCompacting(conversation.id)).toBe(true);
    const concurrent = service.compact(conversation, sink);
    expect(service.cancel(conversation.id)).toBe(true);
    await expect(concurrent).rejects.toMatchObject({ code: "CONVERSATION_RUN_ACTIVE" });
    await expect(pending).rejects.toMatchObject({ code: "CONTEXT_COMPACTION_CANCELLED" });
    expect(service.isCompacting(conversation.id)).toBe(false);
  });
});
