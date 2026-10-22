export type CdpFailureReason =
  | "timeout"
  | "connection_closed"
  | "connection_failed"
  | "connection_unavailable"
  | "protocol_error";

export type CdpFailureDiagnostic = {
  method: string;
  reason: CdpFailureReason;
  durationMs: number;
};

export function classifyCdpFailure(error: unknown): CdpFailureReason {
  if (!(error instanceof Error)) return "protocol_error";
  switch (error.message) {
    case "CDP command timed out":
      return "timeout";
    case "CDP connection closed":
      return "connection_closed";
    case "CDP connection failed":
      return "connection_failed";
    case "CDP connection is not open":
      return "connection_unavailable";
    default:
      return "protocol_error";
  }
}

export function safeCdpMethod(method: string): string {
  return /^[A-Za-z]{1,32}\.[A-Za-z]{1,64}$/.test(method) ? method : "unknown";
}
