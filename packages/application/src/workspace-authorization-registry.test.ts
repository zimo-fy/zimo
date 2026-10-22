import type {
  AuthSession,
  SessionStore,
  WorkspaceApprovalModePreferenceRepository,
  WorkspaceDirectoryAuthorization,
  WorkspaceDirectoryAuthorizationRepository,
  WorkspaceGrant,
} from "@zimo/domain";
import { describe, expect, it } from "vitest";

import { WorkspaceAuthorizationRegistry } from "./workspace-authorization-registry";

describe("WorkspaceAuthorizationRegistry", () => {
  it("isolates remembered directory roots by the signed-in account", async () => {
    const repository = new MemoryAuthorizationRepository();
    let owner = "account-1";
    const sessions = {
      get: async () => ({ externalUserId: owner }) as AuthSession,
    } as SessionStore;
    const registry = new WorkspaceAuthorizationRegistry(
      repository,
      sessions,
      { now: () => new Date("2026-09-16T00:01:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000010" },
    );
    const grant = {
      id: "00000000-0000-4000-8000-000000000001",
      conversationId: "00000000-0000-4000-8000-000000000002",
      rootRef: "/project",
      displayName: "project",
      kind: "external",
      mode: "auto_approve",
      status: "active",
      createdAt: new Date("2026-09-16T00:00:00.000Z"),
      updatedAt: new Date("2026-09-16T00:00:00.000Z"),
    } as WorkspaceGrant;

    await registry.remember(grant);
    expect(await registry.list()).toMatchObject([
      { ownerUserId: "account-1", rootRef: "/project" },
    ]);
    owner = "account-2";
    expect(await registry.list()).toEqual([]);
    owner = "account-1";
    const remembered = await registry.list();
    await expect(registry.revoke(remembered[0]!.id)).resolves.toMatchObject({
      rootRef: "/project",
    });
    expect(await registry.list()).toEqual([]);
  });

  it("persists the latest approval mode independently for each signed-in account", async () => {
    const approvalModes = new MemoryApprovalModeRepository();
    let owner = "account-1";
    const registry = new WorkspaceAuthorizationRegistry(
      new MemoryAuthorizationRepository(),
      {
        get: async () => ({ externalUserId: owner }) as AuthSession,
      } as SessionStore,
      { now: () => new Date("2026-09-18T01:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000010" },
      approvalModes,
    );

    expect(await registry.getApprovalMode()).toBe("ask");
    await registry.rememberApprovalMode("auto_approve");
    expect(await registry.getApprovalMode()).toBe("auto_approve");
    owner = "account-2";
    expect(await registry.getApprovalMode()).toBe("ask");
    await registry.rememberApprovalMode("ask");
    owner = "account-1";
    expect(await registry.getApprovalMode()).toBe("auto_approve");
  });
});

class MemoryAuthorizationRepository implements WorkspaceDirectoryAuthorizationRepository {
  private readonly values: WorkspaceDirectoryAuthorization[] = [];

  async listByOwner(ownerUserId: string) {
    return this.values.filter((value) => value.ownerUserId === ownerUserId);
  }

  async save(value: WorkspaceDirectoryAuthorization) {
    this.values.push(value);
  }

  async removeByOwnerAndRoot(ownerUserId: string, rootRef: string) {
    const index = this.values.findIndex(
      (value) => value.ownerUserId === ownerUserId && value.rootRef === rootRef,
    );
    if (index < 0) return false;
    this.values.splice(index, 1);
    return true;
  }
}

class MemoryApprovalModeRepository implements WorkspaceApprovalModePreferenceRepository {
  private readonly values = new Map<string, WorkspaceGrant["mode"]>();

  async getByOwner(ownerUserId: string) {
    return this.values.get(ownerUserId) ?? null;
  }

  async save(ownerUserId: string, mode: WorkspaceGrant["mode"]) {
    this.values.set(ownerUserId, mode);
  }
}
