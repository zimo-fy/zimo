import type { SecretStoreStatus } from "@zimo/domain";
import type { EncryptionBackend } from "@zimo/secret-store";
import { safeStorage } from "electron";

export class ElectronEncryptionBackend implements EncryptionBackend {
  async getStatus(): Promise<SecretStoreStatus> {
    const available = await safeStorage.isAsyncEncryptionAvailable();
    const backend =
      process.platform === "linux" ? safeStorage.getSelectedStorageBackend() : "os-keychain";
    const persistent = available && backend !== "basic_text";
    return {
      available,
      backend,
      persistent,
      ...(!persistent ? { reason: "当前系统未提供可安全持久化凭据的加密后端。" } : {}),
    };
  }

  encrypt(value: string): Promise<Uint8Array> {
    return safeStorage.encryptStringAsync(value);
  }

  decrypt(value: Uint8Array): Promise<{ result: string; shouldReEncrypt: boolean }> {
    return safeStorage.decryptStringAsync(Buffer.from(value));
  }
}
