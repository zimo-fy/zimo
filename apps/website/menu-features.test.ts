import { describe, expect, it } from "vitest";

import { menuFeatureGroups, menuFeatures } from "./src/menu-features";
import { menuFeatureSteps } from "./src/menu-feature-steps";

describe("website menu feature guide", () => {
  it("documents every current desktop menu entry", () => {
    expect(menuFeatures.map((feature) => feature.menuLabel)).toEqual([
      "新建任务",
      "Agent",
      "Skill",
      "知识库",
      "工作流",
      "通信渠道",
      "MCP",
      "自动化",
      "设置与账号",
    ]);
    expect(new Set(menuFeatures.map((feature) => feature.id)).size).toBe(menuFeatures.length);
    expect(menuFeatureGroups).toEqual(["主要入口", "工具", "账户"]);
  });

  it("attaches a screenshot to every user-facing action", () => {
    for (const feature of menuFeatures) {
      expect(menuFeatureSteps[feature.id]?.map((step) => step.caption)).toHaveLength(
        feature.actions.length,
      );
    }
  });

  it("labels limited capabilities without presenting them as complete", () => {
    expect(menuFeatures.find((feature) => feature.id === "channels")?.status).toBe("基础能力");
    expect(menuFeatures.find((feature) => feature.id === "automation")?.status).toBe("已可用");
    expect(menuFeatures.find((feature) => feature.id === "automation")?.note).toContain(
      "仅在桌面应用运行",
    );
  });
});
