import { AppError } from "@zimo/domain";

export function requireText(value: string, label: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new AppError({
      code: "INVALID_TEXT_INPUT",
      category: "user",
      userMessage: `${label}不能为空，且不能超过 ${max} 个字符。`,
    });
  }
  return normalized;
}
