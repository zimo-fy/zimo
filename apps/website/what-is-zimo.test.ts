import { describe, expect, it } from "vitest";

import { zimoOfferings, zimoScenarios } from "./src/what-is-zimo";

describe("website what is zimo", () => {
  it("summarizes shipped desktop capabilities without claiming admin is in this repo", () => {
    expect(zimoOfferings.map((offering) => offering.title)).toEqual([
      "任务与对话",
      "知识、文档与检索",
      "Agent、Skill 与工作流",
      "工具、浏览器与本机调度",
      "企业管理端",
    ]);
    expect(zimoOfferings.at(-1)?.summary).toContain("规划中");
    expect(zimoOfferings.map((offering) => offering.summary).join(" ")).not.toMatch(
      /DSH|LangGraph|RuoYi/i,
    );
  });

  it("lists practical desktop scenarios", () => {
    expect(zimoScenarios.length).toBeGreaterThanOrEqual(3);
    expect(zimoScenarios.join(" ")).toContain("知识");
  });
});
