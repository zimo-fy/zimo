import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ContextCompaction, ConversationId, MessageId } from "@zimo/domain";

import { SQLiteContextCompactionRepository } from "./context-compaction-repository";
import { ZimoDatabase } from "./index";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("SQLiteContextCompactionRepository", () => {
  it("persists completed checkpoints and repairs interrupted records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zimo-compaction-"));
    directories.push(directory);
    const compactionSql = await readFile(
      new URL("../../../../migrations/0035_conversation_context_compactions.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 1, name: "compaction-test-base", sql: BASE_SQL },
      { version: 2, name: "conversation-context-compactions", sql: compactionSql },
    ]);
    try {
      seedConversation(database);
      const repository = new SQLiteContextCompactionRepository(database);
      const first = makeCompaction("00000000-0000-4000-8000-000000000011", 1);
      await repository.create(first);
      await repository.complete(first.id, {
        summary: "## 当前任务\n继续实现",
        outputTokens: 10,
        updatedAt: new Date("2026-09-18T10:01:00.000Z"),
      });
      const interrupted = makeCompaction("00000000-0000-4000-8000-000000000012", 2);
      await repository.create(interrupted);
      await repository.repairInterrupted(new Date("2026-09-18T10:02:00.000Z"));

      expect(await repository.listByConversation(CONVERSATION_ID)).toMatchObject([
        { id: first.id, status: "completed", summary: "## 当前任务\n继续实现" },
        { id: interrupted.id, status: "failed", errorCode: "COMPACTION_INTERRUPTED" },
      ]);
    } finally {
      database.close();
    }
  });
});

const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001" as ConversationId;
const MESSAGE_ONE_ID = "00000000-0000-4000-8000-000000000002" as MessageId;
const MESSAGE_TWO_ID = "00000000-0000-4000-8000-000000000003" as MessageId;

function makeCompaction(id: string, version: number): ContextCompaction {
  const now = new Date("2026-09-18T10:00:00.000Z");
  return {
    id,
    conversationId: CONVERSATION_ID,
    version,
    status: "running",
    trigger: "threshold",
    sourceFromMessageId: MESSAGE_ONE_ID,
    sourceToMessageId: MESSAGE_TWO_ID,
    coveredThroughPosition: 1,
    retainedFromPosition: 2,
    inputTokens: 1_000,
    createdAt: now,
    updatedAt: now,
  };
}

function seedConversation(database: ZimoDatabase): void {
  database.sqlite.prepare("INSERT INTO conversations (id) VALUES (?)").run(CONVERSATION_ID);
  const insert = database.sqlite.prepare(
    "INSERT INTO messages (id, conversation_id, position) VALUES (?, ?, ?)",
  );
  insert.run(MESSAGE_ONE_ID, CONVERSATION_ID, 0);
  insert.run(MESSAGE_TWO_ID, CONVERSATION_ID, 1);
}

const BASE_SQL = `
CREATE TABLE conversations (id TEXT PRIMARY KEY NOT NULL);
CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  position INTEGER NOT NULL
);`;
