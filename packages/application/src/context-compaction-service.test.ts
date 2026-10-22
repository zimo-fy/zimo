import { describe, expect, it } from "vitest";
import type {
  AgentStreamEvent,
  ContextCompaction,
  ContextCompactionRepository,
  Conversation,
  ConversationId,
  Message,
  MessageId,
  ModelGateway,
  ModelId,
  ModelProviderId,
  ResolvedModel,
} from "@zimo/domain";

import { ContextCompactionService, estimateTextTokens } from "./context-compaction-service";
import { compileConversationMessages } from "./conversation-model-messages";

describe("ContextCompactionService", () => {
  it("manually creates a checkpoint below the automatic threshold", async () => {
    const repository = new MemoryCompactionRepository();
    const service = new ContextCompactionService(
      repository,
      new SummaryGateway("## 当前任务\n继续"),
      fixedClock,
      fixedIds,
    );
    const events: AgentStreamEvent[] = [];
    const result = await service.prepare({
      conversation: makeConversation(14),
      contextCompactions: [],
      surfaceMessages: [],
      resolved: resolvedModel,
      connection,
      extraContextTokens: 0,
      signal: new AbortController().signal,
      trigger: "manual",
      emit: (event) => events.push(event),
    });
    expect(result).toMatchObject({
      trigger: "manual",
      status: "completed",
      coveredThroughPosition: 1,
    });
    expect(events.map((event) => event.type)).toEqual([
      "context.compaction.started",
      "context.compaction.completed",
    ]);
  });

  it("rejects manual compression without eligible history", async () => {
    const service = new ContextCompactionService(
      new MemoryCompactionRepository(),
      new SummaryGateway("summary"),
      fixedClock,
      fixedIds,
    );
    await expect(
      service.prepare({
        conversation: makeConversation(12),
        contextCompactions: [],
        surfaceMessages: [],
        resolved: resolvedModel,
        connection,
        extraContextTokens: 0,
        signal: new AbortController().signal,
        trigger: "manual",
        emit: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "CONTEXT_COMPACTION_NOT_READY" });
  });
  it("creates a checkpoint before the retained recent messages", async () => {
    const repository = new MemoryCompactionRepository();
    const gateway = new SummaryGateway("## 当前任务\n继续完成上下文压缩功能");
    const events: AgentStreamEvent[] = [];
    const conversation = makeConversation(6);
    const service = new ContextCompactionService(repository, gateway, fixedClock, fixedIds, {
      maxContextTokens: 1_000,
      softRatio: 0.2,
      hardRatio: 0.9,
      outputReserveTokens: 0,
      retainMessageCount: 2,
    });

    const result = await service.prepare({
      conversation,
      contextCompactions: [],
      surfaceMessages: conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      resolved: resolvedModel,
      connection,
      extraContextTokens: 0,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
    });

    expect(result).toMatchObject({
      status: "completed",
      version: 1,
      coveredThroughPosition: 3,
      retainedFromPosition: 4,
    });
    expect(repository.values[0]).toMatchObject({ status: "completed" });
    expect(events.map((event) => event.type)).toEqual([
      "context.compaction.started",
      "context.compaction.completed",
    ]);
  });

  it("uses the previous summary and only exposes messages after its boundary", () => {
    const conversation = makeConversation(6);
    const previous = completedCompaction(conversation, 3);
    const messages = compileConversationMessages({
      history: conversation.messages,
      skills: [],
      hasTools: false,
      contextCompaction: previous,
    });

    expect(messages.some((message) => message.content.includes("旧摘要"))).toBe(true);
    expect(messages.some((message) => message.content === conversation.messages[2]!.content)).toBe(
      false,
    );
    expect(messages.some((message) => message.content === conversation.messages[4]!.content)).toBe(
      true,
    );
  });

  it("fails closed when compaction fails beyond the hard threshold", async () => {
    const repository = new MemoryCompactionRepository();
    const service = new ContextCompactionService(
      repository,
      new FailingGateway(),
      fixedClock,
      fixedIds,
      {
        maxContextTokens: 1_000,
        softRatio: 0.1,
        hardRatio: 0.2,
        outputReserveTokens: 0,
        retainMessageCount: 2,
      },
    );
    const conversation = makeConversation(6);

    await expect(
      service.prepare({
        conversation,
        contextCompactions: [],
        surfaceMessages: conversation.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        resolved: resolvedModel,
        connection,
        extraContextTokens: 0,
        signal: new AbortController().signal,
        emit: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "CONTEXT_COMPACTION_REQUIRED" });
    expect(repository.values[0]).toMatchObject({
      status: "failed",
      errorCode: "CONTEXT_COMPACTION_FAILED",
    });
  });

  it("estimates non-ASCII text conservatively", () => {
    expect(estimateTextTokens("abcd中文")).toBe(3);
  });
});

class MemoryCompactionRepository implements ContextCompactionRepository {
  values: ContextCompaction[] = [];

  async listByConversation(): Promise<readonly ContextCompaction[]> {
    return this.values;
  }

  async create(value: ContextCompaction): Promise<void> {
    this.values.push(value);
  }

  async complete(
    id: string,
    value: Readonly<{ summary: string; outputTokens: number; updatedAt: Date }>,
  ): Promise<void> {
    this.values = this.values.map((item) =>
      item.id === id ? { ...item, ...value, status: "completed" } : item,
    );
  }

  async fail(id: string, value: Readonly<{ errorCode: string; updatedAt: Date }>): Promise<void> {
    this.values = this.values.map((item) =>
      item.id === id ? { ...item, ...value, status: "failed" } : item,
    );
  }

  async repairInterrupted(): Promise<void> {}
}

class SummaryGateway implements ModelGateway {
  constructor(private readonly summary: string) {}
  async testConnection(): Promise<void> {}
  async *stream(): AsyncIterable<{ type: "text"; text: string } | { type: "completed" }> {
    yield { type: "text", text: this.summary };
    yield { type: "completed" };
  }
}

class FailingGateway implements ModelGateway {
  async testConnection(): Promise<void> {}
  stream(): AsyncIterable<never> {
    return {
      [Symbol.asyncIterator]() {
        return {
          next: async () => {
            throw new Error("provider failed");
          },
        };
      },
    };
  }
}

const fixedClock = { now: () => new Date("2026-09-18T10:00:00.000Z") };
const fixedIds = { create: () => "00000000-0000-4000-8000-000000000099" };
const connection = { baseUrl: "https://example.com/v1", apiKey: "test-key", modelName: "test" };
const resolvedModel: ResolvedModel = {
  provider: {
    id: "00000000-0000-4000-8000-000000000001" as ModelProviderId,
    name: "Test",
    baseUrl: connection.baseUrl,
    secretRef: "secret-ref",
    keyHint: "••••",
    kind: "openai-compatible",
    enabled: true,
    createdAt: fixedClock.now(),
    updatedAt: fixedClock.now(),
  },
  model: {
    id: "00000000-0000-4000-8000-000000000002" as ModelId,
    providerId: "00000000-0000-4000-8000-000000000001" as ModelProviderId,
    name: "test",
    displayName: "Test",
    capabilities: {
      streaming: true,
      toolCalling: false,
      structuredOutput: false,
      vision: false,
      reasoning: false,
      promptCaching: false,
      maxContextTokens: 1_000,
    },
    enabled: true,
    createdAt: fixedClock.now(),
    updatedAt: fixedClock.now(),
  },
};

function makeConversation(messageCount: number): Conversation {
  const conversationId = "00000000-0000-4000-8000-000000000010" as ConversationId;
  const messages: Message[] = Array.from({ length: messageCount }, (_, position) => ({
    id: `00000000-0000-4000-8000-${String(position + 20).padStart(12, "0")}` as MessageId,
    conversationId,
    role: position % 2 === 0 ? "user" : "assistant",
    content: `message-${position}-${"x".repeat(600)}`,
    status: "completed",
    position,
    createdAt: fixedClock.now(),
    updatedAt: fixedClock.now(),
  }));
  return {
    id: conversationId,
    title: "Test",
    modelId: resolvedModel.model.id,
    skillIds: [],
    knowledgeBaseIds: [],
    mcpToolIds: [],
    browserEnabled: false,
    messages,
    createdAt: fixedClock.now(),
    updatedAt: fixedClock.now(),
  };
}

function completedCompaction(
  conversation: Conversation,
  coveredThroughPosition: number,
): ContextCompaction {
  return {
    id: "00000000-0000-4000-8000-000000000090",
    conversationId: conversation.id,
    version: 1,
    status: "completed",
    trigger: "threshold",
    sourceFromMessageId: conversation.messages[0]!.id,
    sourceToMessageId: conversation.messages[coveredThroughPosition]!.id,
    coveredThroughPosition,
    retainedFromPosition: coveredThroughPosition + 1,
    summary: "旧摘要",
    inputTokens: 900,
    outputTokens: 20,
    createdAt: fixedClock.now(),
    updatedAt: fixedClock.now(),
  };
}
