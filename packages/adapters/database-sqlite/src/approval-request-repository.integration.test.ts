import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ApprovalRequest, ConversationId } from "@zimo/domain";
import { afterEach, describe, expect, it } from "vitest";

import { SQLiteApprovalRequestRepository } from "./approval-request-repository";
import { ZimoDatabase } from "./index";

describe("SQLiteApprovalRequestRepository", () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("persists minimum approval facts and consumes a pending request once", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-approval-db-"));
    const migration = await readFile(
      new URL("../../../../migrations/0028_action_approval_requests.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      {
        version: 1,
        name: "conversation-fixture",
        sql: "CREATE TABLE conversations (id TEXT PRIMARY KEY NOT NULL);",
      },
      { version: 26, name: "action-approval-requests", sql: migration },
    ]);
    const conversationId = "00000000-0000-4000-8000-000000000001" as ConversationId;
    database.sqlite.prepare("INSERT INTO conversations (id) VALUES (?)").run(conversationId);
    const repository = new SQLiteApprovalRequestRepository(database);
    const request: ApprovalRequest = {
      id: "00000000-0000-4000-8000-000000000002",
      conversationId,
      runId: "00000000-0000-4000-8000-000000000003",
      toolCallId: "00000000-0000-4000-8000-000000000004",
      actionKind: "file_write",
      actionDigest: "a".repeat(64),
      risk: "medium",
      policyVersion: "test-v1",
      status: "pending",
      expiresAt: new Date("2026-09-16T00:05:00.000Z"),
      createdAt: new Date("2026-09-16T00:00:00.000Z"),
    };

    await repository.save(request);
    expect(repository.getById(request.id)).toEqual(request);
    await expect(
      repository.resolvePending(request.id, "allowed_once", request.createdAt),
    ).resolves.toBe(true);
    await expect(repository.resolvePending(request.id, "denied", request.createdAt)).resolves.toBe(
      false,
    );
    expect(repository.getById(request.id)?.status).toBe("allowed_once");
    database.close();
  });
});
