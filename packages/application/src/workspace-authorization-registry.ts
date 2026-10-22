import type {
  Clock,
  IdGenerator,
  SessionStore,
  WorkspaceApprovalModePreferenceRepository,
  WorkspaceDirectoryAuthorization,
  WorkspaceDirectoryAuthorizationRepository,
  WorkspaceGrant,
  WorkspaceGrantMode,
} from "@zimo/domain";

export class WorkspaceAuthorizationRegistry {
  constructor(
    private readonly authorizations: WorkspaceDirectoryAuthorizationRepository,
    private readonly sessions: SessionStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly approvalModes?: WorkspaceApprovalModePreferenceRepository,
  ) {}

  async list(): Promise<readonly WorkspaceDirectoryAuthorization[]> {
    const owner = await this.currentOwner();
    return owner ? this.authorizations.listByOwner(owner) : [];
  }

  async remember(grant: WorkspaceGrant): Promise<void> {
    if (grant.kind !== "external") return;
    const ownerUserId = await this.currentOwner();
    if (!ownerUserId) return;
    await this.authorizations.save({
      id: this.ids.create(),
      ownerUserId,
      rootRef: grant.rootRef,
      displayName: grant.displayName,
      createdAt: grant.createdAt,
      updatedAt: this.clock.now(),
    });
  }

  async forget(rootRef: string): Promise<void> {
    const ownerUserId = await this.currentOwner();
    if (ownerUserId) {
      await this.authorizations.removeByOwnerAndRoot(ownerUserId, rootRef);
    }
  }

  async getApprovalMode(): Promise<WorkspaceGrantMode> {
    const ownerUserId = await this.currentOwner();
    if (!ownerUserId || !this.approvalModes) return "ask";
    return (await this.approvalModes.getByOwner(ownerUserId)) ?? "ask";
  }

  async rememberApprovalMode(mode: WorkspaceGrantMode): Promise<void> {
    const ownerUserId = await this.currentOwner();
    if (!ownerUserId || !this.approvalModes) return;
    await this.approvalModes.save(ownerUserId, mode, this.clock.now());
  }

  async revoke(id: string): Promise<WorkspaceDirectoryAuthorization | null> {
    const ownerUserId = await this.currentOwner();
    if (!ownerUserId) return null;
    const authorization = (await this.authorizations.listByOwner(ownerUserId)).find(
      (value) => value.id === id,
    );
    if (!authorization) return null;
    return (await this.authorizations.removeByOwnerAndRoot(ownerUserId, authorization.rootRef))
      ? authorization
      : null;
  }

  private async currentOwner(): Promise<string | undefined> {
    return (await this.sessions.get())?.externalUserId;
  }
}
