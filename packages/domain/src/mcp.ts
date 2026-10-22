export const TENCENT_MEETING_MCP_SERVER_ID = "tencent-meeting" as const;
export const TENCENT_MEETING_MCP_ENDPOINT =
  "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1" as const;
export const TENCENT_MEETING_SKILL_VERSION = "v1.0.1" as const;
export const MCP_MAX_REMOTE_TOOLS = 500;
export const MCP_MAX_TOOL_SCHEMA_CHARACTERS = 50_000;
export const MCP_MAX_TOOL_CATALOG_CHARACTERS = 1_900_000;

const MCP_TOOL_NAME_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function isValidMcpToolName(value: string): boolean {
  return MCP_TOOL_NAME_PATTERN.test(value);
}

export type McpJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly McpJsonValue[]
  | Readonly<{ [key: string]: McpJsonValue }>;

export type McpAuthenticationType =
  "none" | "bearer" | "oauth" | "header_token" | "api_key" | "query_token";
export type McpConnectionSource = "custom" | "catalog";

export interface McpServerConnectInput {
  id: string;
  name: string;
  endpoint: string;
  source: McpConnectionSource;
  authentication: McpAuthenticationType;
  credential?: string | undefined;
}

export interface McpServerTarget {
  id: string;
  name: string;
  endpoint: string;
  source: McpConnectionSource;
  authentication: McpAuthenticationType;
}

export interface McpDiscoveredTool {
  name: string;
  title?: string | undefined;
  description?: string | undefined;
  inputSchema: Readonly<Record<string, McpJsonValue>>;
  annotations?:
    | Readonly<{
        readOnly?: boolean | undefined;
        destructive?: boolean | undefined;
        idempotent?: boolean | undefined;
        openWorld?: boolean | undefined;
      }>
    | undefined;
}

export interface McpDiscoveryResult {
  serverName: string;
  serverVersion?: string | undefined;
  tools: readonly McpDiscoveredTool[];
  /** Updated opaque credential state produced by an interactive OAuth flow or token refresh. */
  credential?: string | undefined;
}

export interface McpToolCallResult {
  value: McpJsonValue;
  /** Updated opaque OAuth state when the provider rotated or refreshed tokens. */
  credential?: string | undefined;
}

export interface McpGateway {
  discover(
    target: McpServerTarget,
    credential: string | undefined,
    signal: AbortSignal,
  ): Promise<McpDiscoveryResult>;
  callTool(
    target: McpServerTarget,
    credential: string | undefined,
    toolName: string,
    input: Readonly<Record<string, McpJsonValue>>,
    signal: AbortSignal,
    runId?: string,
  ): Promise<McpToolCallResult>;
  closeRun?(runId: string): Promise<void>;
}

export interface McpToolSnapshot extends McpDiscoveredTool {
  id: string;
  enabled: true;
}

export interface McpConnection {
  serverId: string;
  name: string;
  endpoint: string;
  source: McpConnectionSource;
  authentication: McpAuthenticationType;
  secretRef?: string | undefined;
  serverName: string;
  serverVersion?: string | undefined;
  tools: readonly McpToolSnapshot[];
  connectedAt: Date;
  updatedAt: Date;
}

export interface McpConnectionRepository {
  list(): Promise<readonly McpConnection[]>;
  get(serverId: string): Promise<McpConnection | null>;
  save(connection: McpConnection): Promise<void>;
  clear(serverId: string): Promise<void>;
}

/** @deprecated Use McpGateway. */
export type McpDiscoveryGateway = McpGateway;
/** @deprecated Use McpGateway. */
export type McpToolCallGateway = McpGateway;
