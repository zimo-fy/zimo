import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { EncryptedFileSecretStore, type EncryptionBackend } from "./index";

const backend: EncryptionBackend = {
  async getStatus() {
    return { available: true, persistent: true, backend: "test" };
  },
  async encrypt(value) {
    return Buffer.from(`encrypted:${value}`);
  },
  async decrypt(value) {
    return {
      result: Buffer.from(value)
        .toString("utf8")
        .replace(/^encrypted:/, ""),
      shouldReEncrypt: false,
    };
  },
};

describe("EncryptedFileSecretStore", () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("persists only encrypted material", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-secret-test-"));
    const path = join(directory, "secrets.enc");
    const store = new EncryptedFileSecretStore(path, backend);
    await store.set("provider-1", "sk-canary");

    expect(await store.get("provider-1")).toBe("sk-canary");
    expect(await readFile(path, "utf8")).not.toContain("sk-canary");
  });
});
