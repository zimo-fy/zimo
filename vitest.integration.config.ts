import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.integration.test.ts", "apps/**/*.integration.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
