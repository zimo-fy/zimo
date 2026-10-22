import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SQLiteKnowledgeRepository,
  SQLiteMcpConnectionRepository,
  SQLitePrototypeRepository,
  SQLiteWorkflowRepository,
  ZimoDatabase,
} from "./index";

const migrationFiles = [
  "0001_initial.sql",
  "0002_models_and_conversations.sql",
  "0003_intent_routes.sql",
  "0004_agent_skill_catalog.sql",
  "0005_agent_runs.sql",
  "0006_knowledge_retrieval.sql",
  "0007_conversation_knowledge_grounding.sql",
  "0008_workflow_definitions.sql",
  "0009_conversation_agent_binding.sql",
  "0010_communication_channels.sql",
  "0011_email_address_binding.sql",
  "0012_github_mcp_connection.sql",
  "0013_generic_mcp_registry.sql",
  "0014_remote_auth_session.sql",
  "0015_mcp_connection_sources_and_oauth.sql",
  "0016_conversation_capability_bindings.sql",
  "0017_agent_marketplace.sql",
  "0018_mcp_header_token_authentication.sql",
  "0019_capability_deletion_cascade.sql",
] as const;

describe("capability deletion cascade", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("deletes referenced capabilities without leaving active bindings", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-capability-delete-"));
    const migrations = await Promise.all(
      migrationFiles.map(async (file, index) => ({
        version: index + 1,
        name: file,
        sql: await readFile(new URL(`../../../../migrations/${file}`, import.meta.url), "utf8"),
      })),
    );
    const database = new ZimoDatabase(join(directory, "zimo.sqlite"), migrations);
    seedReferencedCapabilities(database);

    await new SQLitePrototypeRepository(database, "skill").delete("skill" as never);
    expect(readJsonColumn(database, "conversations", "skill_ids_json", "conversation")).toEqual([]);
    expect(readJsonColumn(database, "prototype_definitions", "skill_ids_json", "agent")).toEqual(
      [],
    );
    expect(readTextColumn(database, "workflow_definitions", "status", "workflow")).toBe("disabled");

    await new SQLiteKnowledgeRepository(database).delete("knowledge" as never);
    expect(
      readJsonColumn(database, "conversations", "knowledge_base_ids_json", "conversation"),
    ).toEqual([]);
    expect(
      readJsonColumn(database, "prototype_definitions", "knowledge_base_ids_json", "agent"),
    ).toEqual([]);

    await new SQLiteMcpConnectionRepository(database).clear("meeting");
    expect(readJsonColumn(database, "conversations", "mcp_tool_ids_json", "conversation")).toEqual(
      [],
    );
    expect(count(database, "agent_mcp_server_bindings")).toBe(0);
    expect(count(database, "workflow_mcp_server_bindings")).toBe(0);

    await new SQLiteWorkflowRepository(database).delete("workflow" as never);
    expect(readTextColumn(database, "conversations", "workflow_id", "conversation")).toBeNull();

    await new SQLitePrototypeRepository(database, "agent").delete("agent" as never);
    expect(readTextColumn(database, "conversations", "agent_id", "conversation")).toBeNull();
    expect(count(database, "agent_run_records")).toBe(1);
    expect(readTextColumn(database, "agent_run_records", "agent_id", "run")).toBe("agent");

    database.close();
  });
});

