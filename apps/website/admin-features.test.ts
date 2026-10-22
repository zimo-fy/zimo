import { describe, expect, it } from "vitest";

import { adminFeatureGroups, adminFeatures } from "./src/admin-features";

describe("website admin feature guide", () => {
  it("covers organization, AI catalog, monitoring and tenant usage", () => {
    expect(adminFeatureGroups).toEqual(["组织与权限", "AI 资源", "系统监控", "客户与用量"]);
    expect(adminFeatures.map((feature) => feature.id)).toEqual([
      "admin-org",
      "admin-ai-catalog",
      "admin-ai-connect",
      "admin-monitor",
      "admin-tenant",
    ]);
  });

  it("describes tenant usage without implying billing in Desktop", () => {
    const tenant = adminFeatures.find((feature) => feature.id === "admin-tenant");
    expect(tenant?.actions.join(" ")).toContain("Token");
    expect(tenant?.actions.join(" ")).toContain("不在用户端伪造套餐");
  });
});
