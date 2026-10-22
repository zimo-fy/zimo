import { describe, expect, it } from "vitest";

import { skillCatalogInstallRequestSchema, skillCatalogItemViewSchema } from "./skill-marketplace";

describe("skill marketplace contracts", () => {
  it("accepts only installed and not_installed catalog states", () => {
    const base = {
      catalogId: "7",
      packageId: "zimo.market.123456789012345678901234",
      name: "招聘助手",
      description: "筛选候选人",
      category: "人力资源",
      version: "1.0.0",
      source: "Zimo Skill Store",
    };

    expect(skillCatalogItemViewSchema.parse({ ...base, installationStatus: "installed" })).toEqual({
      ...base,
      installationStatus: "installed",
    });
    expect(
      skillCatalogItemViewSchema.safeParse({ ...base, installationStatus: "disabled" }).success,
    ).toBe(false);
  });

  it("rejects unknown install request fields", () => {
    expect(
      skillCatalogInstallRequestSchema.safeParse({
        requestId: "00000000-0000-4000-8000-000000000001",
        payload: { catalogId: "7", downloadUrl: "https://attacker.example/skill.zip" },
      }).success,
    ).toBe(false);
  });
});
