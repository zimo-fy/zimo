import { describe, expect, it } from "vitest";

import { agentCatalogInstallRequestSchema, agentCatalogItemViewSchema } from "./agent-marketplace";

describe("agent marketplace contracts", () => {
  it("requires a catalog version on list and install views", () => {
    const base = {
      catalogId: "17",
      name: "招聘专家",
      description: "筛选候选人",
      category: "人力资源",
      icon: "招",
      version: "2.3.0",
      installationStatus: "not_installed" as const,
    };

    expect(agentCatalogItemViewSchema.parse(base)).toEqual(base);
    expect(agentCatalogItemViewSchema.safeParse({ ...base, version: undefined }).success).toBe(
      false,
    );
  });

  it("rejects unknown install request fields", () => {
    expect(
      agentCatalogInstallRequestSchema.safeParse({
        requestId: "00000000-0000-4000-8000-000000000001",
        payload: { catalogId: "17", instructionsUrl: "https://attacker.example/soul.md" },
      }).success,
    ).toBe(false);
  });
});
