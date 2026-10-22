import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ZimoDatabase } from "./index";
import { SQLiteUserMemoryRepository } from "./user-memory-repository";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("SQLiteUserMemoryRepository", () => {
  it("migrates and isolates account reads and writes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zimo-user-memory-"));
    directories.push(directory);
    const sql = await readFile(
      new URL("../../../../migrations/0036_user_memories.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 1, name: "user-memories", sql },
    ]);
    try {
      const repository = new SQLiteUserMemoryRepository(database);
      const now = new Date("2026-09-20T00:00:00.000Z");
      await repository.create({
        id: "00000000-0000-4000-8000-000000000001",
        ownerUserId: "alice",
        kind: "goal",
        content: "完成项目",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
      expect(await repository.list("bob")).toEqual([]);
      expect(
        await repository.update("bob", "00000000-0000-4000-8000-000000000001", {
          kind: "goal",
          content: "替换",
          enabled: false,
          updatedAt: now,
        }),
      ).toBe(false);
      expect(await repository.delete("bob", "00000000-0000-4000-8000-000000000001")).toBe(false);
      expect(await repository.list("alice")).toMatchObject([
        { content: "完成项目", enabled: true },
      ]);
    } finally {
      database.close();
    }
  });
});
