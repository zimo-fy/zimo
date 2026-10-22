import { z } from "zod";

import type { IpcResult, PrototypeDetailView } from "./index";

const ipcRequest = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const skillCatalogItemViewSchema = z
  .object({
    catalogId: z.string().min(1).max(128),
    packageId: z.string().min(3).max(80),
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    category: z.string().min(1).max(80),
    version: z.string().min(1).max(40),
    source: z.string().min(1).max(80),
    installationStatus: z.enum(["installed", "not_installed"]),
    installedSkillId: z.uuid().optional(),
  })
  .strict();

export type SkillCatalogItemView = z.infer<typeof skillCatalogItemViewSchema>;

export const skillCatalogIdInputSchema = z
  .object({ catalogId: z.string().min(1).max(128) })
  .strict();

export const skillUninstallInputSchema = z.object({ skillId: z.uuid() }).strict();

export const skillCatalogListRequestSchema = ipcRequest(z.object({}).strict());
export const skillCatalogInstallRequestSchema = ipcRequest(skillCatalogIdInputSchema);
export const skillCatalogUninstallRequestSchema = ipcRequest(skillUninstallInputSchema);

export interface SkillMarketplaceDesktopApi {
  listCatalog(requestId: string): Promise<IpcResult<SkillCatalogItemView[]>>;
  install(requestId: string, catalogId: string): Promise<IpcResult<SkillCatalogItemView>>;
  uninstall(requestId: string, skillId: string): Promise<IpcResult<{ success: true }>>;
  installLocal(requestId: string): Promise<IpcResult<PrototypeDetailView | null>>;
}
