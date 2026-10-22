import type {
  Clock,
  IdGenerator,
  SessionStore,
  UserMemory,
  UserMemoryKind,
  UserMemoryRepository,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

export class UserMemoryService {
  constructor(
    private readonly repository: UserMemoryRepository,
    private readonly sessions: SessionStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async list(): Promise<readonly UserMemory[]> {
    return this.repository.list(await this.owner());
  }

  async listActive(): Promise<readonly UserMemory[]> {
    return (await this.snapshotActive()).memories;
  }

  async snapshotActive(): Promise<{
    ownerUserId: string;
    memories: readonly UserMemory[];
  }> {
    const ownerUserId = await this.owner();
    return {
      ownerUserId,
      memories: (await this.repository.list(ownerUserId)).filter((item) => item.enabled),
    };
  }

  async saveFromModel(input: {
    kind: UserMemoryKind;
    content: string;
    expectedOwnerUserId: string;
  }): Promise<boolean> {
    const ownerUserId = await this.owner();
    if (ownerUserId !== input.expectedOwnerUserId) {
      throw memoryError("USER_MEMORY_OWNER_CHANGED", "账号已切换，用户记忆未保存。");
    }
    const content = input.content.trim();
    if (!content || content.length > 500) {
      throw memoryError("USER_MEMORY_INVALID", "记忆内容需要填写，且不能超过 500 字。");
    }
    const existing = await this.repository.list(ownerUserId);
    if (
      existing.some(
        (item) =>
          item.kind === input.kind &&
          item.content.trim().toLocaleLowerCase() === content.toLocaleLowerCase(),
      )
    ) {
      return false;
    }
    if (existing.length >= 100) {
      throw memoryError("USER_MEMORY_LIMIT", "最多保存 100 条记忆，请先整理已有内容。");
    }
    if ((await this.owner()) !== ownerUserId) {
      throw memoryError("USER_MEMORY_OWNER_CHANGED", "账号已切换，用户记忆未保存。");
    }
    const now = this.clock.now();
    await this.repository.create({
      id: this.ids.create(),
      ownerUserId,
      kind: input.kind,
      content,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return true;
  }

  async save(input: {
    id?: string | undefined;
    kind: UserMemoryKind;
    content: string;
    enabled: boolean;
  }): Promise<UserMemory> {
    const owner = await this.owner();
    const content = input.content.trim();
    if (!content || content.length > 500)
      throw memoryError("USER_MEMORY_INVALID", "记忆内容需要填写，且不能超过 500 字。");
    const now = this.clock.now();
    if (input.id) {
      const existing = await this.repository.get(owner, input.id);
      if (!existing) throw memoryError("USER_MEMORY_NOT_FOUND", "这条记忆不存在或不属于当前账号。");
      const updated = { kind: input.kind, content, enabled: input.enabled, updatedAt: now };
      if (!(await this.repository.update(owner, existing.id, updated)))
        throw memoryError("USER_MEMORY_NOT_FOUND", "这条记忆不存在或不属于当前账号。");
      return { ...existing, ...updated };
    }
    if ((await this.repository.list(owner)).length >= 100)
      throw memoryError("USER_MEMORY_LIMIT", "最多保存 100 条记忆，请先整理已有内容。");
    const memory: UserMemory = {
      id: this.ids.create(),
      ownerUserId: owner,
      kind: input.kind,
      content,
      enabled: input.enabled,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.create(memory);
    return memory;
  }

  async delete(id: string): Promise<void> {
    if (!(await this.repository.delete(await this.owner(), id)))
      throw memoryError("USER_MEMORY_NOT_FOUND", "这条记忆不存在或不属于当前账号。");
  }

  private async owner(): Promise<string> {
    const session = await this.sessions.get();
    if (!session) throw memoryError("AUTH_SESSION_REQUIRED", "请先登录后再使用用户记忆。");
    return session.externalUserId;
  }
}

function memoryError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "user", userMessage });
}
