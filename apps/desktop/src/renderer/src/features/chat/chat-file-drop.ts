export async function handleChatFileDrop(input: {
  conversationId: string;
  files: readonly File[];
  attachWorkspace(conversationId: string, file: File): Promise<boolean>;
  importArtifacts(conversationId: string, files: readonly File[]): Promise<void>;
}): Promise<void> {
  if (
    input.files.length === 1 &&
    !input.files[0]!.type &&
    (await input.attachWorkspace(input.conversationId, input.files[0]!))
  ) {
    return;
  }
  await input.importArtifacts(input.conversationId, input.files);
}

export function hasDroppedFiles(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes("Files");
}
