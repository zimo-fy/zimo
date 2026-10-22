import { describe, expect, it, vi } from "vitest";

import type {
  AgentCatalogGateway,
  AgentRepository,
  PrototypeDefinition,
  PrototypeId,
  RemoteAgentCatalogEntry,
} from "@zimo/domain";

import { AgentMarketplaceService } from "./agent-marketplace-service";

const remote: RemoteAgentCatalogEntry = {
  catalogId: "remote-17",
  name: "招聘专家",
  description: "筛选候选人",
  category: "人力资源",
  icon: "招",
  version: "2.3.0",
};

describe("AgentMarketplaceService", () => {
  it("installs a cloud catalog entry as an enabled local Agent", async () => {
    const repository = new MemoryAgentRepository();
    const gateway: AgentCatalogGateway = {
      list: async () => [remote],
      provision: async () => ({
        remoteAgentId: "cloud-installation-17",
        systemPrompt: "只根据候选人材料完成招聘分析。",
      }),
      uninstall: vi.fn(async () => undefined),
    };
    const service = createService(repository, gateway);

    expect((await service.list())[0]?.installationStatus).toBe("not_installed");
    const installed = await service.install(remote.catalogId);

    expect(installed).toMatchObject({
      installationStatus: "installed",
      installedAgentId: "00000000-0000-4000-8000-000000000777",
      version: "2.3.0",
    });
    expect((await repository.list())[0]).toMatchObject({
      status: "enabled",
      agentCatalogId: "remote-17",
      agentRemoteId: "cloud-installation-17",
      systemPrompt: "只根据候选人材料完成招聘分析。",
      version: "2.3.0",
    });
  });

  it("uses the remote installation id when uninstalling", async () => {
    const repository = new MemoryAgentRepository();
    const gateway: AgentCatalogGateway = {
      list: async () => [],
      provision: vi.fn(),
      uninstall: vi.fn(async () => undefined),
    };
    await repository.save(installedDefinition());
    const service = createService(repository, gateway);

    await service.uninstall("00000000-0000-4000-8000-000000000777");

    expect(gateway.uninstall).toHaveBeenCalledWith(
      "cloud-installation-17",
      expect.any(AbortSignal),
    );
    expect(await repository.list()).toEqual([]);
  });

  it("compensates the remote install when local persistence fails", async () => {
    const repository = new MemoryAgentRepository();
    repository.rejectSave = true;
    const gateway: AgentCatalogGateway = {
      list: async () => [remote],
      provision: async () => ({
        remoteAgentId: "cloud-installation-17",
        systemPrompt: "角色定义",
      }),
      uninstall: vi.fn(async () => undefined),
    };
    const service = createService(repository, gateway);

    await expect(service.install(remote.catalogId)).rejects.toThrow("save failed");
    expect(gateway.uninstall).toHaveBeenCalledWith(
      "cloud-installation-17",
      expect.any(AbortSignal),
    );
  });

  it("rejects concurrent installs for the same catalog entry", async () => {
    const repository = new MemoryAgentRepository();
    let releaseProvision: (() => void) | undefined;
    const provisionGate = new Promise<void>((resolve) => {
      releaseProvision = resolve;
    });
    const gateway: AgentCatalogGateway = {
      list: async () => [remote],
      provision: async () => {
        await provisionGate;
        return { remoteAgentId: "cloud-installation-17", systemPrompt: "角色定义" };
      },
      uninstall: vi.fn(async () => undefined),
    };
    const service = createService(repository, gateway);

    const first = service.install(remote.catalogId);
    await expect(service.install(remote.catalogId)).rejects.toMatchObject({
      code: "AGENT_INSTALL_IN_PROGRESS",
    });
    releaseProvision?.();
    await expect(first).resolves.toMatchObject({ installationStatus: "installed" });
  });
});

function createService(repository: MemoryAgentRepository, gateway: AgentCatalogGateway) {
  return new AgentMarketplaceService(
    gateway,
    repository,
    { now: () => new Date("2026-09-08T00:00:00.000Z") },
    { create: () => "00000000-0000-4000-8000-000000000777" },
  );
}

function installedDefinition(): PrototypeDefinition {
  const now = new Date("2026-09-08T00:00:00.000Z");
  return {
    id: "00000000-0000-4000-8000-000000000777" as PrototypeId,
    kind: "agent",
    name: remote.name,
    description: remote.description,
    status: "enabled",
    category: remote.category,
    tags: [],
    icon: remote.icon,
    version: "2.3.0",
    source: "Zimo Agent Store",
    systemPrompt: "角色定义",
    agentCatalogId: remote.catalogId,
    agentRemoteId: "cloud-installation-17",
    permissions: [],
    capabilities: [],
    associations: [],
    installationStatus: "installed",
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: now,
    updatedAt: now,
  };
}

class MemoryAgentRepository implements AgentRepository {
  readonly kind = "agent" as const;
  readonly values = new Map<PrototypeId, PrototypeDefinition>();
  rejectSave = false;

  async list() {
    return [...this.values.values()];
  }

  async getById(id: PrototypeId) {
    return this.values.get(id) ?? null;
  }

  async save(value: PrototypeDefinition) {
    if (this.rejectSave) throw new Error("save failed");
    this.values.set(value.id, value);
  }

  async delete(id: PrototypeId) {
    this.values.delete(id);
  }
}
