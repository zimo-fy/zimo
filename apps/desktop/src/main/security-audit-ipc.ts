import type { SecurityAuditService } from "@zimo/application";
import {
  IPC_CHANNELS,
  securityAuditEventViewSchema,
  securityAuditListRequestSchema,
} from "@zimo/contracts";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerSecurityAuditIpcHandlers(
  register: RegisterIpcHandler,
  audit: SecurityAuditService,
): void {
  register({
    channel: IPC_CHANNELS.securityAuditList,
    input: securityAuditListRequestSchema,
    output: securityAuditEventViewSchema.array(),
    handle: async ({ payload }) =>
      (
        await audit.list({
          ...(payload.eventType ? { eventType: payload.eventType } : {}),
          ...(payload.risk ? { risk: payload.risk } : {}),
          ...(payload.outcome ? { outcome: payload.outcome } : {}),
          limit: payload.limit ?? 100,
        })
      ).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        ...(event.toolId ? { toolId: event.toolId } : {}),
        ...(event.actionKind ? { actionKind: event.actionKind } : {}),
        ...(event.risk ? { risk: event.risk } : {}),
        ...(event.decision ? { decision: event.decision } : {}),
        outcome: event.outcome,
        ...(event.errorCode ? { errorCode: event.errorCode } : {}),
        ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
        ...(event.metadata.actionLabel ? { actionLabel: event.metadata.actionLabel } : {}),
        ...(event.metadata.workspaceLabel ? { workspaceLabel: event.metadata.workspaceLabel } : {}),
        ...(event.metadata.relativeTarget ? { relativeTarget: event.metadata.relativeTarget } : {}),
        createdAt: event.createdAt.toISOString(),
      })),
  });
}
