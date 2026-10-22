import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SecurityAuditEvent } from "@zimo/domain";
import { afterEach, describe, expect, it } from "vitest";

import { ZimoDatabase } from "./index";
import { SQLiteSecurityAuditEventRepository } from "./security-audit-repository";

describe("SQLiteSecurityAuditEventRepository", () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("appends and filters redacted security facts", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-security-audit-db-"));
    const migration = await readFile(
      new URL("../../../../migrations/0029_security_audit_events.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 27, name: "security-audit-events", sql: migration },
    ]);
    const repository = new SQLiteSecurityAuditEventRepository(database);
    const event: SecurityAuditEvent = {
      id: "00000000-0000-4000-8000-000000000001",
      eventType: "action_policy_denied",
      conversationId: "conversation",
      runId: "run",
      actionKind: "file_delete",
      risk: "high",
      outcome: "denied",
      ruleId: "high_risk_requires_approval",
      metadata: {},
      createdAt: new Date("2026-09-16T00:00:00.000Z"),
    };

    await repository.append(event);
    await expect(repository.list({ risk: "high", outcome: "denied", limit: 20 })).resolves.toEqual([
      event,
    ]);
    await expect(repository.list({ risk: "low", limit: 20 })).resolves.toEqual([]);
    database.close();
  });
});
