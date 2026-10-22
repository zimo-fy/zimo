import type {
  AuthSession,
  SecretStore,
  WebSearchConfiguration,
  WebSearchConfigurationRepository,
  WebSearchGateway,
} from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import { WebAccessService } from "./web-access-service";

describe("WebAccessService", () => {
  it("stores API keys outside configuration and reuses the saved secret", async () => {
    const configurations = memoryConfigurations();
    const secrets = memorySecrets();
    const gateway = gatewayStub();
    const service = createService(configurations, secrets, gateway);

    await service.saveConfiguration({
      enabled: true,
      provider: "tavily",
      apiKey: "secret-canary",
    });
    const stored = await configurations.get("owner-1");

    expect(stored?.secretRef).toBe("generated-secret-ref");
    expect(JSON.stringify(stored)).not.toContain("secret-canary");
    expect(await secrets.get("generated-secret-ref")).toBe("secret-canary");
    await service.search({ query: "current news", count: 3 }, new AbortController().signal);
    expect(gateway.search).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "secret-canary", query: "current news", count: 3 }),
      expect.any(AbortSignal),
    );
  });

  it("requires HTTPS for a SearXNG configuration", async () => {
    const service = createService(memoryConfigurations(), memorySecrets(), gatewayStub());
    await expect(
      service.saveConfiguration({
        enabled: true,
        provider: "searxng",
        baseUrl: "http://localhost:8080",
      }),
    ).rejects.toThrow("HTTPS");
  });

  it("removes a saved secret when search is disabled", async () => {
    const configurations = memoryConfigurations();
    const secrets = memorySecrets();
    const service = createService(configurations, secrets, gatewayStub());
    await service.saveConfiguration({
      enabled: true,
      provider: "brave",
      apiKey: "secret-canary",
    });

    await service.saveConfiguration({ enabled: false, provider: "brave" });

    expect(await configurations.get("owner-1")).toBeNull();
    expect(await secrets.get("generated-secret-ref")).toBeNull();
  });

  it("uses the active run model for explicitly selected native search without saving another key", async () => {
    const configurations = memoryConfigurations();
    const secrets = memorySecrets();
    const native = {
      search: vi.fn(async () => ({
        results: [
          {
            title: "Source",
            url: "https://example.org",
            snippet: "summary",
            source: "example.org",
          },
        ],
        errorCount: 0,
      })),
    };
    const service = new WebAccessService(
      configurations,
      { get: async () => ({ externalUserId: "owner-1" }) as AuthSession } as never,
      secrets,
      gatewayStub(),
      { now: () => new Date() },
      { create: () => "unused" },
      native,
    );
    await service.saveConfiguration({ enabled: true, provider: "model_native" });
    expect((await configurations.get("owner-1"))?.secretRef).toBeUndefined();
    const connection = {
      baseUrl: "https://gateway.example/v1",
      apiKey: "secret-canary",
      modelName: "active-model",
    };
    await service.search({ query: "query", count: 1 }, new AbortController().signal, connection);
    expect(native.search).toHaveBeenCalledWith(
      connection,
      { query: "query", count: 1 },
      expect.any(AbortSignal),
    );
  });

  it("uses the default model when a search run has no active connection", async () => {
    const native = { search: vi.fn(async () => ({ results: [], errorCount: 0 })) };
    const connection = {
      baseUrl: "https://gateway.example/v1",
      apiKey: "secret-canary",
      modelName: "default-model",
    };
    const service = new WebAccessService(
      memoryConfigurations(),
      { get: async () => ({ externalUserId: "owner-1" }) as AuthSession } as never,
      memorySecrets(),
      gatewayStub(),
      { now: () => new Date() },
      { create: () => "unused" },
      native,
      async () => connection,
    );
    await service.saveConfiguration({ enabled: true, provider: "model_native" });
    await service.search(
      { query: "query", count: 1, freshness: "day" },
      new AbortController().signal,
    );
    expect(native.search).toHaveBeenCalledWith(
      connection,
      { query: expect.stringContaining("最近一天"), count: 1 },
      expect.any(AbortSignal),
    );
  });
});

function createService(
  configurations: WebSearchConfigurationRepository,
  secrets: SecretStore,
  gateway: WebSearchGateway,
) {
  return new WebAccessService(
    configurations,
    { get: async () => ({ externalUserId: "owner-1" }) as AuthSession } as never,
    secrets,
    gateway,
    { now: () => new Date("2026-09-20T00:00:00.000Z") },
    { create: () => "generated-secret-ref" },
  );
}

function memoryConfigurations(): WebSearchConfigurationRepository {
  const values = new Map<string, WebSearchConfiguration>();
  return {
    get: async (owner) => values.get(owner) ?? null,
    save: async (configuration) => {
      values.set(configuration.ownerUserId, configuration);
    },
    delete: async (owner) => {
      values.delete(owner);
    },
  };
}

function memorySecrets(): SecretStore {
  const values = new Map<string, string>();
  return {
    getStatus: async () => ({ available: true, backend: "memory", persistent: true }),
    set: async (ref, value) => {
      values.set(ref, value);
    },
    get: async (ref) => values.get(ref) ?? null,
    delete: async (ref) => {
      values.delete(ref);
    },
  };
}

function gatewayStub(): WebSearchGateway {
  return {
    search: vi.fn(async () => []),
    fetch: vi.fn(async ({ url }) => ({ url, content: "content" })),
  };
}
