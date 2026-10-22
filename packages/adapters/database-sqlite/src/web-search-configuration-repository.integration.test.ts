import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ZimoDatabase } from "./index";
import { SQLiteWebSearchConfigurationRepository } from "./web-search-configuration-repository";

describe("SQLiteWebSearchConfigurationRepository", () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("persists configurations separately for each account without storing API keys", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-web-search-config-"));
    const sql = await readFile(
      new URL("../../../../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), [
      { version: 1, name: "initial", sql },
    ]);
    const repository = new SQLiteWebSearchConfigurationRepository(database);

    await repository.save({
      ownerUserId: "owner-a",
      provider: "tavily",
      secretRef: "opaque-secret-ref",
      updatedAt: new Date("2026-09-20T00:00:00.000Z"),
    });
    await repository.save({
      ownerUserId: "owner-b",
      provider: "searxng",
      baseUrl: "https://search.example.com",
      updatedAt: new Date("2026-09-20T00:01:00.000Z"),
    });

    await expect(repository.get("owner-a")).resolves.toMatchObject({
      provider: "tavily",
      secretRef: "opaque-secret-ref",
    });
    await expect(repository.get("owner-b")).resolves.toMatchObject({
      provider: "searxng",
      baseUrl: "https://search.example.com",
    });
    const stored = database.sqlite
      .prepare("SELECT value_json FROM app_settings WHERE key LIKE 'web-search:%'")
      .all() as { value_json: string }[];
    expect(JSON.stringify(stored)).not.toContain("api-key");
    database.close();
  });
});
