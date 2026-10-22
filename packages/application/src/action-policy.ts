import type { ActionPolicyDecision, ActionPolicyMode, PlannedAction } from "@zimo/domain";

export const ACTION_POLICY_VERSION = "phase9-auto-approve-v2";

export class ActionPolicyService {
  evaluate(action: PlannedAction, mode: ActionPolicyMode): ActionPolicyDecision {
    if (action.risk === "critical") return decision("deny", "critical_action_denied");
    if (action.kind === "file_read") return decision("allow", "read_only_allowed");
    if (mode === "auto_approve" && isLocallyExecutable(action)) {
      return decision("allow", "auto_approve_allowed");
    }
    if (action.kind === "command" && !action.sandboxed) {
      return decision("ask", "experimental_host_command_requires_approval");
    }
    if ((action.kind === "network" || action.kind === "external_app") && !action.sandboxed) {
      return decision("deny", "sandbox_required");
    }
    if (action.risk === "high") return decision("ask", "high_risk_requires_approval");
    if (
      action.kind === "file_write" &&
      action.risk === "low" &&
      action.reversible &&
      Boolean(action.workspaceId)
    ) {
      return decision("allow", "authorized_directory_allowed");
    }
    return decision("ask", "side_effect_requires_approval");
  }
}

function isLocallyExecutable(action: PlannedAction): boolean {
  return ["file_write", "file_delete", "command"].includes(action.kind);
}

function decision(outcome: ActionPolicyDecision["outcome"], ruleId: string): ActionPolicyDecision {
  return { outcome, ruleId, policyVersion: ACTION_POLICY_VERSION };
}
