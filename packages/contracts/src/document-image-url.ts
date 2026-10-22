export const DOCUMENT_IMAGE_PROTOCOL = "zimo-doc";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function documentImageDisplayUrl(input: {
  conversationId: string;
  artifactId: string;
  revisionId: string;
}): string {
  return `${DOCUMENT_IMAGE_PROTOCOL}://v1/${input.conversationId}/${input.artifactId}/${input.revisionId}`;
}

export function parseDocumentImageDisplayUrl(value: string): {
  conversationId: string;
  artifactId: string;
  revisionId: string;
} | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== `${DOCUMENT_IMAGE_PROTOCOL}:`) return null;
  if (url.hostname !== "v1" || url.search || url.hash || url.username || url.password) return null;
  const parts = url.pathname.replace(/^\/+/u, "").split("/");
  if (parts.length !== 3 || parts.some((part) => !UUID.test(part))) return null;
  const [conversationId, artifactId, revisionId] = parts;
  if (!conversationId || !artifactId || !revisionId) return null;
  return { conversationId, artifactId, revisionId };
}
