// @vitest-environment jsdom
import type { AgentStreamEnvelopeView, ConversationDetailView } from "@zimo/contracts";
import { describe, expect, it } from "vitest";

import { applyStreamEnvelope } from "./chat-stream";

describe("applyStreamEnvelope usage", () => {
  it("attaches provider usage to the in-flight assistant message", () => {
    let detail: ConversationDetailView | null = baseDetail();
    applyStreamEnvelope(
      envelope({ type: "usage.updated", usage: { totalTokens: 42 } }),
      (update) => {
        detail = typeof update === "function" ? update(detail) : update;
      },
    );
    expect(detail?.messages[0]?.usage).toEqual({ totalTokens: 42 });
  });

  it("keeps usage and records completion time when the message completes", () => {
    let detail: ConversationDetailView | null = {
      ...baseDetail(),
      messages: [{ ...baseDetail().messages[0]!, usage: { totalTokens: 42 } }],
    };
    applyStreamEnvelope(
      envelope({ type: "message.completed", messageId: MESSAGE_ID }),
      (update) => {
        detail = typeof update === "function" ? update(detail) : update;
      },
    );
    expect(detail?.messages[0]).toMatchObject({
      status: "completed",
      usage: { totalTokens: 42 },
      updatedAt: "2026-09-18T03:47:00.000Z",
    });
  });

  it("applies late usage to a completed assistant message by id", () => {
    let detail: ConversationDetailView | null = {
      ...baseDetail(),
      messages: [
        {
          ...baseDetail().messages[0]!,
          status: "completed",
          usage: { totalTokens: 42 },
        },
      ],
    };
    applyStreamEnvelope(
      envelope({
        type: "usage.updated",
        messageId: MESSAGE_ID,
        usage: { totalTokens: 1055 },
      }),
      (update) => {
        detail = typeof update === "function" ? update(detail) : update;
      },
    );
    expect(detail?.messages[0]?.usage).toEqual({ totalTokens: 1055 });
  });

  it("marks the in-flight assistant as cancelled while keeping usage", () => {
    let detail: ConversationDetailView | null = {
      ...baseDetail(),
      messages: [{ ...baseDetail().messages[0]!, usage: { totalTokens: 20 } }],
    };
    applyStreamEnvelope(envelope({ type: "run.cancelled" }), (update) => {
      detail = typeof update === "function" ? update(detail) : update;
    });
    expect(detail?.messages[0]).toMatchObject({
      status: "cancelled",
      usage: { totalTokens: 20 },
      updatedAt: "2026-09-18T03:47:00.000Z",
    });
  });

  it("attaches tool steps to the matching assistant message", () => {
    let detail: ConversationDetailView | null = baseDetail();
    applyStreamEnvelope(
      envelope({
        type: "message.steps.updated",
        messageId: MESSAGE_ID,
        steps: [
          {
            id: "call-1",
            kind: "file_read",
            title: "读取 notes.md",
            status: "completed",
            resultTitle: "已读取 notes.md",
            relativeTarget: "notes.md",
          },
        ],
      }),
      (update) => {
        detail = typeof update === "function" ? update(detail) : update;
      },
    );
    expect(detail?.messages[0]?.steps).toEqual([
      {
        id: "call-1",
        kind: "file_read",
        title: "读取 notes.md",
        status: "completed",
        resultTitle: "已读取 notes.md",
        relativeTarget: "notes.md",
      },
    ]);
  });
});

const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";
const MESSAGE_ID = "00000000-0000-4000-8000-000000000011";
const MODEL_ID = "00000000-0000-4000-8000-000000000002";

function baseDetail(): ConversationDetailView {
  return {
    id: CONVERSATION_ID,
    title: "任务",
    modelId: MODEL_ID,
    skillIds: [],
    knowledgeBaseIds: [],
    mcpToolIds: [],
    browserEnabled: false,
    messages: [
      {
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        role: "assistant",
        content: "你好",
        status: "streaming",
        position: 1,
        createdAt: "2026-09-18T03:46:00.000Z",
        updatedAt: "2026-09-18T03:46:00.000Z",
      },
    ],
    contextCompactions: [],
    createdAt: "2026-09-18T03:00:00.000Z",
    updatedAt: "2026-09-18T03:46:00.000Z",
  };
}

function envelope(event: AgentStreamEnvelopeView["event"]): AgentStreamEnvelopeView {
  return {
    runId: "00000000-0000-4000-8000-000000000099",
    sequence: 1,
    emittedAt: "2026-09-18T03:47:00.000Z",
    event,
  };
}
