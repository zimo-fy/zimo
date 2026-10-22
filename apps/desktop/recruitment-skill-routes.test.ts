import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const desktopDirectory = dirname(fileURLToPath(import.meta.url));

const taskRoutes = [
  ["boss-zhipin", "recommend.md", "https://www.zhipin.com/web/chat/recommend"],
  ["boss-zhipin", "search.md", "https://www.zhipin.com/web/chat/search"],
  ["boss-zhipin", "reply.md", "https://www.zhipin.com/web/chat/index"],
  ["boss-zhipin", "publish.md", "https://www.zhipin.com/web/chat/job/list"],
  ["yupao", "recommend.md", "https://www.yupao.com/web/find-worker"],
  ["yupao", "search.md", "https://www.yupao.com/web/search-worker"],
  ["yupao", "reply.md", "https://www.yupao.com/web/im"],
  ["yupao", "publish.md", "https://www.yupao.com/web/job-manage"],
  ["liepin-hr", "recommend.md", "https://lpt.liepin.com/recommend"],
  ["liepin-hr", "search.md", "https://lpt.liepin.com/search"],
  ["liepin-hr", "reply.md", "https://lpt.liepin.com/chat/im"],
  ["liepin-hr", "publish.md", "https://lpt.liepin.com/job/manager"],
] as const;

describe("recruitment Skill route guards", () => {
  it.each(taskRoutes)("keeps the %s %s task on its target route", async (skill, task, url) => {
    const content = await readFile(
      join(desktopDirectory, "resources", "skills", skill, "tasks", task),
      "utf8",
    );

    expect(content).toContain(url);
    expect(content).toMatch(/验证/u);
    expect(content).toMatch(/恢复一次/u);
    expect(content).not.toMatch(/browser action=|sessions_spawn|CSS selector|坐标点击/u);
  });

  it.each(["boss-zhipin", "yupao", "liepin-hr"])(
    "defines shared route recovery for %s",
    async (skill) => {
      const content = await readFile(
        join(desktopDirectory, "resources", "skills", skill, "SKILL.md"),
        "utf8",
      );

      expect(content).toContain("任务页面路由守卫");
      expect(content).toMatch(/只允许.*一次.*browser_navigate/u);
      expect(content).toMatch(/验证.*URL/u);
    },
  );
});
