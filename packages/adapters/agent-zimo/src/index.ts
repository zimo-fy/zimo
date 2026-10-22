import {
  AppError,
  type AgentCatalogGateway,
  type ProvisionedAgentDefinition,
  type RemoteAgentCatalogEntry,
  type SecretStore,
  type SessionStore,
} from "@zimo/domain";

export { LocalAgentCatalogGateway } from "./local-agent-catalog-gateway";

export class ZimoAgentCatalogGateway implements AgentCatalogGateway {
  constructor(
    _baseUrl: string,
    _sessions: SessionStore,
    _secrets: SecretStore,
    _fetchImpl: typeof fetch = fetch,
  ) {}

  list(_signal: AbortSignal): Promise<readonly RemoteAgentCatalogEntry[]> {
    return Promise.reject(catalogDisabled());
  }

  provision(
    _entry: RemoteAgentCatalogEntry,
    _localAgentId: string,
    _signal: AbortSignal,
  ): Promise<ProvisionedAgentDefinition> {
    return Promise.reject(catalogDisabled());
  }

  uninstall(_remoteAgentId: string, _signal: AbortSignal): Promise<void> {
    return Promise.reject(catalogDisabled());
  }
}

function catalogDisabled(): AppError {
  return new AppError({
    code: "AGENT_CATALOG_DISABLED",
    category: "configuration",
    userMessage: "Agent 目录不从云端接口加载。",
  });
}
