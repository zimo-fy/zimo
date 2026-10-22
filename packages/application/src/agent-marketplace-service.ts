import {
  AppError,
  type AgentCatalogGateway,
  type AgentCatalogItem,
  type AgentRepository,
  type Clock,
  type IdGenerator,
  type PrototypeDefinition,
  type PrototypeId,
  type RemoteAgentCatalogEntry,
} from "@zimo/domain";

const LIST_TIMEOUT_MS = 20_000;
const INSTALL_TIMEOUT_MS = 30_000;
const UNINSTALL_TIMEOUT_MS = 20_000;

export class AgentMarketplaceService {
  private readonly activeOperations = new Set<AbortController>();
  private readonly installing = new Set<string>();

  constructor(
    private readonly gateway: AgentCatalogGateway,
    private readonly agents: AgentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async list(signal?: AbortSignal): Promise<readonly AgentCatalogItem[]> {
    const remote = await this.runWithTimeout(
      (signal) => this.gateway.list(signal),
      LIST_TIMEOUT_MS,
      "AGENT_CATALOG_TIMEOUT",
      "获取 Agent 目录超时，请稍后重试。",
      signal,
    );
    const installedByCatalogId = new Map(
      (await this.agents.list()).flatMap((agent) =>
        agent.agentCatalogId ? [[agent.agentCatalogId, agent] as const] : [],
      ),
    );
    return remote
      .map((entry) => toCatalogItem(entry, installedByCatalogId.get(entry.catalogId)?.id))
      .sort((left, right) => {
        if (left.installationStatus !== right.installationStatus) {
          return left.installationStatus === "installed" ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "zh-CN");
      });
  }

  async install(catalogId: string): Promise<AgentCatalogItem> {
    if (this.installing.has(catalogId)) {
      throw marketplaceError("AGENT_INSTALL_IN_PROGRESS", "该 Agent 正在安装中。");
    }
    this.installing.add(catalogId);
    let remoteAgentId: string | undefined;
    try {
      if ((await this.agents.list()).some((agent) => agent.agentCatalogId === catalogId)) {
        throw marketplaceError("AGENT_ALREADY_INSTALLED", "该 Agent 已经安装。");
      }
      const localAgentId = this.ids.create() as PrototypeId;
      const entry = await this.runWithTimeout(
        async (signal) => {
          const match = (await this.gateway.list(signal)).find(
            (candidate) => candidate.catalogId === catalogId,
          );
          if (!match) throw marketplaceError("AGENT_CATALOG_ITEM_NOT_FOUND", "没有找到该 Agent。");
          const provisioned = await this.gateway.provision(match, localAgentId, signal);
          remoteAgentId = provisioned.remoteAgentId;
          await this.agents.save(
            createInstalledAgent(match, provisioned, localAgentId, this.clock.now()),
          );
          return match;
        },
        INSTALL_TIMEOUT_MS,
        "AGENT_INSTALL_TIMEOUT",
        "Agent 安装超时，请稍后重试。",
      );
      return toCatalogItem(entry, localAgentId);
    } catch (cause) {
      if (remoteAgentId) {
        await this.gateway
          .uninstall(remoteAgentId, AbortSignal.timeout(5_000))
          .catch(() => undefined);
      }
      throw cause;
    } finally {
      this.installing.delete(catalogId);
    }
  }

  async uninstall(agentId: string): Promise<void> {
    const agent = await this.agents.getById(agentId as PrototypeId);
    if (!agent?.agentCatalogId || !agent.agentRemoteId) {
      throw marketplaceError("AGENT_NOT_MARKETPLACE_INSTALL", "该 Agent 不是从人才库安装的。");
    }
    const remoteAgentId = agent.agentRemoteId;
    await this.runWithTimeout(
      (signal) => this.gateway.uninstall(remoteAgentId, signal),
      UNINSTALL_TIMEOUT_MS,
      "AGENT_UNINSTALL_TIMEOUT",
      "Agent 卸载超时，请稍后重试。",
    );
    await this.agents.delete(agent.id);
  }

  cancelAll(): void {
    for (const controller of this.activeOperations) controller.abort();
  }

  private async runWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    timeoutCode: string,
    timeoutMessage: string,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener("abort", abortFromParent, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    this.activeOperations.add(controller);
    try {
      return await operation(controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) throw cause;
      throw new AppError({
        code: timedOut ? timeoutCode : "AGENT_OPERATION_CANCELLED",
        category: timedOut ? "network" : "user",
        userMessage: timedOut ? timeoutMessage : "Agent 操作已取消。",
        retryable: timedOut,
        cause,
      });
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromParent);
      this.activeOperations.delete(controller);
    }
  }
}

function createInstalledAgent(
  entry: RemoteAgentCatalogEntry,
  provisioned: Awaited<ReturnType<AgentCatalogGateway["provision"]>>,
  id: PrototypeId,
  now: Date,
): PrototypeDefinition {
  return {
    id,
    kind: "agent",
    name: entry.name,
    description: entry.description,
    status: "enabled",
    category: entry.category,
    tags: [],
    icon: entry.icon,
    version: entry.version,
    source: "Zimo Agent Store",
    systemPrompt: provisioned.systemPrompt,
    agentCatalogId: entry.catalogId,
    agentRemoteId: provisioned.remoteAgentId,
    permissions: ["context:user-input", "context:conversation"],
    capabilities: ["云端角色定义"],
    associations: [],
    installationStatus: "installed",
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: now,
    updatedAt: now,
  };
}

function toCatalogItem(
  entry: RemoteAgentCatalogEntry,
  installedAgentId?: string,
): AgentCatalogItem {
  return {
    catalogId: entry.catalogId,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    icon: entry.icon,
    version: entry.version,
    installationStatus: installedAgentId ? "installed" : "not_installed",
    ...(installedAgentId ? { installedAgentId } : {}),
  };
}

function marketplaceError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "configuration", userMessage });
}
