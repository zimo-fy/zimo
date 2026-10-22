import { describe, expect, it } from "vitest";

import { mergeTokenUsage } from "./token-usage";

describe("mergeTokenUsage", () => {
  it("returns the defined side when the other is missing", () => {
    expect(mergeTokenUsage(undefined, { totalTokens: 3 })).toEqual({ totalTokens: 3 });
    expect(mergeTokenUsage({ inputTokens: 2 }, undefined)).toEqual({ inputTokens: 2 });
  });

  it("adds matching fields across model calls", () => {
    expect(
      mergeTokenUsage(
        { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 2 },
        { inputTokens: 5, outputTokens: 1, totalTokens: 6, cachedInputTokens: 1 },
      ),
    ).toEqual({ inputTokens: 15, outputTokens: 5, totalTokens: 20, cachedInputTokens: 3 });
  });

  it("does not invent a zero total when only input and output are present", () => {
    expect(mergeTokenUsage({ inputTokens: 10, outputTokens: 4 }, { inputTokens: 5 })).toEqual({
      inputTokens: 15,
      outputTokens: 4,
    });
  });
});
