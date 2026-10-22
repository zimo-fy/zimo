import {
  createMcpRegisteredTools,
  type ControlledToolService,
  type McpRegistryService,
} from "@zimo/application";
import {
  connectMcpRequestSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  mcpConnectionViewSchema,
  mcpProbeViewSchema,
  mcpServerRequestSchema,
  successViewSchema,
  type McpConnectionView,
} from "@zimo/contracts";
import { type McpConnection } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";

import type { RegisterIpcHandler } from "./ipc-handler";
import { resolveMcpConnectInput } from "./mcp-catalog";

export function registerMcpIpcHandlers(options: {
  register: RegisterIpcHandler;
  service: McpRegistryService;
  tools: ControlledToolService;
  logger: StructuredLogger;
}): void {
  options.register({
    channel: IPC_CHANNELS.mcpList,
    input: emptyRequestSchema,
    output: mcpConnectionViewSchema.array(),
    handle: async () => (await options.service.list()).map(toView),
  });
  options.register({
    channel: IPC_CHANNELS.mcpProbe,
    input: connectMcpRequestSchema,
    output: mcpProbeViewSchema,
    handle: async ({ payload }) => {
      const startedAt = performance.now();
      const discovery = await options.service.probe(resolveMcpConnectInput(payload));
      options.logger.log({
        level: "info",
        category: "audit",
        event: "mcp.server.tested",
        message: "MCP connection test completed without saving credentials",
        context: {
          serverId: payload.serverId,
          durationMs: Math.round(performance.now() - startedAt),
          toolCount: discovery.tools.length,
          outcome: "success",
        },
      });
      return {
        serverName: discovery.serverName,
        ...(discovery.serverVersion ? { serverVersion: discovery.serverVersion } : {}),
        toolCount: discovery.tools.length,
      };
    },
  });
  options.register({
    channel: IPC_CHANNELS.mcpConnect,
    input: connectMcpRequestSchema,
    output: mcpConnectionViewSchema,
    handle: async ({ payload }) => {
      const startedAt = performance.now();
      const connection = await options.service.connect(resolveMcpConnectInput(payload));
      options.tools.replaceMcpServer(
        connection.serverId,
        createMcpRegisteredTools(connection, options.service),
      );
      logChange(options.logger, "mcp.server.connected", connection, startedAt);
      return toView(connection);
    },
  });
  options.register({
    channel: IPC_CHANNELS.mcpRefresh,
    input: mcpServerRequestSchema,
    output: mcpConnectionViewSchema,
    handle: async ({ payload }) => {
      const startedAt = performance.now();
      const connection = await options.service.refresh(payload.serverId);
      options.tools.replaceMcpServer(
        connection.serverId,
        createMcpRegisteredTools(connection, options.service),
      );
      logChange(options.logger, "mcp.server.snapshot.refreshed", connection, startedAt);
      return toView(connection);
    },
  });
  options.register({
    channel: IPC_CHANNELS.mcpDisconnect,
    input: mcpServerRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.service.disconnect(payload.serverId);
      options.tools.replaceMcpServer(payload.serverId, []);
      options.logger.log({
        level: "info",
        category: "audit",
        event: "mcp.server.disconnected",
        message: "MCP connection removed",
        context: { serverId: payload.serverId, outcome: "success" },
      });
      return { success: true as const };
    },
  });
}

function toView(connection: McpConnection): McpConnectionView {
  return {
    serverId: connection.serverId,
    name: connection.name,
    endpoint: connection.endpoint,
    source: connection.source,
    authentication: connection.authentication,
    serverName: connection.serverName,
    ...(connection.serverVersion ? { serverVersion: connection.serverVersion } : {}),
    tools: connection.tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      ...(tool.title ? { title: tool.title } : {}),
      ...(tool.description ? { description: tool.description } : {}),
      ...(tool.annotations?.readOnly !== undefined ? { readOnly: tool.annotations.readOnly } : {}),
      ...(tool.annotations?.destructive !== undefined
        ? { destructive: tool.annotations.destructive }
        : {}),
      enabled: true as const,
    })),
    connectedAt: connection.connectedAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

function logChange(
  logger: StructuredLogger,
  event: string,
  connection: McpConnection,
  startedAt: number,
): void {
  logger.log({
    level: "info",
    category: "audit",
    event,
    message: "MCP connection verified and tool snapshot saved",
    context: {
      serverId: connection.serverId,
      durationMs: Math.round(performance.now() - startedAt),
      toolCount: connection.tools.length,
      outcome: "success",
    },
  });
}
