import type { McpConnectionView } from "@zimo/contracts";

import type { McpCatalogEntry } from "./mcp-catalog";

export type McpConnectionFilter = "all" | "connected" | "not_connected";

export interface McpListItem {
  entry: McpCatalogEntry;
  connection?: McpConnectionView;
}

export function buildMcpListItems(
  catalog: readonly McpCatalogEntry[],
  connections: readonly McpConnectionView[],
  query: string,
  connectionFilter: McpConnectionFilter,
): McpListItem[] {
  const connectionsById = new Map(
    connections.map((connection) => [connection.serverId, connection]),
  );
  const catalogIds = new Set(catalog.map((entry) => entry.input.serverId));
  const items: McpListItem[] = [
    ...catalog.map((entry) => {
      const connection = connectionsById.get(entry.input.serverId);
      return { entry, ...(connection ? { connection } : {}) };
    }),
    ...connections
      .filter(
        (connection) => connection.source === "custom" && !catalogIds.has(connection.serverId),
      )
      .map((connection) => ({ entry: toCustomEntry(connection), connection })),
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  return items
    .filter(({ entry, connection }) => {
      const matchesConnection =
        connectionFilter === "all" ||
        (connectionFilter === "connected" ? Boolean(connection) : !connection);
      const searchable = `${entry.input.name} ${entry.description} ${entry.input.endpoint} ${connection?.serverName ?? ""}`;
      return (
        matchesConnection &&
        (!normalizedQuery || searchable.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
      );
    })
    .sort((left, right) => Number(Boolean(right.connection)) - Number(Boolean(left.connection)));
}

export function createCustomMcpEntry(connection?: McpConnectionView): McpCatalogEntry {
  return connection
    ? toCustomEntry(connection)
    : {
        input: {
          serverId: `custom-${crypto.randomUUID()}`,
          name: "",
          endpoint: "",
          source: "custom",
          authentication: "none",
        },
        description: "连接支持 Streamable HTTP 的公网 HTTPS MCP Server。",
        icon: "custom",
      };
}

function toCustomEntry(connection: McpConnectionView): McpCatalogEntry {
  return {
    input: {
      serverId: connection.serverId,
      name: connection.name,
      endpoint: connection.endpoint,
      source: "custom",
      authentication: connection.authentication,
    },
    description: "用户手动添加的 MCP Server。",
    ...(connection.authentication === "bearer"
      ? { credentialLabel: "Bearer Token", credentialPlaceholder: "输入服务访问 Token" }
      : {}),
    icon: "custom",
  };
}
