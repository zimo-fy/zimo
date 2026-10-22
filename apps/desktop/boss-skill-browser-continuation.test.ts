import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const skillRoot = join(import.meta.dirname, "resources", "skills", "boss-zhipin");

describe("Boss Skill browser continuation", () => {
  it("requires a loaded page before requesting login", () => {
    const skill = readFileSync(join(skillRoot, "SKILL.md"), "utf8");
    const rules = readFileSync(join(skillRoot, "references", "operating-rules.md"), "utf8");

    expect(skill).toContain("只有明确出现登录/扫码界面时才截图并请用户登录");
    expect(rules).toContain("正在加载或页面结构不明确");
    expect(rules).toContain("browser_wait");
  });

  it("refreshes the real target ID after a user reply and recognizes the current error", () => {
    const skill = readFileSync(join(skillRoot, "SKILL.md"), "utf8");
    const rules = readFileSync(join(skillRoot, "references", "operating-rules.md"), "utf8");

    expect(skill).toContain("选择方案或补充条件后");
    expect(skill).toContain("先重新调用 `browser_tabs`");
    expect(rules).toContain("BROWSER_TARGET_NOT_FOUND");
    expect(rules).toContain("不能跨轮沿用或编造 ID");
  });
});
