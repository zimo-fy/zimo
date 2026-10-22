import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/desktop/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  testIgnore:
    process.env.ZIMO_CAPTURE_WEBSITE_SHOTS === "1"
      ? []
      : ["**/capture-website-screenshots.spec.ts"],
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
