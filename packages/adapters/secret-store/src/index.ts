import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { SecretStore, SecretStoreStatus } from "@zimo/domain";

export interface EncryptionBackend {
  getStatus(): Promise<SecretStoreStatus>;
  encrypt(value: string): Promise<Uint8Array>;
  decrypt(value: Uint8Array): Promise<{ result: string; shouldReEncrypt: boolean }>;
}

type StoredSecrets = Record<string, string>;

export class EncryptedFileSecretStore implements SecretStore {
  constructor(
    private readonly filePath: string,
    private readonly backend: EncryptionBackend,
  ) {}

  getStatus(): Promise<SecretStoreStatus> {
    return this.backend.getStatus();
  }

  async set(ref: string, secret: string): Promise<void> {
    await this.requirePersistence();
    const current = await this.readAll();
    const encrypted = await this.backend.encrypt(secret);
    current[ref] = Buffer.from(encrypted).toString("base64");
    await this.writeAll(current);
  }

  async get(ref: string): Promise<string | null> {
    await this.requirePersistence();
    const current = await this.readAll();
    const encoded = current[ref];
    if (!encoded) return null;
    const decrypted = await this.backend.decrypt(Buffer.from(encoded, "base64"));
    if (decrypted.shouldReEncrypt) await this.set(ref, decrypted.result);
    return decrypted.result;
  }

  async delete(ref: string): Promise<void> {
    await this.requirePersistence();
    const current = await this.readAll();
    if (!(ref in current)) return;
    delete current[ref];
    await this.writeAll(current);
  }

  private async requirePersistence(): Promise<void> {
    const status = await this.backend.getStatus();
    if (!status.available || !status.persistent) {
      throw new Error("Secure persistent storage is unavailable");
    }
  }

  private async readAll(): Promise<StoredSecrets> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as StoredSecrets;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeAll(value: StoredSecrets): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
    await chmod(this.filePath, 0o600);
  }
}
