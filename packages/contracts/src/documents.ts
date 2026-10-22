import { z } from "zod";

import type { IpcResult } from "./index";

export const documentFormatSchema = z.enum([
  "docx",
  "xlsx",
  "pptx",
  "pdf",
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
]);

export const documentArtifactViewSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    messageId: z.uuid().optional(),
    displayName: z.string().min(1).max(180),
    mediaType: z.string().min(1).max(160),
    format: documentFormatSchema,
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024),
    status: z.enum(["ready", "failed"]),
    currentRevisionId: z.uuid(),
    revisionId: z.uuid(),
    relation: z.enum(["input", "output"]).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type DocumentArtifactView = z.infer<typeof documentArtifactViewSchema>;

export const documentImportResultViewSchema = z
  .object({
    imported: z.array(documentArtifactViewSchema).max(10),
    rejected: z
      .array(
        z
          .object({
            index: z.number().int().min(0).max(9),
            code: z.string().min(1).max(80),
            message: z.string().min(1).max(300),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();
export type DocumentImportResultView = z.infer<typeof documentImportResultViewSchema>;

export const documentDigestViewSchema = z
  .object({
    artifactId: z.uuid(),
    revisionId: z.uuid(),
    format: documentFormatSchema,
    displayName: z.string().min(1).max(180),
    unitCount: z.number().int().min(0).max(200_000),
    units: z.array(z.string().max(200)).max(80),
    preview: z.string().max(2_000),
    truncated: z.boolean(),
  })
  .strict();
export type DocumentDigestView = z.infer<typeof documentDigestViewSchema>;

export const documentSliceViewSchema = z
  .object({
    artifactId: z.uuid(),
    revisionId: z.uuid(),
    content: z.string().max(12_000),
    nextCursor: z.number().int().min(0).max(1_000_000).optional(),
    truncated: z.boolean(),
  })
  .strict();
export type DocumentSliceView = z.infer<typeof documentSliceViewSchema>;

const request = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();
const conversationId = z.object({ conversationId: z.uuid() }).strict();
const artifactId = z.object({ conversationId: z.uuid(), artifactId: z.uuid() }).strict();
const artifactRevision = artifactId.extend({ revisionId: z.uuid() }).strict();

export const documentListRequestSchema = request(conversationId);
export const documentImportSelectedRequestSchema = request(conversationId);
export const documentImportDroppedRequestSchema = request(
  z
    .object({
      conversationId: z.uuid(),
      sourcePaths: z.array(z.string().min(1).max(4_096)).min(1).max(10),
    })
    .strict(),
);
export const documentRemoveDraftRequestSchema = request(artifactId);
export const documentExportRequestSchema = request(artifactRevision);
export const documentExportResultSchema = z.object({ exported: z.boolean() }).strict();
export const documentInspectRequestSchema = request(artifactRevision);
export const documentReadRequestSchema = request(
  artifactId
    .extend({
      pageNumbers: z.array(z.number().int().positive()).max(100).optional(),
      slideNumbers: z.array(z.number().int().positive()).max(100).optional(),
      sheetName: z.string().min(1).max(120).optional(),
      cursor: z.number().int().min(0).max(1_000_000).optional(),
      maxCharacters: z.number().int().min(200).max(12_000).optional(),
    })
    .strict(),
);

export interface DocumentArtifactsDesktopApi {
  list(requestId: string, conversationId: string): Promise<IpcResult<DocumentArtifactView[]>>;
  select(
    requestId: string,
    conversationId: string,
  ): Promise<IpcResult<DocumentImportResultView | null>>;
  importDropped(
    requestId: string,
    conversationId: string,
    files: readonly unknown[],
  ): Promise<IpcResult<DocumentImportResultView>>;
  removeDraft(
    requestId: string,
    conversationId: string,
    artifactId: string,
  ): Promise<IpcResult<{ success: true }>>;
  export(
    requestId: string,
    conversationId: string,
    artifactId: string,
    revisionId: string,
  ): Promise<IpcResult<{ exported: boolean }>>;
  inspect(
    requestId: string,
    conversationId: string,
    artifactId: string,
    revisionId: string,
  ): Promise<IpcResult<DocumentDigestView>>;
  read(
    requestId: string,
    conversationId: string,
    artifactId: string,
    selector?: {
      pageNumbers?: readonly number[];
      slideNumbers?: readonly number[];
      sheetName?: string;
      cursor?: number;
      maxCharacters?: number;
    },
  ): Promise<IpcResult<DocumentSliceView>>;
}
