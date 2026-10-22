import { describe, expect, it, vi } from "vitest";

import type {
  PrototypeDefinition,
  PrototypeId,
  RemoteSkillCatalogEntry,
  SkillCatalogGateway,
  SkillRepository,
} from "@zimo/domain";

import { InstructionSkillInstallationService } from "./instruction-skill-installation-service";
import type { PrototypeCatalogService } from "./prototype-catalog-service";
import { SkillMarketplaceService } from "./skill-marketplace-service";

const remote: RemoteSkillCatalogEntry = {
  catalogId: "remote-1",
  packageId: "zimo.market.remote-1",
  name: "招聘助手",
  description: "筛选候选人",
  category: "人力资源",
  version: "1.0.0",
  source: "Zimo Skill Store",
  downloadUrl: "https://files.example.com/recruiting.zip",
};

describe("SkillMarketplaceService", () => {
  it("merges cloud entries with installed skills and installs instruction packages", async () => {
    const repository = new MemorySkillRepository();
    const gateway: SkillCatalogGateway = {
      list: async () => [remote],
      download: async (entry) => ({
        packageId: entry.packageId,
        name: entry.name,
        version: entry.version,
        description: entry.description,
        category: entry.category,
        tags: [],
        permissions: ["context:user-input"],
        instructions: "只根据用户输入筛选候选人。",
        checksum: "checksum",
        files: [],
      }),
    };
    const service = createService(repository, gateway);

    expect((await service.list())[0]?.installationStatus).toBe("not_installed");
    const installed = await service.install(remote.catalogId);

    expect(installed.installationStatus).toBe("installed");
    expect((await repository.list())[0]).toMatchObject({
      status: "enabled",
      installationStatus: "installed",
      source: "Zimo Skill Store",
    });
  });

  it.each([
    ["boss-zhipin", "zimo.boss-zhipin"],
    ["liepin-hr", "zimo.liepin-hr"],
    ["recruitment-hub", "zimo.recruitment-hub"],
    ["yupao", "zimo.yupao"],
  ] as const)(
    "blocks %s store install with an official contact message",
    async (catalogId, packageId) => {
      const entry: RemoteSkillCatalogEntry = { ...remote, catalogId, packageId };
      const gateway: SkillCatalogGateway = {
        list: async () => [entry],
        download: vi.fn(),
      };
      const service = createService(new MemorySkillRepository(), gateway);

      await expect(service.install(catalogId)).rejects.toMatchObject({
        code: "SKILL_INSTALL_RESTRICTED",
        userMessage: "请联系zimo官方获取完整技能",
      });
      expect(gateway.download).not.toHaveBeenCalled();
    },
  );

  it("delegates uninstall reference protection to the prototype catalog", async () => {
    const repository = new MemorySkillRepository();
    const gateway: SkillCatalogGateway = { list: async () => [], download: vi.fn() };
    const prototypes = { mutate: vi.fn(async () => skillDefinition()) };
    await repository.save(skillDefinition());
    const service = createService(repository, gateway, prototypes);

    await service.uninstall("00000000-0000-4000-8000-000000000777");

    expect(prototypes.mutate).toHaveBeenCalledWith({
      action: "delete",
      kind: "skill",
      id: "00000000-0000-4000-8000-000000000777",
    });
  });
});

function createService(
  repository: MemorySkillRepository,
  gateway: SkillCatalogGateway,
  prototypes: Pick<PrototypeCatalogService, "mutate"> = { mutate: vi.fn() },
) {
  const installation = new InstructionSkillInstallationService(
    repository,
    { now: () => new Date("2026-09-08T00:00:00.000Z") },
    { create: () => "00000000-0000-4000-8000-000000000777" },
  );
  return new SkillMarketplaceService(
    gateway,
    repository,
    installation,
    prototypes as PrototypeCatalogService,
  );
}

function skillDefinition(): PrototypeDefinition {
  const now = new Date("2026-09-08T00:00:00.000Z");
  return {
    id: "00000000-0000-4000-8000-000000000777" as PrototypeId,
    kind: "skill",
    name: "招聘助手",
    description: "筛选候选人",
    status: "enabled",
    category: "人力资源",
    tags: [],
    icon: "招",
    version: "1.0.0",
    source: "Zimo Skill Store",
    skillPackageId: remote.packageId,
    skillInstructions: "只筛选候选人。",
    skillChecksum: "checksum",
    permissions: ["context:user-input"],
    capabilities: ["指令型 Skill"],
    associations: [],
    installationStatus: "installed",
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: now,
    updatedAt: now,
  };
}

class MemorySkillRepository implements SkillRepository {
  readonly kind = "skill" as const;
  private readonly values = new Map<PrototypeId, PrototypeDefinition>();

  async list() {
    return [...this.values.values()];
  }

  async getById(id: PrototypeId) {
    return this.values.get(id) ?? null;
  }

  async save(value: PrototypeDefinition) {
    this.values.set(value.id, value);
  }

  async delete(id: PrototypeId) {
    this.values.delete(id);
  }
}
