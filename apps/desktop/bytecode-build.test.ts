import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const desktopDirectory = dirname(fileURLToPath(import.meta.url));
const verifier = resolve(desktopDirectory, "../../scripts/verify-desktop-bytecode.mjs");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("desktop Bytenode output verification", () => {
  it("accepts matching minimal loaders and bytecode files", () => {
    const directory = createOutputDirectory();
    writeFileSync(
      join(directory, "index.cjs"),
      '"use strict";\nrequire("bytenode");\nmodule.exports = require("./index.jsc");\n',
    );
    writeFileSync(join(directory, "index.jsc"), Buffer.alloc(64, 1));

    expect(() => execFileSync(process.execPath, [verifier, directory])).not.toThrow();
  });

  it.each(["source.js", "source.mjs"])("rejects retained JavaScript bundle %s", (filename) => {
    const directory = createOutputDirectory();
    writeFileSync(
      join(directory, "index.cjs"),
      '"use strict";\nrequire("bytenode");\nmodule.exports = require("./index.jsc");\n',
    );
    writeFileSync(join(directory, "index.jsc"), Buffer.alloc(64, 1));
    writeFileSync(join(directory, filename), "const exposed = true;\n");

    const result = spawnSync(process.execPath, [verifier, directory], { encoding: "utf8" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Main 产物中仍包含 JS 源 bundle");
  });
});

function createOutputDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "zimo-bytecode-test-"));
  temporaryDirectories.push(directory);
  return directory;
}
