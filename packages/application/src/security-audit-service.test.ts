import type { SecurityAuditEvent, SecurityAuditEventRepository } from "@zimo/domain";
import { describe, expect, it } from "vitest";

import { SecurityAuditService } from "./security-audit-service";

describe("SecurityAuditService", () => {
  it("stores only allowlisted counts for tool execution", async () => {
    const repository = new MemoryAuditRepository();
    const service = new SecurityAuditService(
      repository,
      { now: () => new Date("2026-09-16T00:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000001" },
    );
    await service.recordToolStarted({
      runId: "run",
      workflowId: "workflow",
      nodeId: "node",
      toolCallId: "call",
      toolId: "zimo.workspace.patch",
      permissionIds: ["workspace:write"],
      inputKeys: ["content", "path"],
      confirmed: true,
      action: {
        kind: "file_write",
        risk: "low",
        summary: "修改 project/src/index.ts",
        workspaceId: "workspace-1",
        workspaceLabel: "project",
        relativeTarget: "src/index.ts",
        reversible: true,
        sandboxed: false,
      },
      createdAt: new Date(),
    });

    expect(repository.values[0]).toMatchObject({
      eventType: "tool_execution_started",
      outcome: "pending",
      metadata: {
        permissionCount: 1,
        inputKeyCount: 2,
        actionLabel: "写入文件",
        workspaceLabel: "project",
        relativeTarget: "src/index.ts",
      },
    });
    expect(JSON.stringify(repository.values)).not.toContain('content":');
  });
});

class MemoryAuditRepository implements SecurityAuditEventRepository {
  readonly values: SecurityAuditEvent[] = [];
  async append(event: SecurityAuditEvent) {
    this.values.push(event);
  }
  async list() {
    return this.values;
  }
}
