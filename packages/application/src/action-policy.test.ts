import { describe, expect, it } from "vitest";

import { ACTION_POLICY_VERSION, ActionPolicyService } from "./action-policy";

const policy = new ActionPolicyService();

describe("ActionPolicyService", () => {
  it("allows reads, asks for host commands, and denies other unsandboxed execution in ask mode", () => {
    expect(policy.evaluate(action("file_read", "low"), "ask")).toMatchObject({
      outcome: "allow",
      policyVersion: ACTION_POLICY_VERSION,
    });
    expect(policy.evaluate(action("file_delete", "critical"), "auto_approve").outcome).toBe("deny");
    expect(policy.evaluate({ ...action("command", "low"), sandboxed: false }, "ask").outcome).toBe(
      "ask",
    );
    expect(
      policy.evaluate(
        {
          ...action("command", "low"),
          kind: "network",
          sandboxed: false,
        },
        "auto_approve",
      ).outcome,
    ).toBe("deny");
  });

  it("allows low-risk reversible writes inside an authorized workspace in both modes", () => {
    expect(policy.evaluate(action("file_write", "low"), "auto_approve").outcome).toBe("allow");
    expect(policy.evaluate(action("file_write", "low"), "ask").outcome).toBe("allow");
    expect(
      policy.evaluate(
        {
          kind: "file_write",
          risk: "low",
          summary: "未授权目录",
          reversible: true,
          sandboxed: false,
        },
        "ask",
      ).outcome,
    ).toBe("ask");
  });

  it("automatically approves executable high-risk actions in help-me-approve mode", () => {
    expect(policy.evaluate(action("file_write", "medium"), "auto_approve")).toMatchObject({
      outcome: "allow",
      ruleId: "auto_approve_allowed",
    });
    expect(policy.evaluate(action("file_delete", "high"), "auto_approve").outcome).toBe("allow");
    expect(
      policy.evaluate({ ...action("command", "high"), sandboxed: false }, "auto_approve").outcome,
    ).toBe("allow");
    expect(policy.evaluate(action("file_delete", "critical"), "auto_approve").outcome).toBe("deny");
  });
});

function action(
  kind: "file_read" | "file_write" | "file_delete" | "command",
  risk: "low" | "medium" | "high" | "critical",
) {
  return {
    kind,
    risk,
    summary: "测试动作",
    reversible: true,
    sandboxed: false,
    ...(kind === "file_write" || kind === "file_delete" ? { workspaceId: "workspace-1" } : {}),
  } as const;
}
