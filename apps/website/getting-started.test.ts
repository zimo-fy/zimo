import { describe, expect, it } from "vitest";

import { gettingStartedEntries, gettingStartedSteps } from "./src/getting-started";

describe("website getting started", () => {
  it("documents desktop and Zimo admin frontend/backend startup in order", () => {
    expect(gettingStartedSteps.map((step) => step.id)).toEqual([
      "prepare",
      "desktop",
      "admin-backend",
      "admin-frontend",
    ]);
    expect(gettingStartedSteps[1]?.commands?.join(" ")).toContain("pnpm dev");
    expect(gettingStartedSteps[2]?.commands?.join(" ")).toContain("app.py");
    expect(gettingStartedSteps[3]?.commands?.join(" ")).toContain("npm run dev");
  });

  it("keeps the admin console on a separate URL from Desktop", () => {
    expect(gettingStartedEntries.map((entry) => entry.name)).toEqual([
      "用户端 Desktop",
      "企业管理端",
      "功能说明页",
    ]);
    expect(gettingStartedEntries.find((entry) => entry.name === "企业管理端")?.address).toContain(
      "localhost:80",
    );
  });
});
