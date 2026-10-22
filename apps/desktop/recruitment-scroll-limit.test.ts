import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), "resources", "skills");

describe("recruitment recommendation scroll limits", () => {
  it("limits Boss recommendations to ten list scrolls in every state marker", () => {
    const content = readFileSync(join(skillsRoot, "boss-zhipin", "tasks", "recommend.md"), "utf8");

    expect(content).toContain("[SCROLLED 10/10]");
    expect(content).toContain("scrollCount >= 10");
    expect(content).not.toMatch(/SCROLLED 30\/30|scrollCount\s*(?:>=|<|=)\s*30|scroll 累计 30 次/u);
  });

  it("limits Yupao recommendations to ten list scrolls", () => {
    const content = readFileSync(join(skillsRoot, "yupao", "tasks", "recommend.md"), "utf8");

    expect(content).toContain("scroll 累计上限 = **10 次**");
    expect(content).toContain("scroll 累计 ≥ 10 次");
    expect(content).not.toMatch(/scroll 累计.{0,20}30 次/u);
  });
});
