import type { AuthSession, SessionStore } from "@zimo/domain";

import type { ZimoDatabase } from "./index";
import { userSessions } from "./schema";

export class SQLiteSessionStore implements SessionStore {
  constructor(private readonly database: ZimoDatabase) {}

  async get(): Promise<AuthSession | null> {
    const row = this.database.db.select().from(userSessions).limit(1).get();
    if (!row) return null;
    if (row.provider !== "zimo-cloud") {
      this.database.db.delete(userSessions).run();
      return null;
    }
    return {
      id: row.id as AuthSession["id"],
      provider: "zimo-cloud",
      externalUserId: row.externalUserId,
      account: row.account,
      ...(row.email ? { email: row.email } : {}),
      displayName: row.displayName,
      tokenSecretRef: row.tokenSecretRef,
      createdAt: new Date(row.createdAt),
      expiresAt: new Date(row.expiresAt),
    };
  }

  async save(session: AuthSession): Promise<void> {
    this.database.sqlite.exec("BEGIN IMMEDIATE");
    try {
      this.database.db.delete(userSessions).run();
      this.database.db
        .insert(userSessions)
        .values({
          id: session.id,
          provider: session.provider,
          externalUserId: session.externalUserId,
          account: session.account,
          displayName: session.displayName,
          email: session.email ?? "",
          tokenSecretRef: session.tokenSecretRef,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        })
        .run();
      this.database.sqlite.exec("COMMIT");
    } catch (error) {
      this.database.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async clear(): Promise<void> {
    this.database.db.delete(userSessions).run();
  }
}
