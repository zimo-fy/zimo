import { z } from "zod";

export const catalogModelViewSchema = z
  .object({
    catalogId: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
    modelCode: z.string().regex(/^[A-Za-z0-9._:@/-]{1,120}$/),
    displayName: z.string().trim().min(1).max(120),
    providerName: z.string().trim().min(1).max(80),
    supportsReasoning: z.boolean(),
    supportsImages: z.boolean(),
  })
  .strict();

export type CatalogModelView = z.infer<typeof catalogModelViewSchema>;

export const conversationCatalogModelSchema = catalogModelViewSchema.omit({ providerName: true });

export const conversationCatalogModelShape = {
  catalogModel: conversationCatalogModelSchema.optional(),
};

const request = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const selectCatalogModelInputSchema = z
  .object({
    conversationId: z.uuid(),
    catalogId: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
  })
  .strict();

export const selectCatalogModelRequestSchema = request(selectCatalogModelInputSchema);
