import { eq } from "drizzle-orm";
import type { AppSettings, AppSettingsStore } from "@zimo/domain";

import type { ZimoDatabase } from "./index";
import { appSettings } from "./schema";

const DEFAULT_SETTINGS: AppSettings = {
  appearance: "light",
  logLevel: "info",
  reduceMotion: false,
};

export class SQLiteAppSettingsStore implements AppSettingsStore {
  private static readonly KEY = "application";

  constructor(private readonly database: ZimoDatabase) {}

  async get(): Promise<AppSettings> {
    const row = this.database.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, SQLiteAppSettingsStore.KEY))
      .get();
    if (!row) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(row.valueJson) as Partial<AppSettings>;
    return {
      appearance: "light",
      logLevel: parsed.logLevel ?? DEFAULT_SETTINGS.logLevel,
      reduceMotion: parsed.reduceMotion ?? DEFAULT_SETTINGS.reduceMotion,
    };
  }

  async save(settings: AppSettings): Promise<void> {
    this.database.db
      .insert(appSettings)
      .values({
        key: SQLiteAppSettingsStore.KEY,
        valueJson: JSON.stringify(settings),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { valueJson: JSON.stringify(settings), updatedAt: new Date().toISOString() },
      })
      .run();
  }
}
