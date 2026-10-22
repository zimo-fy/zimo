import { AppError } from "@zimo/domain";

export interface McpTransportFailureDiagnostic {
  serverId: string;
  phase: "connect" | "tools_list" | "tools_call";
  durationMs: number;
  errorName: string;
  errorCode?: string;
  httpStatus?: number;
  toolName?: string;
}

export function createMcpTransportFailureDiagnostic(
  error: unknown,
  serverId: string,
  phase: McpTransportFailureDiagnostic["phase"],
  phaseStartedAt: number,
  signal: AbortSignal,
  toolName?: string,
): McpTransportFailureDiagnostic | undefined {
  if (signal.aborted || (error instanceof Error && error.name === "AbortError")) return undefined;
  if (error instanceof AppError) return undefined;
  const value = isRecord(error) ? error : undefined;
  const data = value && isRecord(value.data) ? value.data : undefined;
  const errorCode = safeDiagnosticIdentifier(value?.code);
  const httpStatus = safeHttpStatus(value?.status) ?? safeHttpStatus(data?.status);
  return {
    serverId,
    phase,
    durationMs: Math.max(0, Math.round(Date.now() - phaseStartedAt)),
    errorName: safeDiagnosticIdentifier(value?.name) ?? "Error",
    ...(errorCode ? { errorCode } : {}),
    ...(httpStatus ? { httpStatus } : {}),
    ...(toolName ? { toolName } : {}),
  };
}

function safeDiagnosticIdentifier(value: unknown): string | undefined {
  const normalized = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  return typeof normalized === "string" && /^[A-Za-z0-9_.:-]{1,80}$/.test(normalized)
    ? normalized
    : undefined;
}

function safeHttpStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
