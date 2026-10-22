import { describe, expect, it } from "vitest";

import { appUpdateStateViewSchema } from "./app-updates";

describe("desktop update contracts", () => {
  it("accepts a bounded downloaded update state", () => {
    expect(
      appUpdateStateViewSchema.safeParse({
        status: "ready",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
        releaseNotes: "修复已知问题。",
        userInitiated: false,
      }).success,
    ).toBe(true);
  });

  it("does not expose remote URLs or local package paths", () => {
    const base = { status: "downloading", currentVersion: "0.1.0", userInitiated: true };
    expect(
      appUpdateStateViewSchema.safeParse({ ...base, downloadUrl: "https://example.test" }).success,
    ).toBe(false);
    expect(
      appUpdateStateViewSchema.safeParse({ ...base, packagePath: "/tmp/update.zip" }).success,
    ).toBe(false);
  });
});
