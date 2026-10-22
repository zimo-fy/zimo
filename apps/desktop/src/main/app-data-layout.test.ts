import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { prepareAppDataLayout } from "./app-data-layout";

describe("prepareAppDataLayout", () => {
  let root: string | null = null;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("creates system, accounts and workspaces and migrates legacy data", async () => {
    root = await mkdtemp(join(tmpdir(), "zimo-data-layout-"));
    await writeFile(join(root, "zimo.sqlite"), "database");
    await mkdir(join(root, "knowledge-files"));
    await writeFile(join(root, "knowledge-files", "document.txt"), "knowledge");
    await mkdir(join(root, "document-workspaces"));
    await writeFile(join(root, "document-workspaces", "artifact.bin"), "artifact");

    const layout = await prepareAppDataLayout(root);

    await expect(readFile(layout.accounts.database, "utf8")).resolves.toBe("database");
    await expect(readFile(join(layout.accounts.knowledge, "document.txt"), "utf8")).resolves.toBe(
      "knowledge",
    );
    await expect(readFile(join(layout.workspaces, "artifact.bin"), "utf8")).resolves.toBe(
      "artifact",
    );
    await expect(access(layout.accounts.browserProfiles)).resolves.toBeUndefined();
  });
});
