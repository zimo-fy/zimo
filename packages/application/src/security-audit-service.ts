import type {
  Clock,
  IdGenerator,
  SecurityAuditEvent,
  SecurityAuditEventRepository,
  SecurityAuditFilter,
  ToolAuditRecord,
} from "@zimo/domain";

import type { ApprovalDiagnosticSink } from "./approval-service";

export class SecurityAuditService {
  constructor(
    private readonly repository: SecurityAuditEventRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  list(filter: SecurityAuditFilter): Promise<readonly SecurityAuditEvent[]> {
    return this.repository.list(filter);
  }

  async recordToolStarted(
    value: Omit<ToolAuditRecord, "outcome" | "durationMs" | "errorCode">,
  ): Promise<void> {
    await this.repository.append({
      id: this.ids.create(),
      eventType: "tool_execution_started",
      runId: value.runId,
      toolCallId: value.toolCallId,
      toolId: value.toolId,
      outcome: "pending",
      metadata: {
        permissionCount: value.permissionIds.length,
        inputKeyCount: value.inputKeys.length,
        ...toolActionMetadata(value.action),
      },
      createdAt: this.clock.now(),
    });
  }

  async recordToolCompleted(value: ToolAuditRecord): Promise<void> {
    await this.repository.append({
      id: this.ids.create(),
      eventType: "tool_execution_completed",
      runId: value.runId,
      toolCallId: value.toolCallId,
      toolId: value.toolId,
      outcome: value.outcome,
      ...(value.errorCode ? { errorCode: value.errorCode } : {}),
      durationMs: value.durationMs,
      metadata: {
        permissionCount: value.permissionIds.length,
        inputKeyCount: value.inputKeys.length,
        ...toolActionMetadata(value.action),
      },
      createdAt: this.clock.now(),
    });
  }

  approvalSink(): ApprovalDiagnosticSink {
    return { record: (value) => this.recordApproval(value) };
  }

  private async recordApproval(
    value: Parameters<ApprovalDiagnosticSink["record"]>[0],
  ): Promise<void> {
    const mapped = approvalEvent(value.event, value.decision);
    await this.repository.append({
      id: this.ids.create(),
      eventType: mapped.eventType,
      conversationId: value.conversationId,
      runId: value.runId,
      ...(value.approvalId ? { approvalId: value.approvalId } : {}),
      actionKind: value.actionKind,
      risk: value.risk,
      ...(value.decision ? { decision: value.decision } : {}),
      outcome: mapped.outcome,
      ruleId: value.ruleId,
      metadata: {
        ...(value.actionLabel ? { actionLabel: value.actionLabel } : {}),
        ...(value.workspaceLabel ? { workspaceLabel: value.workspaceLabel } : {}),
        ...(value.relativeTarget ? { relativeTarget: value.relativeTarget } : {}),
      },
      createdAt: this.clock.now(),
    });
  }
}

function toolActionMetadata(action: ToolAuditRecord["action"]): SecurityAuditEvent["metadata"] {
  if (!action) return {};
  return {
    actionLabel: {
      file_read: "读取文件",
      file_write: "写入文件",
      file_delete: "删除文件",
      command: "执行命令",
      network: "访问网络",
      external_app: "调用外部应用",
    }[action.kind],
    ...(action.workspaceLabel ? { workspaceLabel: action.workspaceLabel } : {}),
    ...(action.relativeTarget ? { relativeTarget: action.relativeTarget } : {}),
  };
}

function approvalEvent(
  event: Parameters<ApprovalDiagnosticSink["record"]>[0]["event"],
  decision?: Parameters<ApprovalDiagnosticSink["record"]>[0]["decision"],
): Pick<SecurityAuditEvent, "eventType" | "outcome"> {
  if (event === "allowed_by_policy") {
    return { eventType: "action_policy_allowed", outcome: "allowed" };
  }
  if (event === "denied_by_policy") {
    return { eventType: "action_policy_denied", outcome: "denied" };
  }
  if (event === "requested") return { eventType: "approval_requested", outcome: "pending" };
  if (event === "expired") return { eventType: "approval_expired", outcome: "timed_out" };
  if (event === "cancelled") return { eventType: "approval_cancelled", outcome: "cancelled" };
  return {
    eventType: "approval_resolved",
    outcome: decision === "allowed_once" ? "allowed" : "denied",
  };
}
