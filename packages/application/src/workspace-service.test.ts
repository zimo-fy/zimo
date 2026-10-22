import { describe, expect, it, vi } from "vitest";
import type {
  Conversation,
  ConversationId,
  ConversationRepository,
  WorkspaceDirectoryReader,
  WorkspaceGrant,
  WorkspaceGrantRepository,
  WorkspaceDirectoryWriter,
  WorkspaceCommandExecutor,
} from "@zimo/domain";

import { WorkspaceService } from "./workspace-service";
import type { WorkspaceAuthorizationRegistry } from "./workspace-authorization-registry";

describe("WorkspaceService", () => {
  it("creates one managed workspace for every conversation", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const ensure = vi.fn(async () => ({
      rootRef: "/managed/conversation/files",
      displayName: "Zimo Workspace",
    }));
    const service = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date("2026-09-15T00:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000003" },
      undefined,
      { ensure },
    );

    expect(await service.list(CONVERSATION_ID)).toMatchObject([
      { kind: "managed", mode: "ask", displayName: "Zimo Workspace" },
    ]);
    expect(await service.list(CONVERSATION_ID)).toHaveLength(1);
    expect(ensure).toHaveBeenCalledTimes(2);
  });

  it("uses the account preference for a new conversation and remembers later changes", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const authorizationRegistry = {
      getApprovalMode: vi.fn(async () => "auto_approve" as const),
      rememberApprovalMode: vi.fn(async () => undefined),
    } as unknown as WorkspaceAuthorizationRegistry;
    const service = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date("2026-09-18T01:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000003" },
      undefined,
      {
        ensure: async () => ({
          rootRef: "/managed/conversation/files",
          displayName: "Zimo Workspace",
        }),
      },
      authorizationRegistry,
    );

    expect(await service.list(CONVERSATION_ID)).toMatchObject([{ mode: "auto_approve" }]);
    await service.changeMode(CONVERSATION_ID, "ask");
    expect(authorizationRegistry.rememberApprovalMode).toHaveBeenCalledWith("ask");
    expect(await service.list(CONVERSATION_ID)).toMatchObject([{ mode: "ask" }]);
  });

  it("does not overwrite an existing conversation with a newer account preference", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const managedRoots = {
      ensure: async () => ({
        rootRef: "/managed/conversation/files",
        displayName: "Zimo Workspace",
      }),
    };
    const original = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date("2026-09-18T01:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000003" },
      undefined,
      managedRoots,
    );
    expect(await original.list(CONVERSATION_ID)).toMatchObject([{ mode: "ask" }]);

    const reopened = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date("2026-09-18T02:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000004" },
      undefined,
      managedRoots,
      {
        getApprovalMode: vi.fn(async () => "auto_approve" as const),
      } as unknown as WorkspaceAuthorizationRegistry,
    );
    expect(await reopened.list(CONVERSATION_ID)).toMatchObject([{ mode: "ask" }]);
  });

  it("binds a canonical directory once and exposes controlled workspace tools", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const service = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date("2026-09-15T00:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000002" },
    );

    const first = await service.attach(CONVERSATION_ID, "/selected/project");
    const duplicate = await service.attach(CONVERSATION_ID, "/selected/project");
    expect(duplicate.id).toBe(first.id);
    expect(await service.list(CONVERSATION_ID)).toHaveLength(1);
    expect(await service.prepareModelAccess(CONVERSATION_ID)).toMatchObject({
      toolIds: [
        "zimo.workspace.list",
        "zimo.workspace.search",
        "zimo.workspace.read",
        "zimo.workspace.create",
        "zimo.workspace.mkdir",
        "zimo.workspace.patch",
        "zimo.workspace.delete",
      ],
    });
  });

  it("rejects a grant from another conversation during read", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const service = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date() },
      { create: () => "00000000-0000-4000-8000-000000000002" },
    );
    const grant = await service.attach(CONVERSATION_ID, "/selected/project");
    await expect(
      service.read(
        "00000000-0000-4000-8000-000000000099",
        grant.id,
        { path: "src/app.ts", cursor: 0, maxCharacters: 500 },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "WORKSPACE_NOT_FOUND" });
  });

  it("scopes mutations to the current conversation and delegates only the grant root", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const patch = vi.fn(async () => ({
      path: "src/app.ts",
      operation: "patched" as const,
      checksum: "b".repeat(64),
      sizeBytes: 10,
      lineCount: 1,
      changeCount: 1,
    }));
    const writer = {
      create: vi.fn(),
      patch,
      delete: vi.fn(),
    } as unknown as WorkspaceDirectoryWriter;
    const service = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date() },
      { create: () => "00000000-0000-4000-8000-000000000002" },
      writer,
    );
    const grant = await service.attach(CONVERSATION_ID, "/selected/project");
    await service.patchFile(
      CONVERSATION_ID,
      grant.id,
      {
        path: "src/app.ts",
        expectedChecksum: "a".repeat(64),
        operations: [{ search: "old", replacement: "new", replaceAll: false }],
      },
      new AbortController().signal,
    );
    expect(patch).toHaveBeenCalledWith(
      "/canonical/project",
      expect.objectContaining({ path: "src/app.ts" }),
      expect.any(AbortSignal),
    );
  });

  it("exposes and delegates host commands only when an executor is configured", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const execute = vi.fn(async () => ({
      cwd: ".",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      timedOut: false,
      truncated: false,
      durationMs: 1,
    }));
    const service = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date() },
      { create: () => "00000000-0000-4000-8000-000000000002" },
      undefined,
      undefined,
      undefined,
      { execute } as WorkspaceCommandExecutor,
    );
    const grant = await service.attach(CONVERSATION_ID, "/selected/project");

    expect((await service.prepareModelAccess(CONVERSATION_ID)).toolIds).toContain(
      "zimo.workspace.run_command",
    );
    await expect(
      service.planCommand(CONVERSATION_ID, grant.id, "", "pnpm test"),
    ).resolves.toMatchObject({
      kind: "command",
      risk: "high",
      summary: "在 project 运行终端命令",
      command: "pnpm test",
      sandboxed: false,
    });
    await service.runCommand(
      CONVERSATION_ID,
      grant.id,
      { cwd: "", command: "pnpm test", timeoutMs: 120_000 },
      new AbortController().signal,
    );
    expect(execute).toHaveBeenCalledWith(
      {
        rootRef: "/canonical/project",
        cwd: "",
        command: "pnpm test",
        timeoutMs: 120_000,
      },
      expect.any(AbortSignal),
    );
  });

  it("redirects commands from the managed output workspace to the selected project", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const execute = vi.fn(async () => ({
      cwd: ".",
      exitCode: 0,
      stdout: "/canonical/project",
      stderr: "",
      timedOut: false,
      truncated: false,
      durationMs: 1,
    }));
    const ids = ["00000000-0000-4000-8000-000000000003", "00000000-0000-4000-8000-000000000004"];
    let nextId = 0;
    const service = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date("2026-09-18T00:00:00.000Z") },
      {
        create: () => {
          const id = ids[nextId];
          nextId += 1;
          if (!id) throw new Error("Unexpected ID request");
          return id;
        },
      },
      undefined,
      {
        ensure: async () => ({
          rootRef: "/managed/conversation/files",
          displayName: "Zimo Workspace",
        }),
      },
      undefined,
      { execute } as WorkspaceCommandExecutor,
    );
    const managed = (await service.list(CONVERSATION_ID)).find((grant) => grant.kind === "managed");
    if (!managed) throw new Error("Managed workspace was not created");
    const external = await service.attach(CONVERSATION_ID, "/selected/project");

    const access = await service.prepareModelAccess(CONVERSATION_ID);
    expect(access.context).toContain("名称=Zimo Workspace；类型=Zimo 内部输出目录");
    expect(access.context).toContain("名称=project；类型=用户项目目录");
    await expect(
      service.planCommand(CONVERSATION_ID, managed.id, "", "git status --short"),
    ).resolves.toMatchObject({
      workspaceId: external.id,
      workspaceLabel: "project",
      relativeTarget: ".",
    });
    await service.runCommand(
      CONVERSATION_ID,
      managed.id,
      { cwd: "", command: "git status --short", timeoutMs: 120_000 },
      new AbortController().signal,
    );
    expect(execute).toHaveBeenCalledWith(
      {
        rootRef: "/canonical/project",
        cwd: "",
        command: "git status --short",
        timeoutMs: 120_000,
      },
      expect.any(AbortSignal),
    );
  });

  it("records an approved absolute write as an external conversation grant", async () => {
    const grants = new MemoryWorkspaceGrantRepository();
    const create = vi.fn(async () => ({
      path: "file.txt",
      operation: "created" as const,
      checksum: "b".repeat(64),
      sizeBytes: 4,
      lineCount: 1,
      changeCount: 1,
    }));
    const service = new WorkspaceService(
      grants,
      directoryReader,
      conversationRepository,
      { now: () => new Date("2026-09-16T00:00:00.000Z") },
      { create: () => "00000000-0000-4000-8000-000000000004" },
      { create, patch: vi.fn(), delete: vi.fn() } as unknown as WorkspaceDirectoryWriter,
    );

    const before = await service.planAbsoluteMutation(CONVERSATION_ID, "/external/file.txt", {
      kind: "file_write",
      risk: "low",
      verb: "创建",
    });
    expect(before.workspaceId).toBeUndefined();
    await service.createAbsoluteFile(
      CONVERSATION_ID,
      "/external/file.txt",
      "text",
      new AbortController().signal,
    );
    const grantsAfter = await service.list(CONVERSATION_ID);
    expect(grantsAfter).toMatchObject([{ kind: "external", rootRef: "/external" }]);
    expect(create).toHaveBeenCalledWith(
      "/external",
      { path: "file.txt", content: "text" },
      expect.any(AbortSignal),
    );
  });
});

