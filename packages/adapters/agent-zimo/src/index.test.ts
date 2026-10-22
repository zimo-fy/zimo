import { describe, expect, it, vi } from "vitest";

import type { AuthSession, SecretStore, SessionStore } from "@zimo/domain";

import { ZimoAgentCatalogGateway } from "./index";

const session: AuthSession = {
  id: "session" as AuthSession["id"],
  provider: "zimo-cloud",
  externalUserId: "user-1",
  account: "staff-1",
  displayName: "User",
  tokenSecretRef: "token-ref",
  createdAt: new Date("2026-09-08T00:00:00.000Z"),
  expiresAt: new Date("2026-09-09T00:00:00.000Z"),
};

describe("ZimoAgentCatalogGateway", () => {
  it("does not request the cloud agent catalog", async () => {
    const fetchImpl = vi.fn();
    const gateway = createGateway(fetchImpl);
    const signal = new AbortController().signal;

    await expect(gateway.list(signal)).rejects.toMatchObject({ code: "AGENT_CATALOG_DISABLED" });
    await expect(
      gateway.provision(
        {
          catalogId: "17",
          name: "招聘专家",
          description: "",
          category: "人力资源",
          icon: "招",
          version: "1.0.0",
        },
        "local-id",
        signal,
      ),
    ).rejects.toMatchObject({ code: "AGENT_CATALOG_DISABLED" });
    await expect(gateway.uninstall("remote-agent-17", signal)).rejects.toMatchObject({
      code: "AGENT_CATALOG_DISABLED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function createGateway(fetchImpl: typeof fetch) {
  const sessions: SessionStore = {
    get: async () => session,
    save: async () => undefined,
    clear: async () => undefined,
  };
  const secrets: SecretStore = {
    getStatus: async () => ({ available: true, persistent: true, backend: "test" }),
    get: async () => "token-value",
    set: async () => undefined,
    delete: async () => undefined,
  };
  return new ZimoAgentCatalogGateway(
    "https://zimo.example.com/dev-api/",
    sessions,
    secrets,
    fetchImpl,
  );
}
