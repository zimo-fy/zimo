import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { resolveElectronDist } from "../../scripts/resolve-electron-dist.mjs";

const electronRoot = join("/repo", "node_modules", "electron");
const packagePath = join(electronRoot, "package.json");
const distDirectory = join(electronRoot, "dist");
const pathFile = join(electronRoot, "path.txt");
const binaryPath = join(distDirectory, "electron.exe");
const versionFile = join(distDirectory, "version");

describe("local Electron dist resolution", () => {
  it("returns the installed dist when the binary and version match", () => {
    expect(
      resolveElectronDist({
        requireFn: createRequireFn(),
        fileExists: (candidate) => [pathFile, binaryPath, versionFile].includes(candidate),
        readText: (file) => {
          if (file === pathFile) return "electron.exe\n";
          if (file === versionFile) return "v44.1.1\n";
          throw new Error(`unexpected file ${file}`);
        },
      }),
    ).toBe(distDirectory);
  });

  it("rejects a version that does not match the Electron package", () => {
    expect(() =>
      resolveElectronDist({
        requireFn: createRequireFn(),
        fileExists: (candidate) => [pathFile, binaryPath, versionFile].includes(candidate),
        readText: (file) => {
          if (file === pathFile) return "electron.exe\n";
          if (file === versionFile) return "44.0.0\n";
          throw new Error(`unexpected file ${file}`);
        },
      }),
    ).toThrow("Electron 运行时版本不匹配");
  });

  it("points Electron Builder at the resolved local dist", () => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../scripts/package-desktop-bytecode.mjs",
      ),
      "utf8",
    );

    expect(source).toContain("resolveElectronDist()");
    expect(source).toContain("--config.electronDist=");
  });
});

function createRequireFn() {
  const requireFn = (id: string) => {
    if (id === packagePath) return { version: "44.1.1" };
    throw new Error(`unexpected require ${id}`);
  };
  requireFn.resolve = (id: string) => {
    if (id === "electron/package.json") return packagePath;
    throw new Error(`unexpected resolve ${id}`);
  };
  return requireFn;
}
