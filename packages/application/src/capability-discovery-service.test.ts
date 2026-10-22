import { describe, expect, it, vi } from "vitest";
import type { PrototypeDefinition } from "@zimo/domain";

import { CapabilityDiscoveryService } from "./capability-discovery-service";
import type { PrototypeCatalogService } from "./prototype-catalog-service";
import type { SkillRuntimeService } from "./skill-runtime-service";
import { ControlledToolService, type RegisteredTool } from "./tool-runtime";

describe("CapabilityDiscoveryService", () => {
  it("returns installed skill instructions and prepares its reviewed tools", async () => {
    const skill = prototype({
      kind: "skill",
      name: "小红书文案助手",
      description: "改写小红书文案并降低 AI 味",
      skillInstructions: "先诊断文案，再进行自然化改写。",
      skillChecksum: "checksum",
      installationStatus: "installed",
    });
    const prototypes = catalog({ skill: [skill] });
    const skillRuntime = {
      prepareTools: vi.fn(async () => ["skill.skill-id.run_script"]),
    } as unknown as SkillRuntimeService;
    const service = new CapabilityDiscoveryService(prototypes, toolService([]), skillRuntime);

    const result = await service.search(
      { query: "帮我改写小红书文案", kinds: ["skill"] },
      [],
      new AbortController().signal,
    );

    expect(result.installed).toEqual([
      expect.objectContaining({
        id: "skill-id",
        kind: "skill",
        availability: "ready",
        instructions: "先诊断文案，再进行自然化改写。",
      }),
    ]);
    expect(result.loadedToolIds).toEqual(["skill.skill-id.run_script"]);
    expect(skillRuntime.prepareTools).toHaveBeenCalledWith([skill]);
  });

  it("falls back to installable catalogs only when no local capability matches", async () => {
    const skillMarketplace = {
      list: vi.fn(async () => [
        {
          catalogId: "remote-1",
          packageId: "package-1",
          name: "交通信息查询",
          description: "查询城市公共交通信息",
          category: "效率",
          version: "1.0.0",
          source: "Zimo",
          installationStatus: "not_installed" as const,
        },
      ]),
    };
    const service = new CapabilityDiscoveryService(
      catalog({}),
      toolService([]),
      { prepareTools: vi.fn(async () => []) } as unknown as SkillRuntimeService,
      skillMarketplace,
    );

    const result = await service.search(
      { query: "已知精确能力", kinds: ["skill"], packageIds: ["package-1"] },
      [],
      new AbortController().signal,
    );

    expect(result.installed).toEqual([]);
    expect(result.installable).toEqual([
      expect.objectContaining({
        catalogId: "remote-1",
        kind: "skill",
        action: "open_skill_store",
      }),
    ]);
    expect(skillMarketplace.list).toHaveBeenCalledOnce();
  });

  it("loads platform skills by exact package IDs instead of fuzzy names", async () => {
    const hub = prototype({
      kind: "skill",
      name: "招聘平台统一调度",
      skillPackageId: "zimo.recruitment-hub",
      skillInstructions: "调度平台能力。",
      skillChecksum: "hub-checksum",
      installationStatus: "installed",
    });
    const boss = prototype({
      kind: "skill",
      name: "Boss直聘 HR 自动化助手",
      skillPackageId: "zimo.market.boss",
      skillInstructions: "---\npackageId: zimo.boss-zhipin\n---\n\n执行 Boss 招聘操作。",
      skillChecksum: "boss-checksum",
      installationStatus: "installed",
    });
    const yupao = prototype({
      kind: "skill",
      name: "鱼泡直聘 HR 自动化助手",
      skillPackageId: "zimo.yupao",
      skillInstructions: "执行鱼泡招聘操作。",
      skillChecksum: "yupao-checksum",
      installationStatus: "installed",
    });
    const skillRuntime = {
      prepareTools: vi.fn(async (skills: readonly PrototypeDefinition[]) =>
        skills.map((skill) => `skill.${skill.id}.read_resource`),
      ),
    } as unknown as SkillRuntimeService;
    const service = new CapabilityDiscoveryService(
      catalog({ skill: [hub, boss, yupao] }),
      toolService([]),
      skillRuntime,
    );

    const result = await service.search(
      {
        query: "多平台推荐候选人",
        kinds: ["skill"],
        packageIds: ["zimo.boss-zhipin", "zimo.yupao"],
        requiredActions: ["recommend"],
      },
      [],
      new AbortController().signal,
    );

    expect(result.installed.map((item) => item.packageId).sort()).toEqual([
      "zimo.boss-zhipin",
      "zimo.yupao",
    ]);
    expect(result.installed.some((item) => item.packageId === "zimo.recruitment-hub")).toBe(false);
    expect(skillRuntime.prepareTools).toHaveBeenCalledTimes(2);
  });

  it("does not load an ambiguous declared package identity", async () => {
    const skills = ["one", "two"].map((suffix) =>
      prototype({
        id: `skill-${suffix}` as PrototypeDefinition["id"],
        kind: "skill",
        name: `Boss ${suffix}`,
        skillPackageId: `zimo.market.${suffix}`,
        skillInstructions: "---\npackageId: zimo.boss-zhipin\n---\n\n执行招聘操作。",
        skillChecksum: `checksum-${suffix}`,
        installationStatus: "installed",
      }),
    );
    const skillRuntime = {
      prepareTools: vi.fn(async () => []),
    } as unknown as SkillRuntimeService;
    const service = new CapabilityDiscoveryService(
      catalog({ skill: skills }),
      toolService([]),
      skillRuntime,
    );

    const result = await service.search(
      { query: "Boss直聘", kinds: ["skill"], packageIds: ["zimo.boss-zhipin"] },
      [],
      new AbortController().signal,
    );

    expect(result.installed).toEqual([]);
    expect(skillRuntime.prepareTools).not.toHaveBeenCalled();
  });
});

function catalog(
  values: Partial<Record<PrototypeDefinition["kind"], readonly PrototypeDefinition[]>>,
): PrototypeCatalogService {
  return {
    list: vi.fn(async (kind: PrototypeDefinition["kind"]) => values[kind] ?? []),
  } as unknown as PrototypeCatalogService;
}

function toolService(tools: readonly RegisteredTool[]): ControlledToolService {
  return new ControlledToolService(
    tools,
    { record: vi.fn(async () => undefined) },
    { now: () => new Date("2026-09-23T00:00:00.000Z") },
  );
}

function prototype(
  overrides: Partial<PrototypeDefinition> & Pick<PrototypeDefinition, "kind" | "name">,
): PrototypeDefinition {
  const now = new Date("2026-09-23T00:00:00.000Z");
  return {
    id: `${overrides.kind}-id` as PrototypeDefinition["id"],
    description: "",
    status: "enabled",
    category: "测试",
    tags: [],
    icon: "sparkles",
    version: "1.0.0",
    source: "test",
    permissions: [],
    capabilities: [],
    associations: [],
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
