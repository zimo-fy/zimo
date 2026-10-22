import { CommunicationChannelService, McpRegistryService } from "@zimo/application";
import {
  SQLiteCommunicationChannelRepository,
  SQLiteMcpConnectionRepository,
  type ZimoDatabase,
} from "@zimo/database-sqlite";
import type { Clock, IdGenerator, SecretStore } from "@zimo/domain";
import type { SessionStore } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import { shell } from "electron";

import { StreamableHttpMcpGateway } from "./streamable-http-mcp-gateway";
import { TencentWeixinBindingGateway } from "./weixin-binding-gateway";

export function createExternalIntegrationServices(options: {
  database: ZimoDatabase;
  secrets: SecretStore;
  clock: Clock;
  ids: IdGenerator;
  sessions: SessionStore;
  logger: StructuredLogger;
}): {
  communicationChannels: CommunicationChannelService;
  communicationChannelRepository: SQLiteCommunicationChannelRepository;
  mcp: McpRegistryService;
} {
  const communicationChannelRepository = new SQLiteCommunicationChannelRepository(options.database);
  return {
    communicationChannelRepository,
    communicationChannels: new CommunicationChannelService(
      communicationChannelRepository,
      options.secrets,
      new TencentWeixinBindingGateway(),
      options.clock,
      options.ids,
      options.sessions,
    ),
    mcp: new McpRegistryService(
      new SQLiteMcpConnectionRepository(options.database),
      options.secrets,
      new StreamableHttpMcpGateway(
        undefined,
        undefined,
        async (url) => {
          await shell.openExternal(url, { activate: true });
        },
        (diagnostic) => {
          options.logger.log({
            level: "warn",
            category: "mcp",
            event: "mcp.tool.response.rejected",
            message: "MCP tool response rejected by safety normalization",
            context: { ...diagnostic },
          });
        },
        (diagnostic) => {
          options.logger.log({
            level: "warn",
            category: "mcp",
            event: "mcp.discovery.response.rejected",
            message: "MCP discovery response rejected by safety normalization",
            context: { ...diagnostic },
          });
        },
        (diagnostic) => {
          options.logger.log({
            level: "warn",
            category: "mcp",
            event: "mcp.transport.request.failed",
            message: "MCP transport request failed; response content omitted by policy",
            context: { ...diagnostic },
          });
        },
      ),
      options.clock,
      options.ids,
    ),
  };
}
