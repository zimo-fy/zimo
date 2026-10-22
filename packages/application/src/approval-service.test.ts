import type { ApprovalRequest, ApprovalRequestRepository, ApprovalStatus } from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import { ActionPolicyService } from "./action-policy";
import { ApprovalService } from "./approval-service";

const now = new Date("2026-09-16T00:00:00.000Z");

describe("ApprovalService", () => {
  it("binds a one-time approval to its owner and action digest", async () => {
    const repository = new MemoryApprovalRepository();
    const emitted: unknown[] = [];
    const service = createService(repository);
    const authorization = service.authorize({
      conversationId: id(1),
      ownerId: "window-1",
      mode: "ask",
      toolId: "test.file.write",
      input: { path: "README.md" },
      action: {
        kind: "file_write",
        risk: "medium",
        summary: "修改 README",
        relativeTarget: "README.md",
        reversible: true,
        sandboxed: true,
      },
      context: { runId: id(2), workflowId: id(1), nodeId: "agent", toolCallId: id(3) },
      signal: new AbortController().signal,
      emit: (event) => void emitted.push(event),
    });
    await vi.waitFor(() => expect(repository.values.size).toBe(1));
    const request = [...repository.values.values()][0]!;

    await expect(
      service.resolve({
        approvalId: request.id,
        actionDigest: request.actionDigest,
        decision: "allowed_once",
        ownerId: "window-2",
      }),
    ).resolves.toBe(false);
    await expect(
      service.resolve({
        approvalId: request.id,
        actionDigest: request.actionDigest,
        decision: "allowed_once",
        ownerId: "window-1",
      }),
    ).resolves.toBe(true);
    await expect(authorization).resolves.toEqual({ allowed: true });
    await expect(
      service.resolve({
        approvalId: request.id,
        actionDigest: request.actionDigest,
        decision: "allowed_once",
        ownerId: "window-1",
      }),
    ).resolves.toBe(false);
    expect(emitted).toMatchObject([
      { type: "approval.requested", approvalId: request.id },
      { type: "approval.resolved", approvalId: request.id, decision: "allowed_once" },
    ]);
  });

  it("returns a safe denial result and never exposes critical actions for approval", async () => {
    const repository = new MemoryApprovalRepository();
    const service = createService(repository);
    await expect(
      service.authorize({
        conversationId: id(1),
        ownerId: "window-1",
        mode: "auto_approve",
        toolId: "test.delete",
        input: {},
        action: {
          kind: "file_delete",
          risk: "critical",
          summary: "危险删除",
          reversible: false,
          sandboxed: true,
        },
        context: { runId: id(2), workflowId: id(1), nodeId: "agent", toolCallId: id(3) },
        signal: new AbortController().signal,
        emit: () => undefined,
      }),
    ).resolves.toMatchObject({ allowed: false, errorCode: "ACTION_POLICY_DENIED" });
    expect(repository.values.size).toBe(0);
  });

  it("fails closed when a registered tool produces a malformed action plan", async () => {
    const service = createService(new MemoryApprovalRepository());
    await expect(
      service.authorize({
        conversationId: id(1),
        ownerId: "window-1",
        mode: "ask",
        toolId: "test.invalid",
        input: {},
        action: { kind: "unknown", summary: "bad" } as never,
        context: { runId: id(2), workflowId: id(1), nodeId: "agent", toolCallId: id(3) },
        signal: new AbortController().signal,
        emit: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "ACTION_PLAN_INVALID" });
  });

  it("fails closed when an automatic policy decision cannot be audited", async () => {
    const service = new ApprovalService(
      new MemoryApprovalRepository(),
      new ActionPolicyService(),
      { now: () => now },
      { create: () => id(4) },
      { fingerprint: () => "a".repeat(64) },
      { record: async () => Promise.reject(new Error("audit unavailable")) },
    );
    await expect(
      service.authorize({
        conversationId: id(1),
        ownerId: "window-1",
        mode: "auto_approve",
        toolId: "test.write",
        input: {},
        action: {
          kind: "file_write",
          risk: "low",
          summary: "安全修改",
          reversible: true,
          sandboxed: true,
        },
        context: { runId: id(2), workflowId: id(1), nodeId: "agent", toolCallId: id(3) },
        signal: new AbortController().signal,
        emit: () => undefined,
      }),
    ).rejects.toThrow("audit unavailable");
  });

  it("does not create approval requests for host commands in help-me-approve mode", async () => {
    const repository = new MemoryApprovalRepository();
    const service = createService(repository);
    await expect(
      service.authorize({
        conversationId: id(1),
        ownerId: "window-1",
        mode: "auto_approve",
        toolId: "zimo.workspace.run_command",
        input: { command: "pnpm test" },
        action: {
          kind: "command",
          risk: "high",
          summary: "运行测试",
          reversible: false,
          sandboxed: false,
        },
        context: { runId: id(2), workflowId: id(1), nodeId: "agent", toolCallId: id(3) },
        signal: new AbortController().signal,
        emit: () => undefined,
      }),
    ).resolves.toEqual({ allowed: true });
    expect(repository.values.size).toBe(0);
  });
});

function createService(repository: MemoryApprovalRepository) {
  return new ApprovalService(
    repository,
    new ActionPolicyService(),
    { now: () => now },
    { create: () => id(4) },
    { fingerprint: () => "a".repeat(64) },
  );
}

function id(suffix: number): string {
  return `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;
}

class MemoryApprovalRepository implements ApprovalRequestRepository {
  readonly values = new Map<string, ApprovalRequest>();

  async save(request: ApprovalRequest) {
    this.values.set(request.id, request);
  }

  async resolvePending(id: string, status: Exclude<ApprovalStatus, "pending">, at: Date) {
    const request = this.values.get(id);
    if (!request || request.status !== "pending") return false;
    this.values.set(id, { ...request, status, resolvedAt: at });
    return true;
  }

  async expirePending() {
    return 0;
  }
}
