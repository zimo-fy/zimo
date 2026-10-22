import type { Conversation } from "@zimo/domain";

import { inspectConversationImageTurn } from "./conversation-vision";
import type { DocumentArtifactService } from "./document-artifact-service";
import { isDocumentFollowup, resolveDocumentToolIds } from "./document-tools";

export async function prepareConversationDocumentContext(input: {
  conversation: Conversation;
  text?: string;
  documents: DocumentArtifactService;
  signal: AbortSignal;
  vision?: boolean;
}): Promise<{
  context: string;
  toolIds: readonly string[];
  visionTurn: Awaited<ReturnType<typeof inspectConversationImageTurn>>;
}> {
  const visionTurn = await inspectConversationImageTurn({
    conversation: input.conversation,
    listMessageImages: (conversationId, messageId) =>
      input.documents.listMessageImages(conversationId, messageId),
    vision: input.vision === true,
  });
  const currentUserMessage = visionTurn.currentUserMessage;
  const text = input.text ?? currentUserMessage?.content ?? "";
  const hasCurrentAttachments = currentUserMessage
    ? await input.documents.hasMessageAttachments(input.conversation.id, currentUserMessage.id)
    : false;
  const isRelevant = hasCurrentAttachments || isDocumentFollowup(text);
  const context =
    currentUserMessage && isRelevant
      ? await input.documents.compileAttachmentContext(
          input.conversation.id,
          currentUserMessage.id,
          input.signal,
        )
      : "";
  return {
    context,
    toolIds: resolveDocumentToolIds(text, Boolean(context)),
    visionTurn,
  };
}
