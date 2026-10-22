import { protocol } from "electron";
import type { DocumentArtifactService } from "@zimo/application";

import { serveDocumentImage } from "./document-image-response";

export const DOCUMENT_IMAGE_SCHEME = "zimo-doc";

export function documentImageProtocolPrivileges() {
  return {
    scheme: DOCUMENT_IMAGE_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      stream: true,
    },
  };
}

export function registerDocumentImageProtocol(documents: DocumentArtifactService): void {
  protocol.handle(DOCUMENT_IMAGE_SCHEME, (request) => serveDocumentImage(request.url, documents));
}
