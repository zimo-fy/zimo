import { describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";

import type { AuthSession, SecretStore, SessionStore } from "@zimo/domain";

import { ZimoSkillCatalogGateway } from "./index";

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

describe("ZimoSkillCatalogGateway", () => {
  it("does not request the cloud skill catalog", async () => {
    const fetchImpl = vi.fn();

    await expect(createGateway(fetchImpl).list(new AbortController().signal)).rejects.toMatchObject(
      { code: "SKILL_CATALOG_DISABLED" },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("downloads the complete reviewed package and never forwards the account token", async () => {
    const archive = zipSync({
      "wrapped/SKILL.md": strToU8("# 招聘助手\n\n请根据岗位要求筛选候选人。"),
      "wrapped/scripts/run.sh": strToU8("echo should-not-run"),
    });
    const fetchImpl = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      return new Response(archive, { status: 200 });
    });
    const gateway = createGateway(fetchImpl);

    const result = await gateway.download(
      {
        catalogId: "7",
        packageId: "zimo.market.123456789012345678901234",
        name: "招聘助手",
        description: "筛选候选人",
        category: "人力资源",
        version: "1.0.0",
        source: "企业技能",
        downloadUrl: "https://files.example.com/recruiting.zip",
      },
      new AbortController().signal,
    );

    expect(result.instructions).toContain("筛选候选人");
    expect(result.instructions).not.toContain("should-not-run");
    expect(result.files.map((file) => file.path)).toEqual(["SKILL.md", "scripts/run.sh"]);
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
  return new ZimoSkillCatalogGateway(
    "https://zimo.example.com/dev-api/",
    sessions,
    secrets,
    fetchImpl,
    async () => undefined,
  );
}
