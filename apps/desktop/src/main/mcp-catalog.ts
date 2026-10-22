import { AppError, type McpServerConnectInput } from "@zimo/domain";

interface TrustedCatalogEntry {
  name: string;
  endpoint: string;
  authentication: McpServerConnectInput["authentication"];
  credentialPlacement?:
    | Readonly<{ kind: "header"; name: string; prefix?: string }>
    | Readonly<{ kind: "query"; name: string }>;
}

export const TRUSTED_MCP_CATALOG = {
  "qcc-company": {
    name: "企查查",
    endpoint: "https://agent.qcc.com/mcp/company/stream",
    authentication: "bearer",
  },
  "tencent-meeting": {
    name: "腾讯会议",
    endpoint: "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1",
    authentication: "header_token",
  },
  github: {
    name: "GitHub",
    endpoint: "https://api.githubcopilot.com/mcp/",
    authentication: "oauth",
  },
  sentry: { name: "Sentry", endpoint: "https://mcp.sentry.dev/mcp", authentication: "oauth" },
  "hugging-face": {
    name: "Hugging Face",
    endpoint: "https://huggingface.co/mcp",
    authentication: "bearer",
  },
  context7: {
    name: "Context7",
    endpoint: "https://mcp.context7.com/mcp",
    authentication: "bearer",
  },
  "microsoft-learn": {
    name: "Microsoft Learn",
    endpoint: "https://learn.microsoft.com/api/mcp",
    authentication: "none",
  },
  "tencent-docs": {
    name: "腾讯文档",
    endpoint: "https://docs.qq.com/openapi/mcp",
    authentication: "api_key",
    credentialPlacement: { kind: "header", name: "Authorization" },
  },
  amap: {
    name: "高德地图",
    endpoint: "https://mcp.amap.com/mcp",
    authentication: "query_token",
    credentialPlacement: { kind: "query", name: "key" },
  },
  "58pic": {
    name: "千图 AI",
    endpoint: "https://mcp.58pic.com/mcp",
    authentication: "bearer",
  },
  "edgeone-pages": {
    name: "EdgeOne Pages",
    endpoint: "https://mcp-on-edge.edgeone.site/mcp-server",
    authentication: "none",
  },
  "youhuo-b": {
    name: "有活招工",
    endpoint: "https://mcp-server.hopped.com.cn/b/mcp",
    authentication: "none",
  },
  yingmi: {
    name: "盈米基金",
    endpoint: "https://stargate.yingmi.com/mcp/v2",
    authentication: "api_key",
    credentialPlacement: { kind: "header", name: "x-api-key" },
  },
  didi: {
    name: "滴滴出行",
    endpoint: "https://mcp.didichuxing.com/mcp-servers",
    authentication: "query_token",
    credentialPlacement: { kind: "query", name: "key" },
  },
  investoday: {
    name: "今日投资",
    endpoint: "https://data-api.investoday.net/data/mcp",
    authentication: "query_token",
    credentialPlacement: { kind: "query", name: "apiKey" },
  },
  mcdonalds: {
    name: "麦当劳中国",
    endpoint: "https://mcp.mcd.cn",
    authentication: "bearer",
  },
  uapi: {
    name: "UAPI",
    endpoint: "https://uapis.cn/mcp",
    authentication: "api_key",
    credentialPlacement: { kind: "header", name: "X-API-Key" },
  },
} as const satisfies Readonly<Record<string, TrustedCatalogEntry>>;

export function getCatalogCredentialPlacement(serverId: string) {
  const entry = TRUSTED_MCP_CATALOG[serverId as keyof typeof TRUSTED_MCP_CATALOG];
  return entry && "credentialPlacement" in entry ? entry.credentialPlacement : undefined;
}

export function resolveMcpConnectInput(payload: {
  serverId: string;
  name: string;
  endpoint: string;
  source: "custom" | "catalog";
  authentication: McpServerConnectInput["authentication"];
  credential?: string | undefined;
}): McpServerConnectInput {
  const credential = payload.credential ? { credential: payload.credential } : {};
  if (payload.source !== "catalog") {
    return {
      id: payload.serverId,
      name: payload.name,
      endpoint: payload.endpoint,
      source: payload.source,
      authentication: payload.authentication,
      ...credential,
    };
  }
  const catalogEntry = TRUSTED_MCP_CATALOG[payload.serverId as keyof typeof TRUSTED_MCP_CATALOG];
  if (!catalogEntry) {
    throw new AppError({
      code: "MCP_CATALOG_ENTRY_INVALID",
      category: "security",
      userMessage: "无法识别该内置 MCP 服务。",
    });
  }
  return {
    id: payload.serverId,
    name: catalogEntry.name,
    endpoint: catalogEntry.endpoint,
    source: "catalog",
    authentication: catalogEntry.authentication,
    ...credential,
  };
}
