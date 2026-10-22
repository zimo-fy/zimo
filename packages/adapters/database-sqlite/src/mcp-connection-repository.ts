import type {
  McpAuthenticationType,
  McpConnection,
  McpConnectionRepository,
  McpJsonValue,
  McpToolSnapshot,
} from "@zimo/domain";

import type { ZimoDatabase } from "./index";

interface McpConnectionRow {
  server_id: string;
  name: string;
  endpoint: string;
  source: McpConnection["source"];
  authentication: McpAuthenticationType;
  secret_ref: string | null;
  server_name: string;
  server_version: string | null;
  tools_json: string;
  connected_at: string;
  updated_at: string;
}

interface StoredTools {
  schemaVersion: 2;
  tools: readonly McpToolSnapshot[];
}

export class SQLiteMcpConnectionRepository implements McpConnectionRepository {
  constructor(private readonly database: ZimoDatabase) {}

  async list(): Promise<readonly McpConnection[]> {
    return (
      this.database.sqlite
        .prepare("SELECT * FROM mcp_connections ORDER BY updated_at DESC")
        .all() as unknown as McpConnectionRow[]
    ).map(mapConnection);
  }

  async get(serverId: string): Promise<McpConnection | null> {
    const row = this.database.sqlite
      .prepare("SELECT * FROM mcp_connections WHERE server_id = ?")
      .get(serverId) as unknown as McpConnectionRow | undefined;
    return row ? mapConnection(row) : null;
  }

  async save(connection: McpConnection): Promise<void> {
    const stored: StoredTools = { schemaVersion: 2, tools: connection.tools };
    this.database.sqlite
      .prepare(
        `INSERT INTO mcp_connections
          (server_id, name, endpoint, source, authentication, secret_ref, server_name, server_version,
           tools_json, connected_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(server_id) DO UPDATE SET
          name = excluded.name, endpoint = excluded.endpoint,
          source = excluded.source,
          authentication = excluded.authentication, secret_ref = excluded.secret_ref,
          server_name = excluded.server_name, server_version = excluded.server_version,
          tools_json = excluded.tools_json, connected_at = excluded.connected_at,
          updated_at = excluded.updated_at`,
      )
      .run(
        connection.serverId,
        connection.name,
        connection.endpoint,
        connection.source,
        connection.authentication,
        connection.secretRef ?? null,
        connection.serverName,
        connection.serverVersion ?? null,
        JSON.stringify(stored),
        connection.connectedAt.toISOString(),
        connection.updatedAt.toISOString(),
      );
  }

  async clear(serverId: string): Promise<void> {
    this.database.sqlite.prepare("DELETE FROM mcp_connections WHERE server_id = ?").run(serverId);
  }
}

function mapConnection(row: McpConnectionRow): McpConnection {
  const stored = parseStoredTools(row.tools_json, row.server_id);
  return {
    serverId: row.server_id,
    name: row.name,
    endpoint: row.endpoint,
    source: row.source,
    authentication: row.authentication,
    ...(row.secret_ref ? { secretRef: row.secret_ref } : {}),
    serverName: row.server_name,
    ...(row.server_version ? { serverVersion: row.server_version } : {}),
    tools: stored.tools,
    connectedAt: new Date(row.connected_at),
    updatedAt: new Date(row.updated_at),
  };
}

function parseStoredTools(value: string, serverId: string): StoredTools {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || !Array.isArray(parsed.tools)) {
    throw new Error("Invalid stored MCP tool snapshot");
  }
  const tools = parsed.tools.map((tool) => parseTool(tool, serverId));
  if (tools.length > 500) throw new Error("Stored MCP tool snapshot exceeds limit");
  return { schemaVersion: 2, tools };
}

function parseTool(value: unknown, serverId: string): McpToolSnapshot {
  if (!isRecord(value) || typeof value.name !== "string" || !isRecord(value.inputSchema)) {
    throw new Error("Invalid stored MCP tool");
  }
  const annotations = isRecord(value.annotations)
    ? {
        ...(typeof value.annotations.readOnly === "boolean"
          ? { readOnly: value.annotations.readOnly }
          : {}),
        ...(typeof value.annotations.destructive === "boolean"
          ? { destructive: value.annotations.destructive }
          : {}),
        ...(typeof value.annotations.idempotent === "boolean"
          ? { idempotent: value.annotations.idempotent }
          : {}),
        ...(typeof value.annotations.openWorld === "boolean"
          ? { openWorld: value.annotations.openWorld }
          : {}),
      }
    : undefined;
  return {
    id: `mcp.${serverId}.${value.name}`,
    name: value.name,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.description === "string" ? { description: value.description } : {}),
    inputSchema: value.inputSchema as Readonly<Record<string, McpJsonValue>>,
    ...(annotations ? { annotations } : {}),
    enabled: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
