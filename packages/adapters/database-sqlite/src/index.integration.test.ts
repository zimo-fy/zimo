import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type {
  AuthSession,
  AgentRunRecord,
  Conversation,
  IntentRouteRecord,
  ModelProviderWithModels,
} from "@zimo/domain";

import {
  SQLiteAppSettingsStore,
  SQLiteAgentRunRepository,
  SQLiteConversationRepository,
  SQLiteIntentRouteRepository,
  SQLiteModelRepository,
  SQLitePrototypeRepository,
  SQLiteSessionStore,
  ZimoDatabase,
} from "./index";

function withGroundingColumns(sql: string): string {
  return `${sql}
    ALTER TABLE conversations ADD COLUMN knowledge_base_ids_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE conversations ADD COLUMN agent_id TEXT;
    ALTER TABLE conversations ADD COLUMN skill_ids_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE conversations ADD COLUMN workflow_id TEXT;
    ALTER TABLE conversations ADD COLUMN mcp_tool_ids_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE conversations ADD COLUMN browser_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE messages ADD COLUMN knowledge_citations_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE messages ADD COLUMN steps_json TEXT;
    ALTER TABLE messages ADD COLUMN model_display_name TEXT;`;
}

function withKnowledgeBindingColumn(sql: string): string {
  return `${sql}
    ALTER TABLE prototype_definitions ADD COLUMN knowledge_base_ids_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE prototype_definitions ADD COLUMN agent_catalog_id TEXT;
    ALTER TABLE prototype_definitions ADD COLUMN agent_remote_id TEXT;`;
}

