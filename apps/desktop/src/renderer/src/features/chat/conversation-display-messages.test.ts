import type { ConversationDetailView } from "@zimo/contracts";
import { describe, expect, it } from "vitest";

import {
  applyRegenerateAccepted,
  conversationMessageKey,
  visibleConversationMessages,
} from "./conversation-display-messages";

const conversationId = "22222222-2222-4222-8222-222222222222";

function assistant(
  id: string,
  overrides: Partial<ConversationDetailView["messages"][number]> = {},
): ConversationDetailView["messages"][number] {
  return {
    id,
    conversationId,
    role: "assistant",
    content: "旧回答",
    status: "completed",
    position: 1,
    createdAt: "2026-09-22T08:00:00.000Z",
    updatedAt: "2026-09-22T08:00:05.000Z",
    ...overrides,
  };
}

describe("visibleConversationMessages", () => {
  it("hides replaced assistant bubbles and keeps the replacement in the original slot", () => {
    const original = assistant("00000000-0000-4000-8000-000000000001");
    const replacement = assistant("00000000-0000-4000-8000-000000000002", {
      content: "",
      status: "streaming",
      position: 2,
      createdAt: "2026-09-22T08:01:00.000Z",
      replacesMessageId: original.id,
    });
    const visible = visibleConversationMessages([original, replacement]);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(replacement.id);
    expect(visible[0]?.position).toBe(original.position);
    expect(visible[0]?.createdAt).toBe(replacement.createdAt);
  });

  it("hides trailing messages below a mid-conversation regenerate", () => {
    const openingUser = {
      id: "00000000-0000-4000-8000-000000000009",
      conversationId,
      role: "user" as const,
      content: "你好",
      status: "completed" as const,
      position: 0,
      createdAt: "2026-09-22T07:59:00.000Z",
      updatedAt: "2026-09-22T07:59:00.000Z",
    };
    const firstAssistant = assistant("00000000-0000-4000-8000-000000000001", {
      position: 1,
      createdAt: "2026-09-22T08:00:00.000Z",
    });
    const followUpUser = {
      id: "00000000-0000-4000-8000-000000000010",
      conversationId,
      role: "user" as const,
      content: "继续问",
      status: "completed" as const,
      position: 2,
      createdAt: "2026-09-22T08:02:00.000Z",
      updatedAt: "2026-09-22T08:02:00.000Z",
    };
    const laterAssistant = assistant("00000000-0000-4000-8000-000000000011", {
      content: "后续回答",
      position: 3,
      createdAt: "2026-09-22T08:03:00.000Z",
    });
    const replacement = assistant("00000000-0000-4000-8000-000000000002", {
      content: "",
      status: "streaming" as const,
      position: 4,
      createdAt: "2026-09-22T08:05:00.000Z",
      replacesMessageId: firstAssistant.id,
    });
    const visible = visibleConversationMessages([
      openingUser,
      firstAssistant,
      followUpUser,
      laterAssistant,
      replacement,
    ]);
    expect(visible.map((message) => message.id)).toEqual([openingUser.id, replacement.id]);
  });

  it("keeps new messages sent after a mid-conversation regenerate", () => {
    const firstAssistant = assistant("00000000-0000-4000-8000-000000000001", { position: 1 });
    const replacement = assistant("00000000-0000-4000-8000-000000000002", {
      content: "新回答",
      status: "completed" as const,
      position: 2,
      createdAt: "2026-09-22T08:05:00.000Z",
      replacesMessageId: firstAssistant.id,
    });
    const newUser = {
      id: "00000000-0000-4000-8000-000000000010",
      conversationId,
      role: "user" as const,
      content: "新问题",
      status: "completed" as const,
      position: 3,
      createdAt: "2026-09-22T08:06:00.000Z",
      updatedAt: "2026-09-22T08:06:00.000Z",
    };
    const visible = visibleConversationMessages([firstAssistant, replacement, newUser]);
    expect(visible.map((message) => message.id)).toEqual([replacement.id, newUser.id]);
  });
});

describe("conversationMessageKey", () => {
  it("keeps a stable key for regenerated replies", () => {
    const original = assistant("00000000-0000-4000-8000-000000000001");
    const replacement = assistant("00000000-0000-4000-8000-000000000002", {
      replacesMessageId: original.id,
    });
    expect(conversationMessageKey(replacement, [original, replacement])).toBe(original.id);
  });
});

describe("applyRegenerateAccepted", () => {
  it("inserts a pending replacement before stream events arrive", () => {
    const original = assistant("00000000-0000-4000-8000-000000000001");
    const detail: ConversationDetailView = {
      id: conversationId,
      title: "测试",
      modelId: "33333333-3333-4333-8333-333333333333",
      skillIds: [],
      knowledgeBaseIds: [],
      mcpToolIds: [],
      browserEnabled: false,
      createdAt: "2026-09-22T07:00:00.000Z",
      updatedAt: "2026-09-22T08:00:05.000Z",
      messages: [original],
      contextCompactions: [],
    };
    const next = applyRegenerateAccepted(detail, conversationId, original.id, {
      runId: "44444444-4444-4444-8444-444444444444",
      assistantMessageId: "55555555-5555-4555-8555-555555555555",
    });
    expect(next?.activeRunId).toBe("44444444-4444-4444-8444-444444444444");
    expect(visibleConversationMessages(next!.messages)).toEqual([
      expect.objectContaining({
        id: "55555555-5555-4555-8555-555555555555",
        status: "pending",
        content: "",
        replacesMessageId: original.id,
      }),
    ]);
  });
});
