import { describe, expect, it } from "vitest";
import type { PrototypeDefinition, PrototypeId, PrototypeRepository } from "@zimo/domain";

import { repairBuiltInInstructionSkills } from "./prototype-seeding";

describe("repairBuiltInInstructionSkills", () => {
  it("repairs incomplete built-in Skill data without replacing user state", async () => {
    const id = "00000000-0000-4000-8000-000000000002" as PrototypeId;
    const existing = definition(id, {
      status: "enabled",
      installationStatus: "installed",
    });
    const current = memoryRepository([existing]);
    const seed = memoryRepository([
      definition(id, {
        skillPackageId: "zimo.builtin.web-summary",
        skillInstructions: "只总结用户提供的内容。",
        skillChecksum: "checksum",
        capabilities: ["指令型 Skill"],
      }),
    ]);

    await repairBuiltInInstructionSkills(current, seed);

    expect(await current.getById(id)).toMatchObject({
      status: "enabled",
      installationStatus: "installed",
      skillPackageId: "zimo.builtin.web-summary",
      skillInstructions: "只总结用户提供的内容。",
      capabilities: ["指令型 Skill"],
    });
  });
});

function memoryRepository(initial: readonly PrototypeDefinition[]): PrototypeRepository {
  const values = new Map(initial.map((value) => [value.id, value]));
  return {
    list: async () => [...values.values()],
    getById: async (id) => values.get(id) ?? null,
    save: async (value) => void values.set(value.id, value),
    delete: async (id) => void values.delete(id),
  };
}

function definition(id: PrototypeId, overrides: Partial<PrototypeDefinition>): PrototypeDefinition {
  return {
    id,
    kind: "skill",
    name: "网页摘要",
    description: "摘要长内容",
    status: "enabled",
    category: "写作",
    tags: [],
    icon: "摘",
    version: "1.0.0",
    source: "Zimo Gallery",
    permissions: [],
    capabilities: [],
    associations: [],
    installationStatus: "installed",
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: new Date("2026-09-03T00:00:00.000Z"),
    updatedAt: new Date("2026-09-03T00:00:00.000Z"),
    ...overrides,
  };
}
