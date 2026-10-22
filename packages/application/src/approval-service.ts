import type {
  ActionPolicyMode,
  AgentStreamEvent,
  ApprovalRequest,
  ApprovalRequestRepository,
  ApprovalStatus,
  Clock,
  Fingerprinter,
  IdGenerator,
  PlannedAction,
  ToolExecutionContext,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import type { ActionPolicyService } from "./action-policy";

export interface ApprovalAuthorizationRequest {
  conversationId: string;
  ownerId?: string;
  mode: ActionPolicyMode;
  toolId: string;
  input: Readonly<Record<string, unknown>>;
  action: PlannedAction;
  context: ToolExecutionContext;
  signal: AbortSignal;
  emit(event: AgentStreamEvent): void;
}

export interface ApprovalAuthorizationResult {
  allowed: boolean;
  errorCode?: "ACTION_POLICY_DENIED" | "ACTION_DENIED_BY_USER";
  message?: string;
}

export interface PendingApprovalSnapshot {
  runId: string;
  event: Extract<AgentStreamEvent, { type: "approval.requested" }>;
}

export interface ApprovalDiagnosticSink {
  record(value: {
    event:
      "allowed_by_policy" | "requested" | "resolved" | "expired" | "cancelled" | "denied_by_policy";
    approvalId?: string;
    conversationId: string;
    runId: string;
    actionKind: PlannedAction["kind"];
    risk: PlannedAction["risk"];
    ruleId: string;
    toolId?: string;
    actionLabel?: string;
    workspaceLabel?: string;
    relativeTarget?: string;
    decision?: Exclude<ApprovalStatus, "pending">;
  }): Promise<void>;
}

type PendingApproval = {
  request: ApprovalRequest;
  ownerId: string;
  event: Extract<AgentStreamEvent, { type: "approval.requested" }>;
  finish(status: Exclude<ApprovalStatus, "pending">): Promise<boolean>;
};

export class ApprovalService {
  private readonly pending = new Map<string, PendingApproval>();

  constructor(
    private readonly repository: ApprovalRequestRepository,
    private readonly policy: ActionPolicyService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly fingerprinter: Fingerprinter,
    private readonly diagnostics?: ApprovalDiagnosticSink,
    private readonly approvalTtlMs = 5 * 60_000,
  ) {}

  expirePersisted(): Promise<number> {
    return this.repository.expirePending(this.clock.now());
  }

  listPending(conversationId: string, ownerId: string): readonly PendingApprovalSnapshot[] {
    return [...this.pending.values()]
      .filter(
        (pending) =>
          pending.request.conversationId === conversationId && pending.ownerId === ownerId,
      )
      .map((pending) => ({ runId: pending.request.runId, event: pending.event }));
  }

  async authorize(input: ApprovalAuthorizationRequest): Promise<ApprovalAuthorizationResult> {
    const action = normalizeAction(input.action);
    const policy = this.policy.evaluate(action, input.mode);
    const details = diagnosticDetails(input.toolId, action);
    if (policy.outcome === "allow") {
      await this.diagnostics?.record({
        ...details,
        event: "allowed_by_policy",
        conversationId: input.conversationId,
        runId: input.context.runId,
        actionKind: action.kind,
        risk: action.risk,
        ruleId: policy.ruleId,
      });
      return { allowed: true };
    }
    if (policy.outcome === "deny") {
      await this.diagnostics?.record({
        ...details,
        event: "denied_by_policy",
        conversationId: input.conversationId,
        runId: input.context.runId,
        actionKind: action.kind,
        risk: action.risk,
        ruleId: policy.ruleId,
      });
      return {
        allowed: false,
        errorCode: "ACTION_POLICY_DENIED",
        message: "该操作不符合当前安全策略，已被阻止。",
      };
    }
    if (!input.ownerId) {
      return {
        allowed: false,
        errorCode: "ACTION_POLICY_DENIED",
        message: "当前运行没有可验证的审批窗口，操作已被阻止。",
      };
    }

    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + this.approvalTtlMs);
    const id = this.ids.create();
    const digest = this.digest(input, action, policy.policyVersion);
    const request: ApprovalRequest = {
      id,
      conversationId: input.conversationId as ApprovalRequest["conversationId"],
      runId: input.context.runId,
      toolCallId: input.context.toolCallId,
      actionKind: action.kind,
      actionDigest: digest,
      risk: action.risk as ApprovalRequest["risk"],
      policyVersion: policy.policyVersion,
      status: "pending",
      expiresAt,
      createdAt,
    };
    const event: PendingApproval["event"] = {
      type: "approval.requested",
      approvalId: id,
      conversationId: input.conversationId,
      actionDigest: digest,
      actionKind: action.kind as PendingApproval["event"]["actionKind"],
      risk: request.risk,
      summary: action.summary,
      ...(action.workspaceId ? { workspaceId: action.workspaceId } : {}),
      ...(action.relativeTarget ? { relativeTarget: action.relativeTarget } : {}),
      ...(action.command ? { command: action.command } : {}),
      expiresAt: expiresAt.toISOString(),
    };
    await this.repository.save(request);
    try {
      await this.diagnostics?.record({
        ...details,
        event: "requested",
        approvalId: id,
        conversationId: input.conversationId,
        runId: input.context.runId,
        actionKind: action.kind,
        risk: action.risk,
        ruleId: policy.ruleId,
      });
    } catch (error) {
      await this.repository.resolvePending(id, "cancelled", this.clock.now());
      throw error;
    }

    return new Promise<ApprovalAuthorizationResult>((resolve, reject) => {
      let settling = false;
      const timer = setTimeout(() => void finish("expired"), this.approvalTtlMs);
      const abort = () => void finish("cancelled");
      const finish = async (status: Exclude<ApprovalStatus, "pending">): Promise<boolean> => {
        if (settling || this.pending.get(id)?.request !== request) return false;
        settling = true;
        if (!(await this.repository.resolvePending(id, status, this.clock.now()))) {
          settling = false;
          return false;
        }
        this.pending.delete(id);
        clearTimeout(timer);
        input.signal.removeEventListener("abort", abort);
        const decision = status;
        try {
          await this.diagnostics?.record({
            ...details,
            event:
              status === "expired" ? "expired" : status === "cancelled" ? "cancelled" : "resolved",
            approvalId: id,
            conversationId: input.conversationId,
            runId: input.context.runId,
            actionKind: action.kind,
            risk: action.risk,
            ruleId: policy.ruleId,
            decision: status,
          });
        } catch (error) {
          reject(error);
          return true;
        }
        input.emit({
          type: "approval.resolved",
          approvalId: id,
          conversationId: input.conversationId,
          decision,
        });
        if (status === "allowed_once") resolve({ allowed: true });
        else if (status === "denied") {
          resolve({
            allowed: false,
            errorCode: "ACTION_DENIED_BY_USER",
            message: "用户拒绝了本次操作。",
          });
        } else if (status === "cancelled") reject(abortError());
        else reject(expiredError());
        return true;
      };
      this.pending.set(id, { request, ownerId: input.ownerId!, event, finish });
      input.signal.addEventListener("abort", abort, { once: true });
      input.emit(event);
      if (input.signal.aborted) abort();
    });
  }

  async resolve(input: {
    approvalId: string;
    actionDigest: string;
    decision: "allowed_once" | "denied";
    ownerId: string;
  }): Promise<boolean> {
    const pending = this.pending.get(input.approvalId);
    if (!pending || pending.ownerId !== input.ownerId) return false;
    if (pending.request.actionDigest !== input.actionDigest) return false;
    if (pending.request.expiresAt.getTime() <= this.clock.now().getTime()) {
      await pending.finish("expired");
      return false;
    }
    return pending.finish(input.decision);
  }

  async cancelRun(runId: string): Promise<void> {
    await Promise.all(
      [...this.pending.values()]
        .filter((pending) => pending.request.runId === runId)
        .map((pending) => pending.finish("cancelled")),
    );
  }

  async cancelAll(): Promise<void> {
    await Promise.all([...this.pending.values()].map((pending) => pending.finish("cancelled")));
  }

  private digest(
    input: ApprovalAuthorizationRequest,
    action: PlannedAction,
    policyVersion: string,
  ): string {
    try {
      return this.fingerprinter.fingerprint(
        stableJson({
          policyVersion,
          conversationId: input.conversationId,
          runId: input.context.runId,
          toolCallId: input.context.toolCallId,
          toolId: input.toolId,
          action,
          input: input.input,
        }),
      );
    } catch (error) {
      throw new AppError({
        code: "ACTION_PLAN_INVALID",
        category: "security",
        userMessage: "操作计划无法通过安全校验。",
        cause: error,
      });
    }
  }
}

