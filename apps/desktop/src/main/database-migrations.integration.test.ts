import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ZimoDatabase } from "@zimo/database-sqlite";
import { describe, expect, it } from "vitest";

import { loadDesktopMigrations } from "./database-migrations";

describe("desktop migration sequence", () => {
  it("preserves the published browser migration at 38 and applies the catalog at 39", async () => {
    const migrations = await loadDesktopMigrations(process.cwd());
    expect(migrations.slice(37).map(({ version, name }) => ({ version, name }))).toEqual([
      { version: 38, name: "conversation-browser-capability" },
      { version: 39, name: "conversation-catalog-model" },
      { version: 40, name: "default-browser-capability" },
      { version: 41, name: "knowledge-cloud-links" },
      { version: 42, name: "document-import-formats" },
      { version: 43, name: "message-generation-model" },
      { version: 44, name: "conversation-catalog-vision" },
      { version: 45, name: "document-image-formats" },
    ]);

    const directory = await mkdtemp(join(tmpdir(), "zimo-browser-migration-"));
    const path = join(directory, "zimo.sqlite");
    try {
      const legacy = new ZimoDatabase(path, migrations.slice(0, 38));
      expect(
        legacy.sqlite
          .prepare(
            "SELECT name FROM pragma_table_info('conversations') WHERE name = 'browser_enabled'",
          )
          .get(),
      ).toEqual({ name: "browser_enabled" });
      legacy.close();

      const upgraded = new ZimoDatabase(path, migrations);
      expect(
        upgraded.sqlite
          .prepare(
            "SELECT version, name FROM schema_migrations WHERE version >= 38 ORDER BY version",
          )
          .all(),
      ).toEqual([
        { version: 38, name: "conversation-browser-capability" },
        { version: 39, name: "conversation-catalog-model" },
        { version: 40, name: "default-browser-capability" },
        { version: 41, name: "knowledge-cloud-links" },
        { version: 42, name: "document-import-formats" },
        { version: 43, name: "message-generation-model" },
        { version: 44, name: "conversation-catalog-vision" },
        { version: 45, name: "document-image-formats" },
      ]);
      expect(
        upgraded.sqlite
          .prepare(
            "SELECT name FROM pragma_table_info('conversations') WHERE name = 'catalog_model_id'",
          )
          .get(),
      ).toEqual({ name: "catalog_model_id" });
      upgraded.close();
      new ZimoDatabase(path, migrations).close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([false, true])(
    "reconciles the catalog-first ledger when browser migration was applied: %s",
    async (browserApplied) => {
      const migrations = await loadDesktopMigrations(process.cwd());
      const directory = await mkdtemp(join(tmpdir(), "zimo-catalog-migration-"));
      const path = join(directory, "zimo.sqlite");
      try {
        const legacy = new ZimoDatabase(path, [
          ...migrations.slice(0, 37),
          { ...migrations[38]!, version: 38 },
          ...(browserApplied ? [{ ...migrations[37]!, version: 39 }] : []),
        ]);
        legacy.close();

        const upgraded = new ZimoDatabase(path, migrations);
        expect(
          upgraded.sqlite
            .prepare(
              "SELECT version, name FROM schema_migrations WHERE version >= 38 ORDER BY version",
            )
            .all(),
        ).toEqual([
          { version: 38, name: "conversation-browser-capability" },
          { version: 39, name: "conversation-catalog-model" },
          { version: 40, name: "default-browser-capability" },
          { version: 41, name: "knowledge-cloud-links" },
          { version: 42, name: "document-import-formats" },
          { version: 43, name: "message-generation-model" },
          { version: 44, name: "conversation-catalog-vision" },
          { version: 45, name: "document-image-formats" },
        ]);
        upgraded.close();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it("reconciles knowledge-cloud-links recorded at version 40", async () => {
    const migrations = await loadDesktopMigrations(process.cwd());
    const knowledge = migrations.find((migration) => migration.name === "knowledge-cloud-links");
    if (!knowledge) throw new Error("knowledge-cloud-links migration missing");

    const directory = await mkdtemp(join(tmpdir(), "zimo-knowledge-migration-"));
    const path = join(directory, "zimo.sqlite");
    try {
      new ZimoDatabase(path, migrations.slice(0, 39)).close();
      const sqlite = new DatabaseSync(path);
      sqlite.exec(knowledge.sql);
      const { createHash } = await import("node:crypto");
      const checksum = createHash("sha256")
        .update(knowledge.sql.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"))
        .digest("hex");
      sqlite
        .prepare(
          "INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
        )
        .run(40, knowledge.name, checksum, new Date().toISOString());
      sqlite.close();

      new ZimoDatabase(path, migrations).close();
      const readOnly = new DatabaseSync(path, { readOnly: true });
      expect(
        readOnly
          .prepare(
            "SELECT version, name FROM schema_migrations WHERE version >= 40 ORDER BY version",
          )
          .all(),
      ).toEqual([
        { version: 40, name: "default-browser-capability" },
        { version: 41, name: "knowledge-cloud-links" },
        { version: 42, name: "document-import-formats" },
        { version: 43, name: "message-generation-model" },
        { version: 44, name: "conversation-catalog-vision" },
        { version: 45, name: "document-image-formats" },
      ]);
      expect(
        readOnly
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'knowledge_cloud_links'",
          )
          .get(),
      ).toEqual({ name: "knowledge_cloud_links" });
      readOnly.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a catalog-first ledger whose SQL checksum does not match", async () => {
    const migrations = await loadDesktopMigrations(process.cwd());
    const directory = await mkdtemp(join(tmpdir(), "zimo-catalog-migration-rejection-"));
    const path = join(directory, "zimo.sqlite");
    try {
      new ZimoDatabase(path, [
        ...migrations.slice(0, 37),
        { ...migrations[38]!, version: 38 },
      ]).close();
      const sqlite = new DatabaseSync(path);
      sqlite
        .prepare("UPDATE schema_migrations SET checksum = ? WHERE version = 38")
        .run("unknown-checksum");
      sqlite.close();

      expect(() => new ZimoDatabase(path, migrations)).toThrow(
        "Migration checksum mismatch for version 38",
      );
      const readOnly = new DatabaseSync(path, { readOnly: true });
      expect(
        readOnly
          .prepare("SELECT version, checksum FROM schema_migrations WHERE version = 38")
          .get(),
      ).toEqual({ version: 38, checksum: "unknown-checksum" });
      readOnly.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
