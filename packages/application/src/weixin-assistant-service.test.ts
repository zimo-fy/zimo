import { describe, expect, it, vi } from "vitest";
import type {
  CommunicationChannelBinding,
  CommunicationChannelRepository,
  SecretStore,
  SessionStore,
  WeixinAssistantRepository,
  WeixinMessagingGateway,
  WeixinUpdatesResult,
} from "@zimo/domain";

import type { ConversationService } from "./conversation-service";
import { WeixinAssistantService } from "./weixin-assistant-service";

const now = new Date("2026-09-14T08:00:00.000Z");

describe("WeixinAssistantService", () => {
  it("routes one inbound text into 微信助手 and replies with its context token", async () => {
    const binding: CommunicationChannelBinding = {
      ownerUserId: "owner-1",
      kind: "weixin",
      status: "bound",
      accountLabel: "bot-1",
      secretRef: "weixin-secret",
      config: { baseUrl: "https://ilinkai.weixin.qq.com" },
      boundAt: now,
      updatedAt: now,
    };
    const bindings = channelRepository(binding);
    const assistant = new MemoryAssistantRepository();
    const secrets = new MemorySecrets({
      "weixin-secret": JSON.stringify({ botToken: "bot-token" }),
    });
    const sent: Array<{ recipientUserId: string; contextToken: string; text: string }> = [];
    let polls = 0;
    const gateway: WeixinMessagingGateway = {
      notifyStart: vi.fn(async () => undefined),
      getUpdates: vi.fn(async (_baseUrl, _token, _cursor, signal): Promise<WeixinUpdatesResult> => {
        polls += 1;
        if (polls === 1) {
          return {
            nextCursor: "cursor-1",
            messages: [
              {
                dedupeKey: "message-1",
                peerUserId: "peer-1",
                contextToken: "context-1",
                text: "帮我总结今天的事项",
              },
            ],
          };
        }
        return new Promise<WeixinUpdatesResult>((_, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
            { once: true },
          );
        });
      }),
      sendText: vi.fn(async (_baseUrl, _token, input) => {
        sent.push({ ...input });
      }),
      notifyStop: vi.fn(async () => undefined),
    };
    const conversations = conversationService();
    const service = new WeixinAssistantService(
      bindings,
      assistant,
      sessionStore("owner-1"),
      secrets,
      gateway,
      conversations,
      { now: () => now },
      vi.fn(),
    );

    await service.start();
    await waitFor(() => sent.length === 1);

    expect(sent[0]).toEqual({
      recipientUserId: "peer-1",
      contextToken: "context-1",
      text: "这是微信助手的回复",
    });
    expect(assistant.conversationId).toBe("conversation-1");
    expect(assistant.receipts.get("message-1")).toBe("completed");
    expect(JSON.parse((await secrets.get("weixin-secret"))!)).toMatchObject({
      getUpdatesBuf: "cursor-1",
      lastContextToken: "context-1",
      lastPeerUserId: "peer-1",
    });
    expect(service.getStatus()).toMatchObject({
      status: "listening",
      canSendTestMessage: true,
    });
    await service.stop();
  });

  it("requires an inbound context before sending a test message", async () => {
    const service = new WeixinAssistantService(
      channelRepository(null),
      new MemoryAssistantRepository(),
      sessionStore("owner-1"),
      new MemorySecrets({}),
      {} as WeixinMessagingGateway,
      conversationService(),
      { now: () => now },
      vi.fn(),
    );
    await expect(service.sendTestMessage()).rejects.toMatchObject({
      code: "WEIXIN_CHANNEL_NOT_RUNNING",
    });
  });
});

function channelRepository(
  binding: CommunicationChannelBinding | null,
): CommunicationChannelRepository {
  return {
    list: async (ownerUserId) => (binding?.ownerUserId === ownerUserId ? [binding] : []),
    get: async (ownerUserId, kind) =>
      binding?.ownerUserId === ownerUserId && binding.kind === kind ? binding : null,
    save: async () => undefined,
    clear: async () => undefined,
  };
}

function sessionStore(ownerUserId: string): SessionStore {
  return {
    get: async () => ({ externalUserId: ownerUserId }) as never,
    save: async () => undefined,
    clear: async () => undefined,
  };
}

class MemorySecrets implements SecretStore {
  readonly values: Map<string, string>;
  constructor(values: Record<string, string>) {
    this.values = new Map(Object.entries(values));
  }
  async getStatus() {
    return { available: true, backend: "test", persistent: true };
  }
  async set(ref: string, value: string) {
    this.values.set(ref, value);
  }
  async get(ref: string) {
    return this.values.get(ref) ?? null;
  }
  async delete(ref: string) {
    this.values.delete(ref);
  }
}

class MemoryAssistantRepository implements WeixinAssistantRepository {
  conversationId: string | null = null;
  readonly receipts = new Map<string, "processing" | "completed" | "failed">();
  async getConversationId() {
    return this.conversationId;
  }
  async saveConversationId(_ownerUserId: string, conversationId: string) {
    this.conversationId = conversationId;
  }
  async claimInbound(_ownerUserId: string, dedupeKey: string) {
    if (this.receipts.has(dedupeKey)) return false;
    this.receipts.set(dedupeKey, "processing");
    return true;
  }
  async finishInbound(_ownerUserId: string, dedupeKey: string, status: "completed" | "failed") {
    this.receipts.set(dedupeKey, status);
  }
}

function conversationService(): ConversationService {
  return {
    create: vi.fn(async () => ({ id: "conversation-1" })),
    rename: vi.fn(async () => ({ id: "conversation-1" })),
    send: vi.fn(async (_input, sink) => {
      sink.emit({
        runId: "run-1",
        sequence: 1,
        emittedAt: now.toISOString(),
        event: { type: "run.completed" },
      });
      return {
        runId: "run-1",
        userMessageId: "user-message-1",
        assistantMessageId: "assistant-message-1",
      };
    }),
    get: vi.fn(async () => ({
      messages: [{ id: "assistant-message-1", content: "这是微信助手的回复" }],
    })),
    cancel: vi.fn(() => true),
  } as unknown as ConversationService;
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Condition was not reached");
}
