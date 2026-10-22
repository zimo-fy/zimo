import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  Client,
  InsufficientScopeError,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/client";
import {
  AppError,
  type McpDiscoveryResult,
  type McpGateway,
  type McpJsonValue,
  type McpServerTarget,
  type McpToolCallResult,
  TENCENT_MEETING_MCP_SERVER_ID,
  TENCENT_MEETING_SKILL_VERSION,
} from "@zimo/domain";

import { McpOAuthSession } from "./mcp-oauth-session";
import { getCatalogCredentialPlacement } from "./mcp-catalog";
import {
  normalizeMcpDiscoveryTools,
  type McpDiscoveryDiagnostic,
} from "./mcp-discovery-normalizer";
import {
  normalizeMcpToolResult,
  type McpToolResponseDiagnostic,
} from "./mcp-tool-result-normalizer";
import { projectMcpToolResult } from "./mcp-tool-result-projection";
import {
  createMcpTransportFailureDiagnostic,
  type McpTransportFailureDiagnostic,
} from "./mcp-transport-diagnostic";

const REQUEST_TIMEOUT_MS = 18_000;

export interface McpSession {
  connect(signal: AbortSignal): Promise<void>;
  supportsTools(): boolean;
  listTools(signal: AbortSignal): Promise<readonly Tool[]>;
  callTool(
    name: string,
    input: Readonly<Record<string, McpJsonValue>> | undefined,
    signal: AbortSignal,
  ): Promise<CallToolResult>;
  serverVersion(): Readonly<{ name: string; version: string }> | undefined;
  credential?(): string | undefined;
  close(): Promise<void>;
}

export type McpSessionFactory = (
  target: McpServerTarget,
  credential: string | undefined,
) => McpSession;

export class StreamableHttpMcpGateway implements McpGateway {
  private readonly runSessions = new Map<string, McpSession>();

  constructor(
    createSession: McpSessionFactory | undefined = undefined,
    private readonly validateEndpoint: (value: string) => Promise<void> = assertPublicHttpsEndpoint,
    openAuthorizationPage: (url: string) => Promise<void> = async () => {
      throw new AppError({
        code: "MCP_OAUTH_UNAVAILABLE",
        category: "configuration",
        userMessage: "当前运行环境不能打开 OAuth 授权页面。",
      });
    },
    private readonly reportInvalidToolResponse?: (
      diagnostic: McpToolResponseDiagnostic & Readonly<{ serverId: string; toolName: string }>,
    ) => void,
    private readonly reportInvalidDiscovery?: (
      diagnostic: McpDiscoveryDiagnostic & Readonly<{ serverId: string }>,
    ) => void,
    private readonly reportTransportFailure?: (diagnostic: McpTransportFailureDiagnostic) => void,
  ) {
    this.createSession =
      createSession ??
      ((target, credential) => createSdkSession(target, credential, openAuthorizationPage));
  }

  private readonly createSession: McpSessionFactory;

  async discover(
    target: McpServerTarget,
    credential: string | undefined,
    signal: AbortSignal,
  ): Promise<McpDiscoveryResult> {
    await this.validateEndpoint(target.endpoint);
    const session = this.createSession(target, credential);
    let phase: McpTransportFailureDiagnostic["phase"] = "connect";
    let phaseStartedAt = Date.now();
    try {
      await session.connect(signal);
      if (!session.supportsTools()) {
        throw new AppError({
          code: "MCP_TOOLS_UNSUPPORTED",
          category: "configuration",
          userMessage: "该 MCP Server 没有声明 tools 能力。",
        });
      }
      phase = "tools_list";
      phaseStartedAt = Date.now();
      const tools = await session.listTools(signal);
      const serverVersion = session.serverVersion();
      return {
        serverName: serverVersion?.name?.slice(0, 160) || target.name,
        ...(serverVersion?.version ? { serverVersion: serverVersion.version.slice(0, 100) } : {}),
        tools: normalizeMcpDiscoveryTools(tools, (diagnostic) =>
          this.reportInvalidDiscovery?.({ ...diagnostic, serverId: target.id }),
        ),
        ...(session.credential?.() ? { credential: session.credential() } : {}),
      };
    } catch (error) {
      this.captureTransportFailure(error, target.id, phase, phaseStartedAt, signal);
      throw mapMcpError(error, signal);
    } finally {
      await session.close().catch(() => undefined);
    }
  }

