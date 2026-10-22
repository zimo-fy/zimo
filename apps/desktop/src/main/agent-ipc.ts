import type { AgentMarketplaceService } from "@zimo/application";
import {
  agentCatalogInstallRequestSchema,
  agentCatalogItemViewSchema,
  agentCatalogListRequestSchema,
  agentCatalogUninstallRequestSchema,
  IPC_CHANNELS,
  successViewSchema,
} from "@zimo/contracts";
import type { AgentCatalogItem } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerAgentIpcHandlers(
  register: RegisterIpcHandler,
  options: {
    marketplace: AgentMarketplaceService;
    logger: StructuredLogger | null;
  },
): void {
  register({
    channel: IPC_CHANNELS.agentCatalogList,
    input: agentCatalogListRequestSchema,
    output: agentCatalogItemViewSchema.array(),
    handle: async () => (await options.marketplace.list()).map(toCatalogView),
  });
  register({
    channel: IPC_CHANNELS.agentCatalogInstall,
    input: agentCatalogInstallRequestSchema,
    output: agentCatalogItemViewSchema,
    handle: async ({ payload }) => {
      const installed = await options.marketplace.install(payload.catalogId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "agent.install.marketplace",
        message: "Marketplace Agent installed",
        context: {
          catalogId: installed.catalogId,
          agentId: installed.installedAgentId,
          outcome: "success",
        },
      });
      return toCatalogView(installed);
    },
  });
  register({
    channel: IPC_CHANNELS.agentCatalogUninstall,
    input: agentCatalogUninstallRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.marketplace.uninstall(payload.agentId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "agent.uninstall",
        message: "Marketplace Agent uninstalled",
        context: { agentId: payload.agentId, outcome: "success" },
      });
      return { success: true as const };
    },
  });
}

function toCatalogView(item: AgentCatalogItem) {
  return {
    catalogId: item.catalogId,
    name: item.name,
    description: item.description,
    category: item.category,
    icon: item.icon,
    version: item.version,
    installationStatus: item.installationStatus,
    ...(item.installedAgentId ? { installedAgentId: item.installedAgentId } : {}),
  };
}
