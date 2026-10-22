import type { ConversationDetailView } from "@zimo/contracts";

type Message = ConversationDetailView["messages"][number];

export function visibleConversationMessages(messages: readonly Message[]): Message[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const replacedIds = new Set(
    messages.map((message) => message.replacesMessageId).filter((id): id is string => Boolean(id)),
  );
  const replacements = messages
    .filter((message) => !replacedIds.has(message.id))
    .map((message) => {
      const anchor = displayAnchor(message, byId);
      if (anchor.id === message.id) return message;
      return {
        ...message,
        position: anchor.position,
      };
    });

  const regenerating = replacements.filter((message) => message.replacesMessageId);
  if (regenerating.length === 0) return replacements;

  return replacements.filter((message) => !isHiddenByRegeneration(message, regenerating, byId));
}

function isHiddenByRegeneration(
  message: Message,
  replacements: readonly Message[],
  byId: Map<string, Message>,
): boolean {
  for (const replacement of replacements) {
    const anchor = displayAnchor(replacement, byId);
    if (message.id === replacement.id) return false;
    if (message.position <= anchor.position) continue;
    if (message.createdAt < replacement.createdAt) return true;
  }
  return false;
}

export function conversationMessageKey(message: Message, messages: readonly Message[]): string {
  const byId = new Map(messages.map((item) => [item.id, item]));
  return displayAnchor(message, byId).id;
}

export function applyRegenerateAccepted(
  current: ConversationDetailView | null,
  conversationId: string,
  replacedMessageId: string,
  accepted: { runId: string; assistantMessageId: string },
): ConversationDetailView | null {
  if (!current || current.id !== conversationId) return current;
  const replaced = current.messages.find((message) => message.id === replacedMessageId);
  if (!replaced || replaced.role !== "assistant") return current;
  if (current.messages.some((message) => message.id === accepted.assistantMessageId)) {
    return { ...current, activeRunId: accepted.runId };
  }
  const now = new Date().toISOString();
  const replacement: Message = {
    id: accepted.assistantMessageId,
    conversationId: current.id,
    role: "assistant",
    content: "",
    status: "pending",
    position: replaced.position,
    replacesMessageId: replacedMessageId,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...current,
    activeRunId: accepted.runId,
    messages: [...current.messages, replacement],
  };
}

function displayAnchor(message: Message, byId: Map<string, Message>): Message {
  let anchor = message;
  while (anchor.replacesMessageId) {
    const replaced = byId.get(anchor.replacesMessageId);
    if (!replaced) break;
    anchor = replaced;
  }
  return anchor;
}
