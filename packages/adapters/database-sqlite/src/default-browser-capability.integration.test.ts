import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

describe("default browser capability migration", () => {
  it("enables existing foreground conversations and preserves automation isolation", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY NOT NULL,
          browser_enabled INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE automations (
          conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id)
        );
        INSERT INTO conversations(id, browser_enabled) VALUES ('foreground', 0), ('automation', 0);
        INSERT INTO automations(conversation_id) VALUES ('automation');
      `);
      const migration = await readFile(
        new URL("../../../../migrations/0040_default_browser_capability.sql", import.meta.url),
        "utf8",
      );

      sqlite.exec(migration);

      expect(
        sqlite.prepare("SELECT id, browser_enabled FROM conversations ORDER BY id").all(),
      ).toEqual([
        { id: "automation", browser_enabled: 0 },
        { id: "foreground", browser_enabled: 1 },
      ]);
    } finally {
      sqlite.close();
    }
  });
});
