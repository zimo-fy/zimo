import type { AgentStreamEnvelopeView, ConversationDetailView } from "@zimo/contracts";
import type { Dispatch, SetStateAction } from "react";

import { consumedTokens } from "./assistant-reply-format";

export function applyStreamEnvelope(
  envelope: AgentStreamEnvelopeView,
  setDetail: Dispatch<SetStateAction<ConversationDetailView | null>>,
) {
  setDetail((current) => {
    if (!current) return current;
    const event = envelope.event;
    if (
      event.type === "context.compaction.started" ||
      event.type === "context.compaction.completed"
    ) {
      if (event.compaction.conversationId !== current.id) return current;
      const remaining = current.contextCompactions.filter(
        (compaction) => compaction.id !== event.compaction.id,
      );
      return {
        ...current,
        contextCompactions: [...remaining, event.compaction].sort(
          (left, right) => left.version - right.version,
        ),
      };
    }
    if (event.type === "context.compaction.failed") {
      return {
        ...current,
        contextCompactions: current.contextCompactions.map((compaction) =>
          compaction.id === event.compactionId
            ? {
                ...compaction,
                status: "failed" as const,
                errorCode: event.errorCode,
                updatedAt: envelope.emittedAt,
              }
            : compaction,
        ),
      };
    }
    if (event.type === "knowledge.retrieved") {
      return {
        ...current,
        messages: current.messages.map((message) =>
          message.id === event.messageId
            ? { ...message, knowledgeCitations: event.citations }
            : message,
        ),
      };
    }
    if (event.type === "usage.updated") {
      return {
        ...current,
        messages: current.messages.map((message) => {
          if (event.messageId)
            return message.id === event.messageId ? { ...message, usage: event.usage } : message;
          return message.role === "assistant" &&
            (message.status === "streaming" || message.status === "pending")
            ? { ...message, usage: event.usage }
            : message;
        }),
      };
    }
    if (event.type === "message.steps.updated") {
      return {
        ...current,
        messages: current.messages.map((message) =>
          message.id === event.messageId ? { ...message, steps: event.steps } : message,
        ),
      };
    }
    if (
      event.type === "message.delta" ||
      event.type === "message.started" ||
      event.type === "message.completed"
    ) {
      return {
        ...current,
        activeRunId: envelope.runId,
        messages: current.messages.map((message) =>
          message.id !== event.messageId
            ? message
            : {
                ...message,
                content:
                  event.type === "message.delta" ? message.content + event.text : message.content,
                status: event.type === "message.completed" ? "completed" : "streaming",
                updatedAt:
                  event.type === "message.completed" ? envelope.emittedAt : message.updatedAt,
              },
        ),
      };
    }
    if (event.type === "run.cancelled" || event.type === "run.failed") {
      const rest = { ...current };
      delete rest.activeRunId;
      const status = event.type === "run.cancelled" ? ("cancelled" as const) : ("failed" as const);
      return {
        ...rest,
        messages: rest.messages.map((message) =>
          message.role === "assistant" &&
          (message.status === "streaming" || message.status === "pending")
            ? { ...message, status, updatedAt: envelope.emittedAt }
            : message,
        ),
      };
    }
    if (event.type === "run.completed") {
      const rest = { ...current };
      delete rest.activeRunId;
      return rest;
    }
    return current;
  });
}

export function retainMessageUsage(
  current: ConversationDetailView | null,
  incoming: ConversationDetailView,
): ConversationDetailView {
  if (!current || current.id !== incoming.id) return incoming;
  return {
    ...incoming,
    messages: incoming.messages.map((message) => {
      const previous = current.messages.find((item) => item.id === message.id);
      const usage = richerUsage(previous?.usage, message.usage);
      const steps = mergeAssistantSteps(previous?.steps, message.steps);
      return {
        ...message,
        ...(usage ? { usage } : {}),
        ...(steps ? { steps } : {}),
      };
    }),
  };
}

function richerUsage(
  left: ConversationDetailView["messages"][number]["usage"],
  right: ConversationDetailView["messages"][number]["usage"],
): ConversationDetailView["messages"][number]["usage"] {
  const leftTotal = consumedTokens(left) ?? -1;
  const rightTotal = consumedTokens(right) ?? -1;
  if (leftTotal < 0 && rightTotal < 0) return undefined;
  return leftTotal >= rightTotal ? left : right;
}

function mergeAssistantSteps(
  previous: ConversationDetailView["messages"][number]["steps"],
  incoming: ConversationDetailView["messages"][number]["steps"],
): ConversationDetailView["messages"][number]["steps"] {
  if (!previous?.length) return incoming;
  if (!incoming?.length) return previous;
  const incomingIds = new Set(incoming.map((step) => step.id));
  const byId = new Map(incoming.map((step) => [step.id, step]));
  for (const step of previous) {
    const current = byId.get(step.id);
    if (!current) byId.set(step.id, step);
    else if (stepRank(step.status) > stepRank(current.status)) byId.set(step.id, step);
  }
  return [
    ...incoming.map((step) => byId.get(step.id) ?? step),
    ...previous.filter((step) => !incomingIds.has(step.id)),
  ];
}

function stepRank(
  status: NonNullable<ConversationDetailView["messages"][number]["steps"]>[number]["status"],
): number {
  return status === "running" ? 0 : 1;
}
