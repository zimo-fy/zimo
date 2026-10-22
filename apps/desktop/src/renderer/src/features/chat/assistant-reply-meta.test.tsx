// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  consumedTokens,
  elapsedSeconds,
  formatElapsedDuration,
  formatReplyTime,
  formatThinkingElapsed,
  formatTokenCount,
} from "./assistant-reply-format";
import { AssistantReplyMeta } from "./assistant-reply-meta";

afterEach(() => cleanup());

describe("AssistantReplyMeta", () => {
  it("formats total token usage and model name without duplicating the footer time", () => {
    render(
      <AssistantReplyMeta
        usage={{ totalTokens: 1234, inputTokens: 1000, outputTokens: 234 }}
        modelDisplayName="DeepSeek V4 Flash"
      />,
    );

    const meta = screen.getByLabelText("回复用量与模型");
    expect(meta.textContent).toContain("共消耗 1,234 tokens");
    expect(meta.textContent).toContain("DeepSeek V4 Flash");
    expect(meta.querySelector("time")).toBeNull();
  });

  it("omits consumption when the provider did not return usage", () => {
    render(<AssistantReplyMeta modelDisplayName="DeepSeek V4 Flash" />);

    const meta = screen.getByLabelText("回复用量与模型");
    expect(meta.textContent).not.toContain("共消耗");
    expect(meta.textContent).toContain("DeepSeek V4 Flash");
  });
});

describe("token usage helpers", () => {
  it("prefers totalTokens and otherwise sums input and output", () => {
    expect(consumedTokens({ totalTokens: 9, inputTokens: 1, outputTokens: 2 })).toBe(9);
    expect(consumedTokens({ inputTokens: 10, outputTokens: 3 })).toBe(13);
    expect(consumedTokens(undefined)).toBeUndefined();
    expect(consumedTokens({})).toBeUndefined();
  });

  it("uses a stable token and clock format", () => {
    expect(formatTokenCount(1100)).toBe("1,100");
    expect(formatReplyTime("2026-09-18T03:47:00.000Z")).toBe("11:47");
    expect(elapsedSeconds("2026-09-21T08:00:00.000Z", "2026-09-21T08:00:16.000Z")).toBe(16);
    expect(formatElapsedDuration(59)).toBe("59s");
    expect(formatElapsedDuration(60)).toBe("1m0s");
    expect(formatElapsedDuration(125)).toBe("2m5s");
    expect(formatThinkingElapsed("streaming", 3)).toBe("思考中 3s");
    expect(formatThinkingElapsed("streaming", 65)).toBe("思考中 1m5s");
    expect(formatThinkingElapsed("completed", 16)).toBe("已完成 16s");
    expect(formatThinkingElapsed("completed", 90)).toBe("已完成 1m30s");
    expect(formatThinkingElapsed("cancelled", 12)).toBe("已停止 12s");
  });
});
