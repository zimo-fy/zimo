import type {
  DocumentArtifact,
  DocumentContentAdapter,
  DocumentCreateContent,
  DocumentFormat,
  DocumentPatchOperation,
  DocumentSelector,
} from "@zimo/domain";

import { inspectDocument, readDocument } from "./document-content-reader";
import {
  convertDocumentBytes,
  createDocumentBytes,
  patchDocumentOperationsBytes,
  type PdfDocumentRenderer,
} from "./document-content-writer";

export class LocalDocumentContentAdapter implements DocumentContentAdapter {
  constructor(private readonly pdfRenderer?: PdfDocumentRenderer) {}

  inspect(bytes: Uint8Array, artifact: DocumentArtifact, signal: AbortSignal) {
    return inspectDocument(bytes, artifact, signal);
  }

  read(
    bytes: Uint8Array,
    artifact: DocumentArtifact,
    selector: DocumentSelector,
    signal: AbortSignal,
  ) {
    return readDocument(bytes, artifact, selector, signal);
  }

  create(format: DocumentFormat, content: DocumentCreateContent, signal: AbortSignal) {
    return createDocumentBytes(format, content, signal, this.pdfRenderer);
  }

  patch(
    bytes: Uint8Array,
    artifact: DocumentArtifact,
    operations: readonly DocumentPatchOperation[],
    signal: AbortSignal,
  ) {
    return patchDocumentOperationsBytes(bytes, artifact, operations, signal);
  }

  convert(
    bytes: Uint8Array,
    artifact: DocumentArtifact,
    targetFormat: DocumentFormat,
    signal: AbortSignal,
  ) {
    return convertDocumentBytes(bytes, artifact, targetFormat, signal, this.pdfRenderer);
  }
}
