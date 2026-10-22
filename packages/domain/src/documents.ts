export const DOCUMENT_EDITABLE_FORMATS = ["docx", "xlsx", "pptx", "pdf"] as const;
export const DOCUMENT_IMPORT_FORMATS = [
  ...DOCUMENT_EDITABLE_FORMATS,
  "txt",
  "md",
  "html",
  "json",
  "csv",
  "rtf",
  "odt",
  "ods",
  "odp",
  "epub",
  "png",
  "jpeg",
  "webp",
] as const;
export const DOCUMENT_IMAGE_FORMATS = ["png", "jpeg", "webp"] as const;
export const DOCUMENT_IMPORT_EXTENSIONS = [
  "docx",
  "xlsx",
  "pptx",
  "pdf",
  "txt",
  "md",
  "markdown",
  "html",
  "htm",
  "json",
  "csv",
  "rtf",
  "odt",
  "ods",
  "odp",
  "epub",
  "png",
  "jpg",
  "jpeg",
  "webp",
] as const;
export type DocumentEditableFormat = (typeof DOCUMENT_EDITABLE_FORMATS)[number];
export type DocumentFormat = (typeof DOCUMENT_IMPORT_FORMATS)[number];
export type DocumentImageFormat = (typeof DOCUMENT_IMAGE_FORMATS)[number];

export function isDocumentEditableFormat(value: string): value is DocumentEditableFormat {
  return (DOCUMENT_EDITABLE_FORMATS as readonly string[]).includes(value);
}

export function isDocumentImportFormat(value: string): value is DocumentFormat {
  return (DOCUMENT_IMPORT_FORMATS as readonly string[]).includes(value);
}

export function isDocumentImageFormat(value: string): value is DocumentImageFormat {
  return (DOCUMENT_IMAGE_FORMATS as readonly string[]).includes(value);
}

export type DocumentArtifactStatus = "ready" | "failed";
export type DocumentMessageRelation = "input" | "output";
export type DocumentRevisionCreator = "user_import" | "model_create" | "model_patch" | "conversion";

export interface DocumentArtifact {
  id: string;
  conversationId: string;
  displayName: string;
  mediaType: string;
  format: DocumentFormat;
  sizeBytes: number;
  status: DocumentArtifactStatus;
  currentRevisionId: string;
  messageId?: string;
  messageRevisionId?: string;
  messageRevisionSizeBytes?: number;
  messageRelation?: DocumentMessageRelation;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentRevision {
  id: string;
  artifactId: string;
  parentRevisionId?: string;
  storageKey: string;
  checksum: string;
  sizeBytes: number;
  createdBy: DocumentRevisionCreator;
  createdAt: Date;
}

export interface DocumentArtifactWithRevision {
  artifact: DocumentArtifact;
  revision: DocumentRevision;
}

export interface DocumentArtifactRepository {
  create(value: DocumentArtifactWithRevision): Promise<void>;
  getById(id: string): Promise<DocumentArtifactWithRevision | null>;
  listByConversation(conversationId: string): Promise<readonly DocumentArtifact[]>;
  listRevisionsByConversation(conversationId: string): Promise<readonly DocumentRevision[]>;
  getRevision(artifactId: string, revisionId: string): Promise<DocumentRevision | null>;
  addRevision(value: DocumentArtifactWithRevision, expectedRevisionId: string): Promise<void>;
  addRevisionAndBindOutput(
    value: DocumentArtifactWithRevision,
    expectedRevisionId: string,
    conversationId: string,
    createdAt: Date,
  ): Promise<void>;
  bindOutputToActiveAssistant(
    conversationId: string,
    artifactId: string,
    revisionId: string,
    createdAt: Date,
  ): Promise<void>;
  deleteDraft(conversationId: string, artifactId: string): Promise<boolean>;
  deleteByConversation(conversationId: string): Promise<void>;
}

export interface ImportedDocumentFile {
  displayName: string;
  mediaType: string;
  format: DocumentFormat;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
}

export interface DocumentFileStore {
  importFile(input: {
    sourcePath: string;
    conversationId: string;
    artifactId: string;
    revisionId: string;
  }): Promise<ImportedDocumentFile>;
  exportFile(storageKey: string, destinationPath: string): Promise<void>;
  removeFile(storageKey: string): Promise<void>;
  readFile(storageKey: string): Promise<Uint8Array>;
  writeFile(input: {
    bytes: Uint8Array;
    conversationId: string;
    artifactId: string;
    revisionId: string;
    format: DocumentFormat;
  }): Promise<ImportedDocumentFile>;
}

export interface DocumentSelector {
  pageNumbers?: readonly number[];
  slideNumbers?: readonly number[];
  sheetName?: string;
  cursor?: number;
  maxCharacters?: number;
}

export interface DocumentDigest {
  artifactId: string;
  revisionId: string;
  format: DocumentFormat;
  displayName: string;
  unitCount: number;
  units: readonly string[];
  preview: string;
  truncated: boolean;
}

export interface DocumentSlice {
  artifactId: string;
  revisionId: string;
  content: string;
  nextCursor?: number;
  truncated: boolean;
}

export type DocumentCreateContent = Readonly<{
  title: string;
  paragraphs?: readonly string[];
  rows?: readonly (readonly (string | number | boolean)[])[];
  slides?: readonly Readonly<{ title: string; body?: string }>[];
}>;

export type DocumentPatchOperation =
  | Readonly<{ type: "replace_text"; search: string; replacement: string }>
  | Readonly<{ type: "append_text"; text: string }>
  | Readonly<{
      type: "set_cells";
      sheetName: string;
      startCell: string;
      rows: readonly (readonly (string | number | boolean)[])[];
    }>
  | Readonly<{ type: "watermark"; text: string }>
  | Readonly<{ type: "reorder_pages"; pageNumbers: readonly number[] }>
  | Readonly<{ type: "add_page_numbers" }>
  | Readonly<{ type: "fill_form"; fields: Readonly<Record<string, string>> }>
  | Readonly<{ type: "overlay_text"; pageNumber: number; text: string; x: number; y: number }>;

export interface DocumentContentAdapter {
  inspect(
    bytes: Uint8Array,
    artifact: DocumentArtifact,
    signal: AbortSignal,
  ): Promise<DocumentDigest>;
  read(
    bytes: Uint8Array,
    artifact: DocumentArtifact,
    selector: DocumentSelector,
    signal: AbortSignal,
  ): Promise<DocumentSlice>;
  create(
    format: DocumentFormat,
    content: DocumentCreateContent,
    signal: AbortSignal,
  ): Promise<Uint8Array>;
  patch(
    bytes: Uint8Array,
    artifact: DocumentArtifact,
    operations: readonly DocumentPatchOperation[],
    signal: AbortSignal,
  ): Promise<Uint8Array>;
  convert(
    bytes: Uint8Array,
    artifact: DocumentArtifact,
    targetFormat: DocumentFormat,
    signal: AbortSignal,
  ): Promise<Uint8Array>;
}
