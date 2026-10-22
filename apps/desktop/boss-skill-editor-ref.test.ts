import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const skillRoot = join(import.meta.dirname, "resources", "skills", "boss-zhipin");

describe("Boss Skill chat editor protocol", () => {
  it("keeps the local package version aligned with the Skill header", () => {
    const skill = readFileSync(join(skillRoot, "SKILL.md"), "utf8");
    const manifest = JSON.parse(readFileSync(join(skillRoot, "manifest.json"), "utf8")) as {
      version: string;
    };

    expect(skill).toContain(`version: ${manifest.version}`);
  });

  it("uses snapshot refs for reply and interview text instead of legacy selectors", () => {
    const files = [
      join(skillRoot, "references", "operating-rules.md"),
      join(skillRoot, "tasks", "reply.md"),
      join(skillRoot, "tasks", "interview-invite.md"),
    ];
    const content = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(content).not.toMatch(/browser_type[^\n]*定位线索/u);
    expect(content).not.toMatch(/browser_type[^\n]*replace=true/u);
    expect(content).toContain("可编辑文本区域");
    expect(content).toContain("browser_press");
    expect(content).toContain("snapshotId");
    expect(content).not.toContain("press key=Enter");
  });
});
