import type { PlannedAction } from "./approvals";

export interface ToolExecutionRequest {
  toolId: string;
  input: Readonly<Record<string, unknown>>;
}

export interface ToolExecutionResult {
  ok: boolean;
  output?: unknown;
  errorCode?: string;
}

export interface ToolExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

export type ToolPermissionRisk = "low" | "medium" | "high";
export interface ToolPermissionDeclaration {
  id: string;
  title: string;
  description: string;
  risk: ToolPermissionRisk;
}

export interface ToolCapabilityDefinition {
  id: string;
  title: string;
  description: string;
  source: "builtin" | "mcp" | "skill";
  permissions: readonly ToolPermissionDeclaration[];
  inputSchema: Readonly<Record<string, unknown>>;
  annotations: Readonly<{
    readOnly: boolean;
    destructive: boolean;
    idempotent: boolean;
    openWorld: boolean;
  }>;
  confirmation: "per_run";
  timeoutMs: number;
}

export interface ToolExecutionContext {
  runId: string;
  workflowId: string;
  nodeId: string;
  toolCallId: string;
  artifactConversationId?: string;
  ownerUserId?: string;
}

export interface ToolAuditRecord {
  runId: string;
  workflowId: string;
  nodeId: string;
  toolCallId: string;
  toolId: string;
  permissionIds: readonly string[];
  inputKeys: readonly string[];
  confirmed: boolean;
  action?: PlannedAction;
  outcome: "success" | "failure" | "cancelled" | "timed_out";
  durationMs: number;
  errorCode?: string;
  createdAt: Date;
}

export interface ToolAuditSink {
  begin?(value: Omit<ToolAuditRecord, "outcome" | "durationMs" | "errorCode">): Promise<void>;
  record(value: ToolAuditRecord): Promise<void>;
}

export class DirectToolExecutor implements ToolExecutor {
  async execute(_request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    return { ok: false, errorCode: "TOOL_NOT_AVAILABLE" };
  }
}
