import { describe, expect, it, vi } from "vitest";

import type { ModelGateway } from "@zimo/domain";

import { fallbackTitle, generateTitle, normalizeTitle } from "./conversation-title-service";

describe("normalizeTitle", () => {
  it("removes common model formatting and keeps a concise title", () => {
    expect(normalizeTitle("## 标题： “整理招聘流程。”\n补充说明")).toBe("整理招聘流程");
  });

  it("rejects an empty or meaningless title", () => {
    expect(normalizeTitle("。")).toBeUndefined();
  });

  it("limits title length to thirty visible characters", () => {
    expect(
      Array.from(
        normalizeTitle(
          "这是一个非常长的任务标题需要被限制以免侧边栏显示内容过多影响整体布局设计",
        ) ?? "",
      ),
    ).toHaveLength(30);
  });
});

describe("fallbackTitle", () => {
  it("builds a bounded local title from the first user instruction", () => {
    expect(fallbackTitle("帮我去boss直聘的推荐牛人找符合前端岗位的求职者打招呼\n补充内容")).toBe(
      "去boss直聘的推荐牛人找符合前端岗位的求职者打",
    );
  });

  it("rejects an empty instruction", () => {
    expect(fallbackTitle(" \n ")).toBeUndefined();
  });
});

describe("generateTitle", () => {
  it("does not cancel a healthy title response after five seconds", async () => {
    vi.useFakeTimers();
    try {
      const gateway = {
        async *stream() {
          await new Promise((resolve) => setTimeout(resolve, 6_000));
          yield { type: "text" as const, text: "招聘候选人沟通" };
        },
      } as unknown as ModelGateway;

      const resultPromise = generateTitle(
        gateway,
        { baseUrl: "https://example.com/v1", apiKey: "test-key", modelName: "test-model" },
        [
          { role: "system", content: "生成标题" },
          { role: "user", content: "处理招聘任务" },
        ],
        new AbortController().signal,
      );
      await vi.advanceTimersByTimeAsync(6_000);

      await expect(resultPromise).resolves.toMatchObject({
        outcome: "success",
        title: "招聘候选人沟通",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
