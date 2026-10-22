export interface RemoteAgentCatalogEntry {
  catalogId: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  instructionsUrl?: string | undefined;
}

export interface ProvisionedAgentDefinition {
  remoteAgentId: string;
  systemPrompt: string;
}

export interface AgentCatalogGateway {
  list(signal: AbortSignal): Promise<readonly RemoteAgentCatalogEntry[]>;
  provision(
    entry: RemoteAgentCatalogEntry,
    localAgentId: string,
    signal: AbortSignal,
  ): Promise<ProvisionedAgentDefinition>;
  uninstall(remoteAgentId: string, signal: AbortSignal): Promise<void>;
}

export interface AgentCatalogItem {
  catalogId: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  installationStatus: "installed" | "not_installed";
  installedAgentId?: string | undefined;
}
