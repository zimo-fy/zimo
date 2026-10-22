import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type BuildConfiguration = {
  files: string[];
  extraResources: Array<{ from: string; to: string }>;
  mac: { files: string[] };
  win: { files: string[] };
  publish?: unknown;
};

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const viteConfiguration = readFileSync(join(packageDirectory, "electron.vite.config.ts"), "utf8");
const packageJson = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8")) as {
  main: string;
  build: BuildConfiguration;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};

describe("desktop package configuration", () => {
  it("excludes project-local Skills from every platform package", () => {
    const exclusion = "!resources/skills{,/**/*}";

    expect(packageJson.build.files).toContain(exclusion);
    expect(packageJson.build.mac.files).toContain(exclusion);
    expect(packageJson.build.win.files).toContain(exclusion);
    expect(packageJson.build.extraResources).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: expect.stringMatching(/^resources\/skills(?:\/|$)/) }),
      ]),
    );
  });

  it("requires Bytenode protection for production desktop builds", () => {
    expect(packageJson.main).toBe("./out/main/index.cjs");
    expect(packageJson.dependencies.bytenode).toBe("1.6.0");
    expect(packageJson.scripts["package:dir"]).toContain("package-desktop-bytecode.mjs dir");
    expect(packageJson.scripts["package:mac"]).toContain("package-desktop-bytecode.mjs mac");
    expect(packageJson.scripts["package:win"]).toContain("package-desktop-bytecode.mjs win");
    expect(packageJson.scripts["package:mac"]).toContain("assert-bytecode-build-host.mjs darwin");
    expect(packageJson.scripts["package:win"]).toContain(
      "assert-bytecode-build-host.mjs win32 x64",
    );
  });

  it("uses descriptor-safe CJS interop for bundled Transformers", () => {
    expect(viteConfiguration).toContain("externalLiveBindings: false");
    expect(viteConfiguration).not.toMatch(
      /external:\s*\[[^\]]*["']@huggingface\/transformers["']/s,
    );
  });

  it("does not configure electron-builder publish or electron-updater", () => {
    expect(packageJson.build.publish).toBeUndefined();
    expect(packageJson.dependencies["electron-updater"]).toBeUndefined();
    expect(viteConfiguration).not.toMatch(/["']electron-updater["']/);
  });
});