function seedReferencedCapabilities(database: ZimoDatabase): void {
  database.sqlite.exec(`
    INSERT INTO model_providers
      (id, name, base_url, secret_ref, key_hint, kind, enabled, created_at, updated_at)
    VALUES
      ('provider', 'Provider', 'https://example.test/v1', 'secret', 'hint',
       'openai-compatible', 1, '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z');
    INSERT INTO models
      (id, provider_id, name, display_name, capabilities_json, enabled, created_at, updated_at)
    VALUES
      ('model', 'provider', 'model', 'Model', '{}', 1,
       '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z');
    INSERT INTO prototype_definitions
      (id, kind, name, description, status, category, tags_json, icon, version, source,
       model_id, system_prompt, skill_ids_json, skill_package_id, skill_instructions,
       skill_checksum, permissions_json, capabilities_json, associations_json,
       installation_status, workflow_nodes_json, workflow_edges_json, documents_json,
       created_at, updated_at, knowledge_base_ids_json, agent_catalog_id, agent_remote_id)
    VALUES
      ('skill', 'skill', 'Skill', '', 'enabled', 'test', '[]', 'S', '1.0.0', 'test',
       NULL, NULL, '[]', 'test.skill', 'instruction', 'checksum', '[]', '[]', '[]',
       'installed', '[]', '[]', '[]', '2026-09-10T00:00:00.000Z',
       '2026-09-10T00:00:00.000Z', '[]', NULL, NULL),
      ('agent', 'agent', 'Agent', '', 'enabled', 'test', '[]', 'A', '1.0.0', 'test',
       'model', 'prompt', '["skill"]', NULL, NULL, NULL, '[]', '[]', '[]', NULL,
       '[]', '[]', '[]', '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z',
       '["knowledge"]', NULL, NULL);
    INSERT INTO knowledge_bases
      (id, name, description, status, category, tags_json, created_at, updated_at)
    VALUES
      ('knowledge', 'Knowledge', '', 'enabled', 'test', '[]',
       '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z');
    INSERT INTO workflow_definitions
      (id, name, description, status, category, tags_json, icon, version, source,
       workflow_nodes_json, workflow_edges_json, created_at, updated_at)
    VALUES
      ('workflow', 'Workflow', '', 'enabled', 'test', '[]', 'W', '1.0.0', 'test',
       '[{"id":"agent-node","type":"agent","config":{"agentId":"agent"}},
         {"id":"skill-node","type":"skill","config":{"skillId":"skill"}},
         {"id":"knowledge-node","type":"knowledge","config":{"knowledgeBaseId":"knowledge"}}]',
       '[]', '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z');
    INSERT INTO mcp_connections
      (server_id, name, endpoint, source, authentication, secret_ref, server_name,
       server_version, tools_json, connected_at, updated_at)
    VALUES
      ('meeting', 'Meeting', 'https://example.test/mcp', 'catalog', 'none', NULL, 'meeting',
       NULL, '{"schemaVersion":2,"tools":[]}', '2026-09-10T00:00:00.000Z',
       '2026-09-10T00:00:00.000Z');
    INSERT INTO agent_mcp_server_bindings VALUES ('agent', 'meeting');
    INSERT INTO workflow_mcp_server_bindings VALUES ('workflow', 'meeting');
    INSERT INTO conversations
      (id, title, model_id, active_run_id, created_at, updated_at, deleted_at,
       knowledge_base_ids_json, agent_id, skill_ids_json, workflow_id, mcp_tool_ids_json)
    VALUES
      ('conversation', 'Conversation', 'model', NULL, '2026-09-10T00:00:00.000Z',
       '2026-09-10T00:00:00.000Z', NULL, '["knowledge"]', 'agent', '["skill"]',
       'workflow', '["mcp.meeting.schedule_meeting"]');
    INSERT INTO agent_run_records
      (id, conversation_id, agent_id, model_id, skill_ids_json, knowledge_base_ids_json,
       status, error_code, created_at, updated_at)
    VALUES
      ('run', 'conversation', 'agent', 'model', '["skill"]', '["knowledge"]', 'completed',
       NULL, '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z');
  `);
}

function readJsonColumn(
  database: ZimoDatabase,
  table: string,
  column: string,
  id: string,
): unknown {
  return JSON.parse(readTextColumn(database, table, column, id) ?? "null") as unknown;
}

function readTextColumn(
  database: ZimoDatabase,
  table: string,
  column: string,
  id: string,
): string | null {
  const row = database.sqlite
    .prepare(`SELECT ${column} AS value FROM ${table} WHERE id = ?`)
    .get(id) as { value: string | null };
  return row.value;
}

function count(database: ZimoDatabase, table: string): number {
  return (
    database.sqlite.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get() as { value: number }
  ).value;
}
