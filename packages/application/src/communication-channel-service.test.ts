import { describe, expect, it, vi } from "vitest";
import type {
  CommunicationChannelBinding,
  CommunicationChannelKind,
  CommunicationChannelRepository,
  SecretStore,
  WeixinBindingGateway,
} from "@zimo/domain";

import { CommunicationChannelService } from "./communication-channel-service";

const now = new Date("2026-09-07T08:00:00.000Z");

describe("CommunicationChannelService", () => {
  it("lists the two built-in channels when no binding exists", async () => {
    const harness = createHarness();
    await expect(harness.service.list()).resolves.toEqual([
      expect.objectContaining({ kind: "weixin", status: "unbound" }),
      expect.objectContaining({ kind: "email", status: "unbound" }),
    ]);
  });

  it("stores an email address without credentials or SMTP configuration", async () => {
    const harness = createHarness();
    await harness.service.bindEmail("user@example.com");

    expect(harness.repository.values.get("email")).toMatchObject({
      accountLabel: "user@example.com",
      status: "bound",
      config: {},
    });
    expect(harness.repository.values.get("email")?.secretRef).toBeUndefined();
    expect(harness.secrets.values.size).toBe(0);
  });

  it("stores confirmed Weixin tokens without exposing them in repository config", async () => {
    const harness = createHarness();
    await harness.service.startWeixin();
    await harness.service.pollWeixin("00000000-0000-4000-8000-000000000099");

    expect(harness.repository.values.get("weixin")).toMatchObject({
      accountLabel: "bot-1",
      config: { accountId: "bot-1", userId: "user-1", baseUrl: "https://weixin.qq.com" },
    });
    expect(JSON.stringify(harness.repository.values.get("weixin"))).not.toContain("bot-secret");
    expect([...harness.secrets.values.values()].join(" ")).toContain("bot-secret");
  });

  it("replaces a legacy SMTP binding and deletes its obsolete secret", async () => {
    const harness = createHarness();
    harness.repository.values.set("email", {
      ownerUserId: "user-owner",
      kind: "email",
      status: "bound",
      accountLabel: "old@example.com",
      secretRef: "legacy-smtp-secret",
      config: { host: "smtp.example.com" },
      boundAt: now,
      updatedAt: now,
    });
    harness.secrets.values.set("legacy-smtp-secret", "legacy-credential");

    await harness.service.bindEmail("new@example.com");

    expect(harness.repository.values.get("email")?.accountLabel).toBe("new@example.com");
    expect(harness.secrets.values.has("legacy-smtp-secret")).toBe(false);
  });

  it("clears an address-only email binding on unbind", async () => {
    const harness = createHarness();
    await harness.service.bindEmail("user@example.com");
    await harness.service.unbind("email");

    expect(harness.repository.values.get("email")?.status).toBe("unbound");
    expect(harness.secrets.values.size).toBe(0);
  });
});

function createHarness() {
  const repository = new MemoryChannelRepository();
  const secrets = new MemorySecrets();
  const weixin: WeixinBindingGateway = {
    start: vi.fn(async () => ({
      sessionId: "00000000-0000-4000-8000-000000000099",
      qrCodeUrl: "data:image/png;base64,abc",
      expiresAt: new Date(now.getTime() + 300_000),
    })),
    poll: vi.fn(async () => ({
      status: "confirmed" as const,
      accountId: "bot-1",
      userId: "user-1",
      baseUrl: "https://weixin.qq.com",
      botToken: "bot-secret",
    })),
    cancel: vi.fn(),
  };
  const service = new CommunicationChannelService(
    repository,
    secrets,
    weixin,
    { now: () => now },
    { create: () => "00000000-0000-4000-8000-000000000010" },
    {
      get: async () => ({ externalUserId: "user-owner" }) as never,
      save: async () => undefined,
      clear: async () => undefined,
    },
  );
  return { service, repository, secrets, weixin };
}

class MemoryChannelRepository implements CommunicationChannelRepository {
  readonly values = new Map<CommunicationChannelKind, CommunicationChannelBinding>();
  async list(_ownerUserId: string) {
    return [...this.values.values()];
  }
  async get(_ownerUserId: string, kind: CommunicationChannelKind) {
    return this.values.get(kind) ?? null;
  }
  async save(value: CommunicationChannelBinding) {
    this.values.set(value.kind, value);
  }
  async clear(ownerUserId: string, kind: CommunicationChannelKind, updatedAt: Date) {
    this.values.set(kind, { ownerUserId, kind, status: "unbound", config: {}, updatedAt });
  }
}

class MemorySecrets implements SecretStore {
  readonly values = new Map<string, string>();
  async getStatus() {
    return { available: true, backend: "test", persistent: true };
  }
  async set(ref: string, value: string) {
    this.values.set(ref, value);
  }
  async get(ref: string) {
    return this.values.get(ref) ?? null;
  }
  async delete(ref: string) {
    this.values.delete(ref);
  }
}