describe("SQLite adapters", () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("applies migrations idempotently and restores session/settings", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-db-test-"));
    const path = join(directory, "zimo.sqlite");
    const sql = await readFile(
      new URL("../../../../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    );
    const authSql = await readFile(
      new URL("../../../../migrations/0014_remote_auth_session.sql", import.meta.url),
      "utf8",
    );
    const migration = [
      { version: 1, name: "initial", sql },
      { version: 14, name: "remote-auth-session", sql: authSql },
    ] as const;
    const first = new ZimoDatabase(path, migration);
    const sessionStore = new SQLiteSessionStore(first);
    const settingsStore = new SQLiteAppSettingsStore(first);
    const session: AuthSession = {
      id: "00000000-0000-4000-8000-000000000001" as AuthSession["id"],
      provider: "zimo-cloud",
      externalUserId: "remote-user-1",
      account: "staff-01",
      email: "staff@example.com",
      displayName: "Demo",
      tokenSecretRef: "opaque-auth-token-reference",
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      expiresAt: new Date("2026-09-09T00:00:00.000Z"),
    };
    await sessionStore.save(session);
    await settingsStore.save({ appearance: "light", logLevel: "debug", reduceMotion: true });
    first.close();

    const reopened = new ZimoDatabase(path, migration);
    expect(await new SQLiteSessionStore(reopened).get()).toEqual(session);
    expect(await new SQLiteAppSettingsStore(reopened).get()).toEqual({
      appearance: "light",
      logLevel: "debug",
      reduceMotion: true,
    });
    const migrationCount = reopened.sqlite
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };
    expect(migrationCount.count).toBe(2);
    reopened.close();
  });

  it("reconciles the legacy document migration version collision", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-db-migration-collision-test-"));
    const path = join(directory, "zimo.sqlite");
    const documentMigrations = [
      { version: 21, name: "document-artifacts", sql: "CREATE TABLE doc_a (id TEXT);" },
      {
        version: 22,
        name: "document-revision-creators",
        sql: "CREATE TABLE doc_b (id TEXT);",
      },
      {
        version: 23,
        name: "document-message-revisions",
        sql: "CREATE TABLE doc_c (id TEXT);",
      },
    ] as const;
    const legacy = new ZimoDatabase(path, documentMigrations);
    legacy.close();

    const reopened = new ZimoDatabase(path, [
      { version: 21, name: "weixin-assistant-channel", sql: "CREATE TABLE weixin_a (id TEXT);" },
      ...documentMigrations.map((migration) => ({
        ...migration,
        version: migration.version + 1,
      })),
    ]);
    const rows = reopened.sqlite
      .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
      .all();
    expect(rows).toEqual([
      { version: 21, name: "weixin-assistant-channel" },
      { version: 22, name: "document-artifacts" },
      { version: 23, name: "document-revision-creators" },
      { version: 24, name: "document-message-revisions" },
    ]);
    reopened.close();
  });

  it("persists model metadata and restores conversations without storing API keys", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-chat-db-test-"));
    const path = join(directory, "zimo.sqlite");
    const initialSql = await readFile(
      new URL("../../../../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    );
    const modelsSql = await readFile(
      new URL("../../../../migrations/0002_models_and_conversations.sql", import.meta.url),
      "utf8",
    );
    const pinningSql = await readFile(
      new URL("../../../../migrations/0032_conversation_pinning.sql", import.meta.url),
      "utf8",
    );
    const database = new ZimoDatabase(path, [
      { version: 1, name: "initial", sql: initialSql },
      { version: 2, name: "models-and-conversations", sql: withGroundingColumns(modelsSql) },
      { version: 3, name: "conversation-pinning", sql: pinningSql },
    ]);
    const models = new SQLiteModelRepository(database);
    const conversations = new SQLiteConversationRepository(database);
    const now = new Date("2026-09-03T00:00:00.000Z");
    const provider = providerFixture(now);
    await models.saveProvider(provider);
    await models.setDefaultModelId(provider.models[0]!.id);
    const conversation: Conversation = {
      id: "00000000-0000-4000-8000-000000000103" as Conversation["id"],
      title: "持久化测试",
      modelId: provider.models[0]!.id,
      skillIds: [],
      knowledgeBaseIds: [],
      mcpToolIds: [],
      browserEnabled: false,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await conversations.create(conversation);
    const agentId = "00000000-0000-4000-8000-000000000104" as never;
    const skillId = "00000000-0000-4000-8000-000000000105" as never;
    const workflowId = "00000000-0000-4000-8000-000000000106" as never;
    const mcpToolId = "mcp.github.search_repositories";
    await conversations.changeCapabilities(
      conversation.id,
      {
        ...conversation,
        agentId,
        skillIds: [skillId],
        workflowId,
        mcpToolIds: [mcpToolId],
        browserEnabled: true,
      },
      now,
    );
    const boundConversation = {
      ...conversation,
      agentId,
      skillIds: [skillId],
      workflowId,
      mcpToolIds: [mcpToolId],
      browserEnabled: true,
    };

    expect((await models.listProviders())[0]).toEqual(provider);
    expect(await models.getDefaultModelId()).toBe(provider.models[0]!.id);
    expect(await conversations.getById(conversation.id)).toEqual(boundConversation);
    expect(await conversations.hasCapabilityReference("agent", agentId)).toBe(true);
    expect(await conversations.hasCapabilityReference("skill", skillId)).toBe(true);
    expect(await conversations.hasCapabilityReference("workflow", workflowId)).toBe(true);
    expect(await conversations.hasCapabilityReference("mcp-server", "github")).toBe(true);
    await conversations.setPinned(conversation.id, true);
    expect((await conversations.list())[0]?.isPinned).toBe(true);
    expect(await readFile(path, "latin1")).not.toContain("sk-phase-two-canary");
    database.close();

    const reopened = new ZimoDatabase(path, [
      { version: 1, name: "initial", sql: initialSql },
      { version: 2, name: "models-and-conversations", sql: withGroundingColumns(modelsSql) },
      { version: 3, name: "conversation-pinning", sql: pinningSql },
    ]);
    expect(await new SQLiteConversationRepository(reopened).getById(conversation.id)).toEqual(
      boundConversation,
    );
    reopened.close();
  });

  it("persists route metadata without the input body", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-route-db-test-"));
    const path = join(directory, "zimo.sqlite");
    const [initialSql, modelsSql, routesSql] = await Promise.all([
      readFile(new URL("../../../../migrations/0001_initial.sql", import.meta.url), "utf8"),
      readFile(
        new URL("../../../../migrations/0002_models_and_conversations.sql", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../../../../migrations/0003_intent_routes.sql", import.meta.url), "utf8"),
    ]);
    const database = new ZimoDatabase(path, [
      { version: 1, name: "initial", sql: initialSql },
      { version: 2, name: "models-and-conversations", sql: withGroundingColumns(modelsSql) },
      { version: 3, name: "intent-routes", sql: routesSql },
    ]);
    const now = new Date("2026-09-03T00:00:00.000Z");
    const provider = providerFixture(now);
    await new SQLiteModelRepository(database).saveProvider(provider);
    const conversation: Conversation = {
      id: "00000000-0000-4000-8000-000000000203" as Conversation["id"],
      title: "Route",
      modelId: provider.models[0]!.id,
      skillIds: [],
      knowledgeBaseIds: [],
      mcpToolIds: [],
      browserEnabled: false,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await new SQLiteConversationRepository(database).create(conversation);
    const record: IntentRouteRecord = {
      id: "00000000-0000-4000-8000-000000000204",
      conversationId: conversation.id,
      runId: "00000000-0000-4000-8000-000000000205" as IntentRouteRecord["runId"],
      inputFingerprint: "sha256-safe-fingerprint",
      inputLength: 28,
      intent: "chat",
      confidence: 0.42,
      durationMs: 19,
      didFallback: true,
      fallbackReason: "low_confidence",
      createdAt: now,
    };
    await new SQLiteIntentRouteRepository(database).save(record);
    const row = database.sqlite
      .prepare("SELECT * FROM intent_route_records WHERE run_id = ?")
      .get(record.runId) as Record<string, unknown>;
    expect(row).toMatchObject({
      input_fingerprint: "sha256-safe-fingerprint",
      input_length: 28,
      did_fallback: 1,
    });
    expect(Object.keys(row)).not.toContain("input_text");
    expect(await readFile(path, "latin1")).not.toContain("sensitive input body");
    database.close();
  });

  it("persists Agent and installed instruction Skill definitions", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-prototype-db-test-"));
    const path = join(directory, "zimo.sqlite");
    const sql = await readFile(
      new URL("../../../../migrations/0004_agent_skill_catalog.sql", import.meta.url),
      "utf8",
    );
    const migration = [
      { version: 4, name: "agent-skill-catalog", sql: withKnowledgeBindingColumn(sql) },
    ] as const;
    const first = new ZimoDatabase(path, migration);
    const skills = new SQLitePrototypeRepository(first, "skill");
    const agents = new SQLitePrototypeRepository(first, "agent");
    const now = new Date("2026-09-03T12:00:00.000Z");
    await skills.save({
      id: "00000000-0000-4000-8000-000000000301" as never,
      kind: "skill",
      name: "本地摘要",
      description: "指令型 Skill",
      status: "enabled",
      category: "写作",
      tags: ["摘要"],
      icon: "摘",
      version: "1.0.0",
      source: "本地 instruction Skill",
      skillPackageId: "local.example.summary",
      skillInstructions: "只总结用户输入。",
      skillChecksum: "checksum",
      permissions: ["context:user-input"],
      capabilities: ["指令型 Skill"],
      associations: [],
      installationStatus: "installed",
      workflowNodes: [],
      workflowEdges: [],
      documents: [],
      createdAt: now,
      updatedAt: now,
    });
    await agents.save({
      id: "00000000-0000-4000-8000-000000000302" as never,
      kind: "agent",
      name: "云端招聘专家",
      description: "已安装 Agent",
      status: "enabled",
      category: "人力资源",
      tags: [],
      icon: "招",
      version: "1.0.0",
      source: "Zimo Agent Store",
      systemPrompt: "只根据候选人材料分析。",
      agentCatalogId: "catalog-17",
      agentRemoteId: "remote-agent-17",
      permissions: [],
      capabilities: [],
      associations: [],
      installationStatus: "installed",
      workflowNodes: [],
      workflowEdges: [],
      documents: [],
      createdAt: now,
      updatedAt: now,
    });
    first.close();

    const reopened = new ZimoDatabase(path, migration);
    expect(await new SQLitePrototypeRepository(reopened, "skill").list()).toEqual([
      expect.objectContaining({
        name: "本地摘要",
        skillPackageId: "local.example.summary",
        skillInstructions: "只总结用户输入。",
      }),
    ]);
    expect(await new SQLitePrototypeRepository(reopened, "agent").list()).toEqual([
      expect.objectContaining({
        name: "云端招聘专家",
        agentCatalogId: "catalog-17",
        agentRemoteId: "remote-agent-17",
      }),
    ]);
    reopened.close();
  });

  it("records Agent run lifecycle without prompt or message bodies", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-agent-run-db-test-"));
    const path = join(directory, "zimo.sqlite");
    const [initialSql, modelsSql, catalogSql, runsSql] = await Promise.all([
      readFile(new URL("../../../../migrations/0001_initial.sql", import.meta.url), "utf8"),
      readFile(
        new URL("../../../../migrations/0002_models_and_conversations.sql", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../../../../migrations/0004_agent_skill_catalog.sql", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../../../../migrations/0005_agent_runs.sql", import.meta.url), "utf8"),
    ]);
    const database = new ZimoDatabase(path, [
      { version: 1, name: "initial", sql: initialSql },
      { version: 2, name: "models", sql: withGroundingColumns(modelsSql) },
      { version: 4, name: "catalog", sql: withKnowledgeBindingColumn(catalogSql) },
      {
        version: 5,
        name: "agent-runs",
        sql: `${runsSql}\nALTER TABLE agent_run_records ADD COLUMN knowledge_base_ids_json TEXT NOT NULL DEFAULT '[]';`,
      },
    ]);
    const now = new Date("2026-09-03T12:00:00.000Z");
    const provider = providerFixture(now);
    await new SQLiteModelRepository(database).saveProvider(provider);
    const conversation: Conversation = {
      id: "00000000-0000-4000-8000-000000000401" as Conversation["id"],
      title: "Agent run",
      modelId: provider.models[0]!.id,
      skillIds: [],
      knowledgeBaseIds: [],
      mcpToolIds: [],
      browserEnabled: false,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await new SQLiteConversationRepository(database).create(conversation);
    const agentId = "00000000-0000-4000-8000-000000000402" as never;
    await new SQLitePrototypeRepository(database, "agent").save({
      id: agentId,
      kind: "agent",
      name: "测试 Agent",
      description: "",
      status: "enabled",
      category: "测试",
      tags: [],
      icon: "测",
      version: "1.0.0",
      source: "测试",
      permissions: [],
      capabilities: [],
      associations: [],
      workflowNodes: [],
      workflowEdges: [],
      documents: [],
      createdAt: now,
      updatedAt: now,
    });
    const run: AgentRunRecord = {
      id: "00000000-0000-4000-8000-000000000403" as AgentRunRecord["id"],
      conversationId: conversation.id,
      agentId,
      modelId: provider.models[0]!.id,
      skillIds: [],
      knowledgeBaseIds: [],
      status: "running",
      createdAt: now,
      updatedAt: now,
    };
    const runs = new SQLiteAgentRunRepository(database);
    await runs.start(run);
    await runs.finish(run.id, "completed", now);
    const row = database.sqlite
      .prepare("SELECT * FROM agent_run_records WHERE id = ?")
      .get(run.id) as Record<string, unknown>;
    expect(row).toMatchObject({ status: "completed", skill_ids_json: "[]" });
    expect(Object.keys(row)).not.toContain("prompt");
    expect(Object.keys(row)).not.toContain("message_body");
    database.close();
  });
});

function providerFixture(now: Date): ModelProviderWithModels {
  const providerId =
    "00000000-0000-4000-8000-000000000101" as ModelProviderWithModels["provider"]["id"];
  return {
    provider: {
      id: providerId,
      name: "Fake Provider",
      baseUrl: "https://example.test/v1",
      secretRef: "00000000-0000-4000-8000-000000000199",
      keyHint: "••••nary",
      kind: "openai-compatible",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    models: [
      {
        id: "00000000-0000-4000-8000-000000000102" as ModelProviderWithModels["models"][number]["id"],
        providerId,
        name: "fake-model",
        displayName: "Fake Model",
        capabilities: {
          streaming: true,
          toolCalling: false,
          structuredOutput: false,
          vision: false,
          reasoning: false,
          promptCaching: false,
        },
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}