  async callTool(
    target: McpServerTarget,
    credential: string | undefined,
    toolName: string,
    input: Readonly<Record<string, McpJsonValue>>,
    signal: AbortSignal,
    runId?: string,
  ): Promise<McpToolCallResult> {
    await this.validateEndpoint(target.endpoint);
    const sessionKey = runId ? createRunSessionKey(runId, target.id) : undefined;
    const existingSession = sessionKey ? this.runSessions.get(sessionKey) : undefined;
    const session = existingSession ?? this.createSession(target, credential);
    let keepSessionOpen = Boolean(sessionKey);
    let phase: McpTransportFailureDiagnostic["phase"] = "connect";
    let phaseStartedAt = Date.now();
    try {
      if (!existingSession) {
        await session.connect(signal);
        if (sessionKey) this.runSessions.set(sessionKey, session);
      }
      phase = "tools_call";
      phaseStartedAt = Date.now();
      const result = await session.callTool(toolName, input, signal);
      if (result.isError) {
        throw new AppError({
          code: "MCP_TOOL_FAILED",
          category: "network",
          userMessage: "MCP 工具执行失败，请检查参数、凭据和服务权限。",
        });
      }
      const projectedResult = projectMcpToolResult(target.id, toolName, result);
      return {
        value: normalizeMcpToolResult(projectedResult, (diagnostic) =>
          this.reportInvalidToolResponse?.({ ...diagnostic, serverId: target.id, toolName }),
        ),
        ...(session.credential?.() ? { credential: session.credential() } : {}),
      };
    } catch (error) {
      keepSessionOpen = false;
      if (sessionKey && this.runSessions.get(sessionKey) === session) {
        this.runSessions.delete(sessionKey);
      }
      this.captureTransportFailure(error, target.id, phase, phaseStartedAt, signal, toolName);
      throw mapMcpError(error, signal);
    } finally {
      if (!keepSessionOpen) await session.close().catch(() => undefined);
    }
  }

  async closeRun(runId: string): Promise<void> {
    const prefix = `${runId}\u0000`;
    const sessions: McpSession[] = [];
    for (const [key, session] of this.runSessions) {
      if (!key.startsWith(prefix)) continue;
      this.runSessions.delete(key);
      sessions.push(session);
    }
    await Promise.allSettled(sessions.map((session) => session.close()));
  }

  private captureTransportFailure(
    error: unknown,
    serverId: string,
    phase: McpTransportFailureDiagnostic["phase"],
    phaseStartedAt: number,
    signal: AbortSignal,
    toolName?: string,
  ): void {
    const diagnostic = createMcpTransportFailureDiagnostic(
      error,
      serverId,
      phase,
      phaseStartedAt,
      signal,
      toolName,
    );
    if (!diagnostic) return;
    try {
      this.reportTransportFailure?.(diagnostic);
    } catch {
      // Diagnostics must never replace the original MCP failure.
    }
  }
}

function createRunSessionKey(runId: string, serverId: string): string {
  return `${runId}\u0000${serverId}`;
}

