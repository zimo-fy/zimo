import {
  AppError,
  isDocumentImageFormat,
  type DocumentArtifact,
  type DocumentImageFormat,
  type ModelGatewayImagePart,
  type ModelGatewayMessage,
} from "@zimo/domain";

export const MODEL_VISION_UNSUPPORTED_MESSAGE = "此模型不支持图像输入。请尝试其他模型";

export function visionUnsupportedError(): AppError {
  return new AppError({
    code: "MODEL_VISION_UNSUPPORTED",
    category: "user",
    userMessage: MODEL_VISION_UNSUPPORTED_MESSAGE,
  });
}

export function requireVisionCapability(hasImages: boolean, vision: boolean): void {
  if (hasImages && !vision) throw visionUnsupportedError();
}

export function imageDataUrl(format: DocumentImageFormat, bytes: Uint8Array): string {
  const mediaType =
    format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
  return `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function compileImageParts(
  artifacts: readonly DocumentArtifact[],
  readBytes: (artifact: DocumentArtifact) => Promise<Uint8Array>,
  signal: AbortSignal,
): Promise<readonly ModelGatewayImagePart[]> {
  const parts: ModelGatewayImagePart[] = [];
  for (const artifact of artifacts) {
    if (signal.aborted) {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }
    if (!isDocumentImageFormat(artifact.format)) continue;
    parts.push({
      type: "image_url",
      image_url: { url: imageDataUrl(artifact.format, await readBytes(artifact)) },
    });
  }
  return parts;
}

export async function inspectConversationImageTurn(input: {
  conversation: Readonly<{
    id: string;
    messages: readonly Readonly<{ id: string; role: string; content: string }>[];
  }>;
  listMessageImages(conversationId: string, messageId: string): Promise<readonly unknown[]>;
  vision: boolean;
}): Promise<{
  currentUserMessage: Readonly<{ id: string; content: string }> | undefined;
  hasImages: boolean;
}> {
  const currentUserMessage = [...input.conversation.messages]
    .reverse()
    .find((message) => message.role === "user");
  const hasImages = currentUserMessage
    ? (await input.listMessageImages(input.conversation.id, currentUserMessage.id)).length > 0
    : false;
  requireVisionCapability(hasImages, input.vision);
  return { ...(currentUserMessage ? { currentUserMessage } : {}), hasImages };
}

export async function attachCurrentTurnImages(
  messages: readonly ModelGatewayMessage[],
  turn: Readonly<{
    currentUserMessage?: Readonly<{ id: string }>;
    hasImages: boolean;
  }>,
  compileParts: (messageId: string) => Promise<readonly ModelGatewayImagePart[]>,
): Promise<ModelGatewayMessage[]> {
  if (!turn.currentUserMessage || !turn.hasImages) return [...messages];
  return applyImagePartsToCurrentUserMessage(
    messages,
    await compileParts(turn.currentUserMessage.id),
  );
}

export function applyImagePartsToCurrentUserMessage(
  messages: readonly ModelGatewayMessage[],
  parts: readonly ModelGatewayImagePart[],
): ModelGatewayMessage[] {
  if (parts.length === 0) return [...messages];
  let lastUser = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      lastUser = index;
      break;
    }
  }
  if (lastUser < 0) return [...messages];
  return messages.map((message, index) => {
    if (index !== lastUser || typeof message.content !== "string") return message;
    const text = message.content;
    return {
      role: "user",
      content: [...(text ? [{ type: "text" as const, text }] : []), ...parts],
    };
  });
}
