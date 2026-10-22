import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const desktopDirectory = dirname(fileURLToPath(import.meta.url));

describe("Boss recommend list scrolling", () => {
  it("targets the candidate list, respects the scroll limit, and waits for lazy loading", async () => {
    const content = await readFile(
      join(desktopDirectory, "resources", "skills", "boss-zhipin", "tasks", "recommend.md"),
      "utf8",
    );
    const scrollSection = content.split("## 滚动加载\n")[1]?.split("\n## 输出要求")[0];

    expect(scrollSection).toBeDefined();
    expect(scrollSection).toContain("最后一张候选人卡片");
    expect(scrollSection).toContain("`deltaY=1000`");
    expect(scrollSection).toContain("先把这个 ref 滚入可视区");
    expect(scrollSection).toContain("`browser_wait`（`timeoutMs=1200`");
    expect(scrollSection).toContain("连续两次有效的末卡滚动及等待");
    expect(scrollSection).not.toContain("1000-1050");
    expect(scrollSection).not.toContain("`S_after == S_before` ⇒ 列表到底");
  });
});