const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";
const conversation: Conversation = {
  id: CONVERSATION_ID as ConversationId,
  title: "Workspace",
  modelId: "00000000-0000-4000-8000-000000000010" as Conversation["modelId"],
  skillIds: [],
  knowledgeBaseIds: [],
  mcpToolIds: [],
  browserEnabled: false,
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const conversationRepository = {
  getById: async (id: ConversationId) => (id === conversation.id ? conversation : null),
} as ConversationRepository;

const directoryReader: WorkspaceDirectoryReader = {
  inspectRoot: async () => ({ rootRef: "/canonical/project", displayName: "project" }),
  list: async () => ({ path: "", entries: [] }),
  search: async () => ({ matches: [], truncated: false }),
  read: async (_root, input) => ({
    path: input.path,
    content: "content",
    checksum: "a".repeat(64),
    sizeBytes: 7,
    truncated: false,
  }),
  listAbsolute: async (path) => ({ path, entries: [] }),
  searchAbsolute: async () => ({ matches: [], truncated: false }),
  readAbsolute: async (path) => ({
    path,
    content: "content",
    checksum: "a".repeat(64),
    sizeBytes: 7,
    truncated: false,
  }),
  resolveAbsoluteWriteTarget: async (absolutePath) => ({
    rootRef: "/external",
    displayName: "external",
    relativePath: "file.txt",
    displayTarget: absolutePath,
  }),
};

class MemoryWorkspaceGrantRepository implements WorkspaceGrantRepository {
  private readonly values = new Map<string, WorkspaceGrant>();

  async listByConversation(conversationId: ConversationId) {
    return [...this.values.values()].filter((value) => value.conversationId === conversationId);
  }

  async getById(id: string) {
    return this.values.get(id) ?? null;
  }

  async save(grant: WorkspaceGrant) {
    this.values.set(grant.id, grant);
  }

  async updateMode(conversationId: ConversationId, mode: WorkspaceGrant["mode"], at: Date) {
    let changes = 0;
    for (const [id, grant] of this.values) {
      if (grant.conversationId !== conversationId) continue;
      this.values.set(id, { ...grant, mode, updatedAt: at });
      changes += 1;
    }
    return changes;
  }

  async remove(conversationId: ConversationId, id: string) {
    const grant = this.values.get(id);
    return grant?.conversationId === conversationId ? this.values.delete(id) : false;
  }

  async removeExternalByRoot(rootRef: string) {
    let changes = 0;
    for (const [id, grant] of this.values) {
      if (grant.kind !== "external" || grant.rootRef !== rootRef) continue;
      this.values.delete(id);
      changes += 1;
    }
    return changes;
  }
}
