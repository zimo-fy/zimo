import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { CommunicationChannelBinding } from "@zimo/domain";

import {
  SQLiteCommunicationChannelRepository,
  SQLiteWeixinAssistantRepository,
} from "./communication-channel-repository";
import { ZimoDatabase } from "./index";

describe("SQLiteCommunicationChannelRepository", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("migrates legacy bindings and persists an address-only email binding", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-channel-db-test-"));
    const createSql = await readFile(
      new URL("../../../../migrations/0010_communication_channels.sql", import.meta.url),
      "utf8",
    );
    const initialSql = await readFile(
      new URL("../../../../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    );
    const conversationsSql = await readFile(
      new URL("../../../../migrations/0002_models_and_conversations.sql", import.meta.url),
      "utf8",
    );
    const addressBindingSql = await readFile(
      new URL("../../../../migrations/0011_email_address_binding.sql", import.meta.url),
      "utf8",
    );
    const authSql = await readFile(
      new URL("../../../../migrations/0014_remote_auth_session.sql", import.meta.url),
      "utf8",
    );
    const assistantSql = await readFile(
      new URL("../../../../migrations/0021_weixin_assistant_channel.sql", import.meta.url),
      "utf8",
    );
    const databasePath = join(directory, "zimo.sqlite");
    const oldMigrations = [
      { version: 1, name: "initial", sql: initialSql },
      { version: 2, name: "models", sql: conversationsSql },
      { version: 10, name: "communication-channels", sql: createSql },
      { version: 11, name: "email-address-binding", sql: addressBindingSql },
      { version: 14, name: "remote-auth", sql: authSql },
    ];
    const legacyDatabase = new ZimoDatabase(databasePath, oldMigrations);
    legacyDatabase.sqlite
      .prepare(
        `INSERT INTO user_sessions
          (id, display_name, email, created_at, expires_at, auth_provider,
           external_user_id, account_id, token_secret_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "session-1",
        "User",
        "",
        "2026-09-07T07:00:00.000Z",
        "2027-09-07T07:00:00.000Z",
        "zimo-cloud",
        "owner-1",
        "account-1",
        "token-ref",
      );
    legacyDatabase.sqlite
      .prepare(
        `INSERT INTO communication_channel_bindings
          (kind, status, account_label, secret_ref, config_json, bound_at, updated_at)
         VALUES ('email', 'bound', ?, ?, ?, ?, ?)`,
      )
      .run(
        "legacy@example.com",
        "legacy-secret-ref",
        '{"host":"smtp.example.com"}',
        "2026-09-07T07:00:00.000Z",
        "2026-09-07T07:00:00.000Z",
      );
    legacyDatabase.close();

    const database = new ZimoDatabase(databasePath, [
      ...oldMigrations,
      { version: 21, name: "weixin-assistant", sql: assistantSql },
    ]);
    const repository = new SQLiteCommunicationChannelRepository(database);
    await expect(repository.get("owner-1", "email")).resolves.toMatchObject({
      accountLabel: "legacy@example.com",
      secretRef: "legacy-secret-ref",
    });
    const binding: CommunicationChannelBinding = {
      ownerUserId: "owner-1",
      kind: "email",
      status: "bound",
      accountLabel: "user@example.com",
      config: {},
      boundAt: new Date("2026-09-07T08:00:00.000Z"),
      updatedAt: new Date("2026-09-07T08:00:00.000Z"),
    };

    await repository.save(binding);
    await expect(repository.get("owner-1", "email")).resolves.toEqual(binding);
    await repository.save({
      ...binding,
      ownerUserId: "owner-2",
      accountLabel: "other@example.com",
    });
    await expect(repository.list("owner-1")).resolves.toEqual([binding]);
    await expect(repository.get("owner-2", "email")).resolves.toMatchObject({
      accountLabel: "other@example.com",
    });
    const raw = database.sqlite
      .prepare(
        `SELECT secret_ref, config_json FROM communication_channel_bindings
         WHERE owner_user_id = 'owner-1' AND kind = 'email'`,
      )
      .get() as { secret_ref: string | null; config_json: string };
    expect(raw).toEqual({ secret_ref: null, config_json: "{}" });

    await repository.clear("owner-1", "email", new Date("2026-09-07T09:00:00.000Z"));
    await expect(repository.get("owner-1", "email")).resolves.toMatchObject({
      status: "unbound",
    });

    const assistant = new SQLiteWeixinAssistantRepository(database);
    await expect(assistant.claimInbound("owner-1", "message-1", now())).resolves.toBe(true);
    await expect(assistant.claimInbound("owner-1", "message-1", now())).resolves.toBe(false);
    await expect(assistant.claimInbound("owner-2", "message-1", now())).resolves.toBe(true);
    database.close();
  });
});

function now(): Date {
  return new Date("2026-09-07T10:00:00.000Z");
}
