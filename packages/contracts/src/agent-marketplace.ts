import { z } from "zod";

import type { IpcResult } from "./index";

const ipcRequest = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const agentCatalogItemViewSchema = z
  .object({
    catalogId: z.string().min(1).max(128),
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    category: z.string().min(1).max(80),
    icon: z.string().min(1).max(8),
    version: z.string().min(1).max(40),
    installationStatus: z.enum(["installed", "not_installed"]),
    installedAgentId: z.uuid().optional(),
  })
  .strict();

export type AgentCatalogItemView = z.infer<typeof agentCatalogItemViewSchema>;

export const agentCatalogIdInputSchema = z
  .object({ catalogId: z.string().min(1).max(128) })
  .strict();
export const agentUninstallInputSchema = z.object({ agentId: z.uuid() }).strict();

export const agentCatalogListRequestSchema = ipcRequest(z.object({}).strict());
export const agentCatalogInstallRequestSchema = ipcRequest(agentCatalogIdInputSchema);
export const agentCatalogUninstallRequestSchema = ipcRequest(agentUninstallInputSchema);

export interface AgentMarketplaceDesktopApi {
  listCatalog(requestId: string): Promise<IpcResult<AgentCatalogItemView[]>>;
  install(requestId: string, catalogId: string): Promise<IpcResult<AgentCatalogItemView>>;
  uninstall(requestId: string, agentId: string): Promise<IpcResult<{ success: true }>>;
}
