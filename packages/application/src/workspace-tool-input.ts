export function onlyWorkspaceToolKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("unknown key");
}

export function workspaceToolUuid(value: unknown): string {
  const parsed = workspaceToolString(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(parsed)) {
    throw new Error("invalid uuid");
  }
  return parsed;
}

export function optionalWorkspaceToolUuid(value: unknown): string | undefined {
  return value === undefined ? undefined : workspaceToolUuid(value);
}

export function optionalWorkspaceToolString(value: unknown, maximum: number): string | undefined {
  return value === undefined ? undefined : workspaceToolString(value, maximum);
}

export function workspaceToolString(value: unknown, maximum: number, allowEmpty = false): string {
  if (value === undefined && allowEmpty) return "";
  if (typeof value !== "string" || value.length > maximum || (!allowEmpty && !value.trim())) {
    throw new Error("invalid string");
  }
  return value;
}

export function workspaceToolInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error("invalid integer");
  }
  return value as number;
}

export function workspaceToolChecksum(value: unknown): string {
  const checksum = workspaceToolString(value, 64);
  if (!/^[a-f0-9]{64}$/u.test(checksum)) throw new Error("invalid checksum");
  return checksum;
}
