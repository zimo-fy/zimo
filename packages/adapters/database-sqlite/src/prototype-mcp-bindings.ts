import type { DatabaseSync } from "node:sqlite";

import type { PrototypeDefinition } from "@zimo/domain";

interface BindingDatabase {
  readonly sqlite: DatabaseSync;
}

type McpBindingOwner = "agent" | "workflow";

export function withMcpServerIds(
  database: BindingDatabase,
  owner: McpBindingOwner,
  ownerId: string,
  value: PrototypeDefinition,
): PrototypeDefinition {
  const target = bindingTarget(owner);
  if (!hasTable(database, target.table)) return value;
  const rows = database.sqlite
    .prepare(`SELECT server_id FROM ${target.table} WHERE ${target.column} = ? ORDER BY server_id`)
    .all(ownerId) as { server_id: string }[];
  return rows.length ? { ...value, mcpServerIds: rows.map((row) => row.server_id) } : value;
}

export function replaceMcpBindings(
  database: BindingDatabase,
  owner: McpBindingOwner,
  ownerId: string,
  serverIds: readonly string[],
): void {
  const target = bindingTarget(owner);
  if (!hasTable(database, target.table)) return;
  database.sqlite.prepare(`DELETE FROM ${target.table} WHERE ${target.column} = ?`).run(ownerId);
  const insert = database.sqlite.prepare(
    `INSERT INTO ${target.table} (${target.column}, server_id) VALUES (?, ?)`,
  );
  for (const serverId of new Set(serverIds)) insert.run(ownerId, serverId);
}

function bindingTarget(owner: McpBindingOwner): { table: string; column: string } {
  return owner === "agent"
    ? { table: "agent_mcp_server_bindings", column: "agent_id" }
    : { table: "workflow_mcp_server_bindings", column: "workflow_id" };
}

function hasTable(database: BindingDatabase, table: string): boolean {
  return Boolean(
    database.sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table),
  );
}
