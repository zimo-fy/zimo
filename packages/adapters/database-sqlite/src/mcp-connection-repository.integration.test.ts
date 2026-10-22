import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { McpConnection } from "@zimo/domain";

import { ZimoDatabase } from "./index";
import { SQLiteMcpConnectionRepository } from "./mcp-connection-repository";

describe("SQLiteMcpConnectionRepository", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("persists generic connection metadata and the complete tool snapshot", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-mcp-db-test-"));
    const files = [
      "0001_initial.sql",
      "0002_models_and_conversations.sql",
      "0004_agent_skill_catalog.sql",
      "0008_workflow_definitions.sql",
      "0012_github_mcp_connection.sql",
      "0013_generic_mcp_registry.sql",
      "0015_mcp_connection_sources_and_oauth.sql",
      "0016_conversation_capability_bindings.sql",
      "0018_mcp_header_token_authentication.sql",
      "0020_mcp_catalog_api_key_authentication.sql",
    ];
    const migrations = await Promise.all(
      files.map(async (file, index) => ({
        version: [1, 2, 4, 8, 12, 13, 15, 16, 18, 20][index]!,
        name: file,
        sql: await readFile(new URL(`../../../../migrations/${file}`, import.meta.url), "utf8"),
      })),
    );
    const connection: McpConnection = {
      serverId: "github",
      name: "GitHub MCP",
      endpoint: "https://api.githubcopilot.com/mcp/readonly",
      source: "catalog",
      authentication: "bearer",
      secretRef: "opaque-secret-reference",
      serverName: "github-mcp-server",
      serverVersion: "1.2.3",
      tools: [
        {
          id: "mcp.github.get_me",
          name: "get_me",
          inputSchema: { type: "object", additionalProperties: false },
          annotations: { readOnly: true, openWorld: true },
          enabled: true,
        },
      ],
      connectedAt: new Date("2026-09-07T10:00:00.000Z"),
      updatedAt: new Date("2026-09-07T10:00:00.000Z"),
    };

    const databasePath = join(directory, "zimo.sqlite");
    const legacyDatabase = new ZimoDatabase(databasePath, migrations.slice(0, -1));
    const legacyRepository = new SQLiteMcpConnectionRepository(legacyDatabase);
    await legacyRepository.save(connection);
    legacyDatabase.sqlite.exec(`
      INSERT INTO prototype_definitions (
        id, kind, name, description, status, category, tags_json, icon, version, source,
        model_id, system_prompt, skill_ids_json, skill_package_id, skill_instructions,
        skill_checksum, permissions_json, capabilities_json, associations_json,
        installation_status, workflow_nodes_json, workflow_edges_json, documents_json,
        created_at, updated_at
      ) VALUES (
        'agent-for-mcp-migration', 'agent', 'Migration Agent', '', 'enabled', 'test', '[]',
        'bot', '1.0.0', 'local', NULL, '', '[]', NULL, NULL, NULL, '[]', '[]', '[]', NULL,
        '[]', '[]', '[]', '2026-09-07T10:00:00.000Z', '2026-09-07T10:00:00.000Z'
      );
      INSERT INTO workflow_definitions (
        id, name, description, status, category, tags_json, icon, version, source,
        workflow_nodes_json, workflow_edges_json, created_at, updated_at
      ) VALUES (
        'workflow-for-mcp-migration', 'Migration Workflow', '', 'enabled', 'test', '[]',
        'workflow', '1.0.0', 'local', '[]', '[]', '2026-09-07T10:00:00.000Z',
        '2026-09-07T10:00:00.000Z'
      );
      INSERT INTO agent_mcp_server_bindings (agent_id, server_id)
        VALUES ('agent-for-mcp-migration', 'github');
      INSERT INTO workflow_mcp_server_bindings (workflow_id, server_id)
        VALUES ('workflow-for-mcp-migration', 'github');
    `);
    legacyDatabase.close();

    const database = new ZimoDatabase(databasePath, migrations);
    const repository = new SQLiteMcpConnectionRepository(database);
    await expect(repository.get("github")).resolves.toEqual(connection);
    expect(
      database.sqlite
        .prepare("SELECT server_id FROM agent_mcp_server_bindings WHERE agent_id = ?")
        .get("agent-for-mcp-migration"),
    ).toEqual({ server_id: "github" });
    expect(
      database.sqlite
        .prepare("SELECT server_id FROM workflow_mcp_server_bindings WHERE workflow_id = ?")
        .get("workflow-for-mcp-migration"),
    ).toEqual({ server_id: "github" });
    const raw = database.sqlite
      .prepare("SELECT endpoint, source, secret_ref, tools_json FROM mcp_connections")
      .get() as { endpoint: string; source: string; secret_ref: string; tools_json: string };
    expect(raw.endpoint).toBe("https://api.githubcopilot.com/mcp/readonly");
    expect(raw.source).toBe("catalog");
    expect(raw.secret_ref).toBe("opaque-secret-reference");
    expect(raw.tools_json).toContain('"schemaVersion":2');

    const headerTokenConnection: McpConnection = {
      ...connection,
      serverId: "tencent-meeting",
      name: "腾讯会议",
      endpoint: "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1",
      authentication: "header_token",
      secretRef: "tencent-meeting-token-reference",
      serverName: "tencent-meeting-mcp",
      tools: connection.tools.map((tool) => ({
        ...tool,
        id: "mcp.tencent-meeting.get_me",
      })),
    };
    await repository.save(headerTokenConnection);
    await expect(repository.get("tencent-meeting")).resolves.toEqual(headerTokenConnection);

    const apiKeyConnection: McpConnection = {
      ...connection,
      serverId: "tencent-docs",
      name: "腾讯文档",
      endpoint: "https://docs.qq.com/openapi/mcp",
      authentication: "api_key",
      secretRef: "tencent-docs-token-reference",
      serverName: "tencent-docs-mcp",
      tools: connection.tools.map((tool) => ({
        ...tool,
        id: "mcp.tencent-docs.get_me",
      })),
    };
    await repository.save(apiKeyConnection);
    await expect(repository.get("tencent-docs")).resolves.toEqual(apiKeyConnection);

    await repository.clear("tencent-meeting");
    await expect(repository.get("tencent-meeting")).resolves.toBeNull();
    database.close();
  });
});
