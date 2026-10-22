interface RetiredMcpConnectionService {
  list(): Promise<readonly { serverId: string }[]>;
  disconnect(serverId: string): Promise<void>;
}

interface RetirementLogger {
  log(record: {
    level: "info";
    category: "audit";
    event: string;
    message: string;
    context: { serverId: string; outcome: "success" };
  }): void;
}

export const RETIRED_MCP_CATALOG_IDS = [
  "wecom",
  "notion",
  "linear",
  "stripe",
  "canva",
  "atlassian",
] as const;

export async function removeRetiredMcpConnections(
  service: RetiredMcpConnectionService,
  logger: RetirementLogger,
): Promise<void> {
  const connectedIds = new Set((await service.list()).map(({ serverId }) => serverId));
  for (const serverId of RETIRED_MCP_CATALOG_IDS) {
    if (!connectedIds.has(serverId)) continue;
    await service.disconnect(serverId);
    logger.log({
      level: "info",
      category: "audit",
      event: "mcp.catalog.retired_connection.removed",
      message: "Retired MCP catalog connection removed",
      context: { serverId, outcome: "success" },
    });
  }
}