function createSdkSession(
  target: McpServerTarget,
  credential: string | undefined,
  openAuthorizationPage: (url: string) => Promise<void>,
): McpSession {
  const client = new Client(
    { name: "zimo-desktop", version: "0.1.0" },
    { listMaxPages: 20, inputRequired: { autoFulfill: false } },
  );
  const headers = createMcpRequestHeaders(target, credential);
  const endpoint = createMcpRequestUrl(target, credential);
  const oauth =
    target.authentication === "oauth"
      ? new McpOAuthSession(credential, openAuthorizationPage)
      : undefined;
  const transport = new StreamableHTTPClientTransport(endpoint, {
    ...(oauth ? { authProvider: oauth.authProvider } : {}),
    requestInit: { redirect: "error", headers },
    onInsufficientScope: "throw",
  });
  return {
    connect: (signal) => {
      const connect = () => client.connect(transport, { signal, timeout: REQUEST_TIMEOUT_MS });
      return oauth ? oauth.connect(connect, transport, signal) : connect();
    },
    supportsTools: () => Boolean(client.getServerCapabilities()?.tools),
    listTools: async (signal) =>
      (
        await client.listTools(undefined, {
          signal,
          timeout: REQUEST_TIMEOUT_MS,
          maxTotalTimeout: REQUEST_TIMEOUT_MS,
          cacheMode: "refresh",
        })
      ).tools,
    callTool: (name, input, signal) =>
      client.callTool(
        { name, ...(input ? { arguments: input } : {}) },
        { signal, timeout: REQUEST_TIMEOUT_MS, maxTotalTimeout: REQUEST_TIMEOUT_MS },
      ),
    serverVersion: () => client.getServerVersion(),
    credential: () => oauth?.serializeCredential(),
    close: async () => {
      await client.close();
      await oauth?.close();
    },
  };
}

export function createMcpRequestHeaders(
  target: McpServerTarget,
  credential: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (target.authentication === "bearer" && credential) {
    headers.Authorization = `Bearer ${credential}`;
  }
  if (target.authentication === "header_token") {
    if (target.id !== TENCENT_MEETING_MCP_SERVER_ID || !credential) throw invalidCredentialType();
    headers["X-Tencent-Meeting-Token"] = credential;
    headers["X-Skill-Version"] = TENCENT_MEETING_SKILL_VERSION;
  }
  if (target.authentication === "api_key") {
    const placement = getCatalogCredentialPlacement(target.id);
    if (target.source !== "catalog" || placement?.kind !== "header" || !credential) {
      throw invalidCredentialType();
    }
    const prefix = "prefix" in placement ? placement.prefix : "";
    headers[placement.name] = `${prefix}${credential}`;
  }
  return headers;
}

export function createMcpRequestUrl(target: McpServerTarget, credential: string | undefined): URL {
  const endpoint = new URL(target.endpoint);
  if (target.authentication !== "query_token") return endpoint;
  const placement = getCatalogCredentialPlacement(target.id);
  if (target.source !== "catalog" || placement?.kind !== "query" || !credential) {
    throw invalidCredentialType();
  }
  endpoint.searchParams.set(placement.name, credential);
  return endpoint;
}

function invalidCredentialType(): AppError {
  return new AppError({
    code: "MCP_AUTH_CONFIGURATION_INVALID",
    category: "security",
    userMessage: "该 MCP Server 的凭据配置无效。",
  });
}

async function assertPublicHttpsEndpoint(value: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw endpointError();
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw endpointError();
  const addresses = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw endpointError();
  }
}

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    const first = parts[0] ?? 0;
    const second = parts[1] ?? 0;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127)
    );
  }
  const normalized = address.toLowerCase();
  return !(
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function mapMcpError(error: unknown, signal: AbortSignal): Error {
  if (error instanceof Error && error.name === "AbortError") return error;
  if (signal.aborted) return new DOMException("Aborted", "AbortError");
  if (error instanceof AppError) return error;
  if (error instanceof UnauthorizedError) {
    return new AppError({
      code: "MCP_AUTH_FAILED",
      category: "configuration",
      userMessage: "MCP 服务拒绝了当前凭据。",
      cause: error,
    });
  }
  if (error instanceof InsufficientScopeError) {
    return new AppError({
      code: "MCP_PERMISSION_DENIED",
      category: "configuration",
      userMessage: "MCP 凭据权限不足。",
      cause: error,
    });
  }
  return new AppError({
    code: "MCP_CONNECTION_FAILED",
    category: "network",
    userMessage: "无法连接 MCP 服务，请检查地址、网络和凭据。",
    retryable: true,
    cause: error,
  });
}

function endpointError(): AppError {
  return new AppError({
    code: "MCP_ENDPOINT_NOT_PUBLIC",
    category: "security",
    userMessage: "MCP 地址必须是可公开解析、无自定义端口的 HTTPS 地址。",
  });
}
