import { describe, expect, it } from "vitest";
import type { PrototypeDefinition, PrototypeId } from "@zimo/domain";
import { createSeededPrototypeRepositories, InMemoryPrototypeRepository } from "./index";

describe("InMemoryPrototypeRepository", () => {
  it.each(["agent", "skill", "knowledge", "workflow", "plugin", "mcp", "automation"] as const)(
    "implements the %s repository contract",
    async (kind) => {
      const repository = new InMemoryPrototypeRepository(kind);
      const now = new Date("2026-09-03T00:00:00.000Z");
      const value: PrototypeDefinition = {
        id: "00000000-0000-4000-8000-000000000001" as PrototypeId,
        kind,
        name: "Agent",
        description: "",
        status: "draft",
        category: "",
        tags: [],
        icon: "A",
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
      };
      await repository.save(value);
      expect(await repository.list()).toEqual([value]);
      expect(await repository.getById(value.id)).toEqual(value);
      await repository.delete(value.id);
      expect(await repository.getById(value.id)).toBeNull();
    },
  );
});

describe("built-in prototypes", () => {
  it("provides executable instruction data for the installed web summary Skill", async () => {
    const repositories = createSeededPrototypeRepositories(new Date("2026-09-03T00:00:00.000Z"));

    await expect(
      repositories.skill.getById("00000000-0000-4000-8000-000000000002" as PrototypeId),
    ).resolves.toMatchObject({
      name: "网页摘要",
      status: "enabled",
      installationStatus: "installed",
      skillPackageId: "zimo.builtin.web-summary",
      skillInstructions: expect.any(String),
    });
  });
});
