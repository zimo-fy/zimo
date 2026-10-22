import type { TokenUsage } from "./index";

export function mergeTokenUsage(
  left: TokenUsage | undefined,
  right: TokenUsage | undefined,
): TokenUsage | undefined {
  if (!left) return right;
  if (!right) return left;
  const inputTokens = addOptional(left.inputTokens, right.inputTokens);
  const outputTokens = addOptional(left.outputTokens, right.outputTokens);
  const totalTokens = addOptional(left.totalTokens, right.totalTokens);
  const cachedInputTokens = addOptional(left.cachedInputTokens, right.cachedInputTokens);
  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined &&
    cachedInputTokens === undefined
  ) {
    return undefined;
  }
  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
  };
}

function addOptional(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined && right === undefined) return undefined;
  return (left ?? 0) + (right ?? 0);
}
