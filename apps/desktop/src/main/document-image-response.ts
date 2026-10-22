import type { DocumentArtifactService } from "@zimo/application";
import { parseDocumentImageDisplayUrl } from "@zimo/contracts";

export async function serveDocumentImage(
  url: string,
  documents: Pick<DocumentArtifactService, "readDisplayImage">,
): Promise<Response> {
  const ids = parseDocumentImageDisplayUrl(url);
  if (!ids) return notFound();
  try {
    const image = await documents.readDisplayImage(
      ids.conversationId,
      ids.artifactId,
      ids.revisionId,
    );
    return new Response(Buffer.from(image.bytes), {
      headers: {
        "content-type": image.mediaType,
        "cache-control": "private, max-age=60",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}