function normalizeAction(action: PlannedAction): PlannedAction {
  if (
    !["file_read", "file_write", "file_delete", "command", "network", "external_app"].includes(
      action.kind,
    ) ||
    !["low", "medium", "high", "critical"].includes(action.risk) ||
    typeof action.summary !== "string" ||
    typeof action.reversible !== "boolean" ||
    typeof action.sandboxed !== "boolean" ||
    (action.workspaceId !== undefined && typeof action.workspaceId !== "string") ||
    (action.workspaceLabel !== undefined && typeof action.workspaceLabel !== "string") ||
    (action.relativeTarget !== undefined && typeof action.relativeTarget !== "string") ||
    (action.command !== undefined && typeof action.command !== "string")
  ) {
    throw invalidActionPlan();
  }
  const summary = action.summary.trim().slice(0, 300);
  const workspaceLabel = action.workspaceLabel?.trim().slice(0, 180);
  const relativeTarget = action.relativeTarget?.trim().slice(0, 1_000);
  const command = action.command?.trim().slice(0, 20_000);
  if (!summary || action.kind === "file_read" || action.risk === "critical") {
    return {
      ...action,
      summary: summary || "受控操作",
      ...(workspaceLabel ? { workspaceLabel } : {}),
      ...(relativeTarget ? { relativeTarget } : {}),
      ...(command ? { command } : {}),
    };
  }
  return {
    ...action,
    summary,
    ...(workspaceLabel ? { workspaceLabel } : {}),
    ...(relativeTarget ? { relativeTarget } : {}),
    ...(command ? { command } : {}),
  };
}

function diagnosticDetails(toolId: string, action: PlannedAction) {
  return {
    toolId,
    actionLabel: actionLabel(action.kind),
    ...(action.workspaceLabel ? { workspaceLabel: action.workspaceLabel } : {}),
    ...(action.relativeTarget ? { relativeTarget: action.relativeTarget } : {}),
  };
}

function actionLabel(kind: PlannedAction["kind"]): string {
  return {
    file_read: "读取文件",
    file_write: "写入文件",
    file_delete: "删除文件",
    command: "执行命令",
    network: "访问网络",
    external_app: "调用外部应用",
  }[kind];
}

function invalidActionPlan(): AppError {
  return new AppError({
    code: "ACTION_PLAN_INVALID",
    category: "security",
    userMessage: "操作计划无法通过安全校验。",
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Unsupported action digest value");
  return serialized;
}

function expiredError(): AppError {
  return new AppError({
    code: "ACTION_APPROVAL_EXPIRED",
    category: "user",
    userMessage: "操作审批已超时，本轮运行已停止。",
  });
}

function abortError(): Error {
  return Object.assign(new Error("Approval cancelled"), { name: "AbortError" });
}
