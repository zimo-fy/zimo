import type {
  GeneratedSkillPackageReader,
  InstructionSkillPackage,
  PrototypeDefinition,
  PrototypeId,
} from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import {
  GeneratedSkillInstallationService,
  SKILL_CREATOR_INSTALL_PERMISSION,
  SKILL_CREATOR_MARKETPLACE_PACKAGE_ID,
  SKILL_CREATOR_PACKAGE_ID,
} from "./generated-skill-installation-service";

describe("GeneratedSkillInstallationService", () => {
  it("installs a generated package through the existing installation boundary", async () => {
    const readFromWorkspace = vi.fn(async () => generatedPackage());
    const install = vi.fn(async () => generatedDefinition());
    const service = new GeneratedSkillInstallationService({ readFromWorkspace }, { install });

    const result = await service.install(
      creatorDefinition(),
      "demo-skill",
      new AbortController().signal,
    );

    expect(readFromWorkspace).toHaveBeenCalledWith({
      ownerSkillId: "00000000-0000-4000-8000-000000000701",
      ownerChecksum: "a".repeat(64),
      directoryName: "demo-skill",
    });
    expect(install).toHaveBeenCalledWith(generatedPackage(), "Skill Creator 本地创建");
    expect(result.skillPackageId).toBe("local.skill.demo-skill");
  });

  it("rejects an unauthorized Creator and self replacement", async () => {
    const readFromWorkspace = vi.fn(async () => ({
      ...generatedPackage(),
      packageId: SKILL_CREATOR_PACKAGE_ID,
    }));
    const install = vi.fn(async () => generatedDefinition());
    const service = new GeneratedSkillInstallationService({ readFromWorkspace }, { install });
    const unauthorized = {
      ...creatorDefinition(),
      permissions: [],
    };

    await expect(
      service.install(unauthorized, "demo-skill", new AbortController().signal),
    ).rejects.toMatchObject({ code: "SKILL_CREATOR_INSTALL_NOT_AUTHORIZED" });
    await expect(
      service.install(creatorDefinition(), "demo-skill", new AbortController().signal),
    ).rejects.toMatchObject({ code: "GENERATED_SKILL_INSTALL_REJECTED" });
    expect(install).not.toHaveBeenCalled();
  });

  it("honors cancellation before reading the generated package", async () => {
    const reader: GeneratedSkillPackageReader = {
      readFromWorkspace: vi.fn(async () => generatedPackage()),
    };
    const service = new GeneratedSkillInstallationService(reader, {
      install: vi.fn(async () => generatedDefinition()),
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      service.install(creatorDefinition(), "demo-skill", controller.signal),
    ).rejects.toMatchObject({ code: "TOOL_CANCELLED" });
    expect(reader.readFromWorkspace).not.toHaveBeenCalled();
  });

  it("authorizes only the reviewed marketplace Creator source", async () => {
    const readFromWorkspace = vi.fn(async () => generatedPackage());
    const install = vi.fn(async () => generatedDefinition());
    const service = new GeneratedSkillInstallationService({ readFromWorkspace }, { install });
    const marketplaceCreator = definition({
      id: "00000000-0000-4000-8000-000000000703" as PrototypeId,
      name: "创建skill的技能",
      skillPackageId: SKILL_CREATOR_MARKETPLACE_PACKAGE_ID,
      skillChecksum: "c".repeat(64),
      source: "Zimo Skill Store",
      permissions: ["context:user-input", "context:conversation"],
    });

    await expect(
      service.install(marketplaceCreator, "demo-skill", new AbortController().signal),
    ).resolves.toMatchObject({ installationStatus: "installed" });
    await expect(
      service.install(
        { ...marketplaceCreator, source: "本地 instruction Skill" },
        "demo-skill",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "SKILL_CREATOR_INSTALL_NOT_AUTHORIZED" });
  });

  it("prevents the marketplace Creator from installing either privileged identity", async () => {
    const readFromWorkspace = vi.fn(async () => ({
      ...generatedPackage(),
      packageId: SKILL_CREATOR_PACKAGE_ID,
    }));
    const install = vi.fn(async () => generatedDefinition());
    const service = new GeneratedSkillInstallationService({ readFromWorkspace }, { install });
    const marketplaceCreator = definition({
      skillPackageId: SKILL_CREATOR_MARKETPLACE_PACKAGE_ID,
      skillChecksum: "c".repeat(64),
      source: "Zimo Skill Store",
    });

    await expect(
      service.install(marketplaceCreator, "demo-skill", new AbortController().signal),
    ).rejects.toMatchObject({ code: "GENERATED_SKILL_INSTALL_REJECTED" });
    expect(install).not.toHaveBeenCalled();
  });
});

function generatedPackage(): InstructionSkillPackage {
  return {
    packageId: "local.skill.demo-skill",
    name: "Demo Skill",
    version: "1.0.0",
    description: "Demo",
    category: "本地",
    tags: [],
    permissions: ["context:user-input"],
    instructions: "# Demo",
    checksum: "b".repeat(64),
    files: [],
  };
}

function creatorDefinition(): PrototypeDefinition {
  return definition({
    id: "00000000-0000-4000-8000-000000000701" as PrototypeId,
    name: "创建 Skill",
    skillPackageId: SKILL_CREATOR_PACKAGE_ID,
    skillChecksum: "a".repeat(64),
    permissions: [SKILL_CREATOR_INSTALL_PERMISSION],
  });
}

function generatedDefinition(): PrototypeDefinition {
  return definition({
    id: "00000000-0000-4000-8000-000000000702" as PrototypeId,
    name: "Demo Skill",
    skillPackageId: "local.skill.demo-skill",
    skillChecksum: "b".repeat(64),
    permissions: ["context:user-input"],
  });
}

function definition(overrides: Partial<PrototypeDefinition>): PrototypeDefinition {
  const now = new Date("2026-09-11T00:00:00.000Z");
  return {
    id: "00000000-0000-4000-8000-000000000700" as PrototypeId,
    kind: "skill",
    name: "Skill",
    description: "",
    status: "enabled",
    category: "本地",
    tags: [],
    icon: "S",
    version: "1.0.0",
    source: "test",
    permissions: [],
    capabilities: ["脚本型 Skill"],
    associations: [],
    installationStatus: "installed",
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
