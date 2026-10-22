import { describe, expect, it } from "vitest";
import type { LoginInput, SecretStore, SecretStoreStatus } from "@zimo/domain";
import { FixedClock, MemorySessionStore, SequentialIdGenerator } from "@zimo/test-kit";

import { ZimoAuthProvider, type ZimoAuthGateway } from "./index";

describe("ZimoAuthProvider", () => {
  it("stores the bearer token only in secure storage", async () => {
    const store = new MemorySessionStore();
    const secrets = new MemorySecrets();
    const provider = new ZimoAuthProvider(
      store,
      secrets,
      successfulGateway(),
      new FixedClock(new Date("2026-09-08T00:00:00.000Z")),
      new SequentialIdGenerator(),
    );

    const { modelApiKey, session } = await provider.login({
      username: "staff-01",
      password: "secret-password",
    });

    expect(modelApiKey).toBe("model-key-canary");
    expect(session.account).toBe("13800138000");
    expect(session.externalUserId).toBe("user-7");
    expect(await secrets.get(session.tokenSecretRef)).toBe("jwt-canary");
    expect(JSON.stringify(await store.get())).not.toContain("jwt-canary");
    expect(JSON.stringify(await store.get())).not.toContain("model-key-canary");
    expect(JSON.stringify(await store.get())).not.toContain("secret-password");
  });

  it("clears a stored session when remote verification rejects it", async () => {
    const store = new MemorySessionStore();
    const secrets = new MemorySecrets();
    const gateway = successfulGateway();
    const provider = new ZimoAuthProvider(
      store,
      secrets,
      gateway,
      new FixedClock(new Date("2026-09-08T00:00:00.000Z")),
      new SequentialIdGenerator(),
    );
    const { session } = await provider.login({ username: "staff-01", password: "password" });
    gateway.verify = async () => ({ valid: false });

    expect(await provider.getSession()).toBeNull();
    expect(await store.get()).toBeNull();
    expect(await secrets.get(session.tokenSecretRef)).toBeNull();
  });

  it("keeps the session retryable when secure token cleanup fails", async () => {
    const store = new MemorySessionStore();
    const secrets = new MemorySecrets();
    const provider = new ZimoAuthProvider(
      store,
      secrets,
      successfulGateway(),
      new FixedClock(new Date("2026-09-08T00:00:00.000Z")),
      new SequentialIdGenerator(),
    );
    await provider.login({ username: "staff-01", password: "password" });
    secrets.failDelete = true;

    await expect(provider.logout()).rejects.toThrow("test delete failure");
    expect(await store.get()).not.toBeNull();
  });

  it("does not send credentials when secure persistence is unavailable", async () => {
    const secrets = new MemorySecrets({ available: false, backend: "none", persistent: false });
    let loginCalled = false;
    const gateway = successfulGateway();
    gateway.login = async (_input: LoginInput) => {
      loginCalled = true;
      throw new Error("unexpected");
    };
    const provider = new ZimoAuthProvider(
      new MemorySessionStore(),
      secrets,
      gateway,
      new FixedClock(new Date("2026-09-08T00:00:00.000Z")),
      new SequentialIdGenerator(),
    );

    await expect(
      provider.login({ username: "staff-01", password: "password" }),
    ).rejects.toMatchObject({
      code: "AUTH_SECURE_STORAGE_UNAVAILABLE",
    });
    expect(loginCalled).toBe(false);
  });
});

function successfulGateway(): ZimoAuthGateway {
  return {
    async login() {
      return {
        token: "jwt-canary",
        modelApiKey: "model-key-canary",
        externalUserId: "user-7",
        account: "13800138000",
        email: "user@example.com",
        displayName: "测试用户",
        expiresAt: new Date("2026-09-15T00:00:00.000Z"),
      };
    },
    async verify() {
      return { valid: true, externalUserId: "user-7" };
    },
  };
}

class MemorySecrets implements SecretStore {
  readonly values = new Map<string, string>();
  failDelete = false;

  constructor(
    private readonly status: SecretStoreStatus = {
      available: true,
      backend: "test",
      persistent: true,
    },
  ) {}

  async getStatus() {
    return this.status;
  }

  async set(ref: string, secret: string) {
    this.values.set(ref, secret);
  }

  async get(ref: string) {
    return this.values.get(ref) ?? null;
  }

  async delete(ref: string) {
    if (this.failDelete) throw new Error("test delete failure");
    this.values.delete(ref);
  }
}
