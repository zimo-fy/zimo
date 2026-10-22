import { eq } from "drizzle-orm";
import type {
  WebSearchConfiguration,
  WebSearchConfigurationRepository,
  WebSearchProviderKind,
} from "@zimo/domain";

import type { ZimoDatabase } from "./index";
import { appSettings } from "./schema";

interface StoredConfiguration {
  schemaVersion: 1;
  provider: WebSearchProviderKind;
  baseUrl?: string | undefined;
  secretRef?: string | undefined;
  updatedAt: string;
}

export class SQLiteWebSearchConfigurationRepository implements WebSearchConfigurationRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async get(ownerUserId: string): Promise<WebSearchConfiguration | null> {
    const row = this.database.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key(ownerUserId)))
      .get();
    if (!row) return null;
    const stored = parseStoredConfiguration(row.valueJson);
    return {
      ownerUserId,
      provider: stored.provider,
      ...(stored.baseUrl ? { baseUrl: stored.baseUrl } : {}),
      ...(stored.secretRef ? { secretRef: stored.secretRef } : {}),
      updatedAt: new Date(stored.updatedAt),
    };
  }

  async save(configuration: WebSearchConfiguration): Promise<void> {
    const stored: StoredConfiguration = {
      schemaVersion: 1,
      provider: configuration.provider,
      ...(configuration.baseUrl ? { baseUrl: configuration.baseUrl } : {}),
      ...(configuration.secretRef ? { secretRef: configuration.secretRef } : {}),
      updatedAt: configuration.updatedAt.toISOString(),
    };
    this.database.db
      .insert(appSettings)
      .values({
        key: key(configuration.ownerUserId),
        valueJson: JSON.stringify(stored),
        updatedAt: stored.updatedAt,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { valueJson: JSON.stringify(stored), updatedAt: stored.updatedAt },
      })
      .run();
  }

  async delete(ownerUserId: string): Promise<void> {
    this.database.db
      .delete(appSettings)
      .where(eq(appSettings.key, key(ownerUserId)))
      .run();
  }
}

function key(ownerUserId: string): string {
  return `web-search:${ownerUserId}`;
}

function parseStoredConfiguration(value: string): StoredConfiguration {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid web search configuration");
  }
  const record = parsed as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    (record.provider !== "brave" &&
      record.provider !== "tavily" &&
      record.provider !== "searxng" &&
      record.provider !== "model_native") ||
    typeof record.updatedAt !== "string" ||
    Number.isNaN(new Date(record.updatedAt).getTime()) ||
    (record.baseUrl !== undefined && typeof record.baseUrl !== "string") ||
    (record.secretRef !== undefined && typeof record.secretRef !== "string")
  ) {
    throw new Error("Invalid web search configuration");
  }
  return {
    schemaVersion: 1,
    provider: record.provider,
    ...(record.baseUrl ? { baseUrl: record.baseUrl } : {}),
    ...(record.secretRef ? { secretRef: record.secretRef } : {}),
    updatedAt: record.updatedAt,
  };
}
