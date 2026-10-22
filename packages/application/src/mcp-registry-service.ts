import {
  AppError,
  isValidMcpToolName,
  MCP_MAX_REMOTE_TOOLS,
  MCP_MAX_TOOL_CATALOG_CHARACTERS,
  MCP_MAX_TOOL_SCHEMA_CHARACTERS,
  type Clock,
  type IdGenerator,
  type McpConnection,
  type McpConnectionRepository,
  type McpDiscoveryResult,
  type McpGateway,
  type McpJsonValue,
  type McpServerConnectInput,
  type McpToolSnapshot,
  type SecretStore,
} from "@zimo/domain";

const DISCOVERY_TIMEOUT_MS = 20_000;
const OAUTH_DISCOVERY_TIMEOUT_MS = 5 * 60_000 + 20_000;
const CALL_TIMEOUT_MS = 20_000;

export class McpRegistryService {
  private readonly activeOperations = new Set<AbortController>();
  private readonly changingServers = new Set<string>();

  constructor(
    private readonly repository: McpConnectionRepository,
    private readonly secrets: SecretStore,
    private readonly gateway: McpGateway,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  list(): Promise<readonly McpConnection[]> {
    return this.repository.list();
  }

  async get(serverId: string): Promise<McpConnection> {
    const value = await this.repository.get(serverId);
    if (!value) throw mcpError("MCP_NOT_CONNECTED", "没有找到该 MCP Server。");
    return value;
  }

  async probe(input: McpServerConnectInput): Promise<McpDiscoveryResult> {
    if (input.authentication !== "none" && input.authentication !== "oauth" && !input.credential) {
      throw mcpError("MCP_CREDENTIAL_REQUIRED", "请输入访问凭据。");
    }
    return this.discover(toTarget(input), input.credential);
  }

  async connect(input: McpServerConnectInput): Promise<McpConnection> {
    this.beginChange(input.id);
    try {
      if (input.authentication !== "none") {
        await this.assertPersistentSecrets();
        if (input.authentication !== "oauth" && !input.credential) {
          throw mcpError("MCP_CREDENTIAL_REQUIRED", "请输入访问凭据。");
        }
      }
      const discovery = await this.discover(toTarget(input), input.credential);
      const previous = await this.repository.get(input.id);
      const secretValue =
        input.authentication === "oauth" ? discovery.credential : input.credential;
      if (input.authentication === "oauth" && !secretValue) {
        throw mcpError("MCP_AUTH_FAILED", "OAuth 授权没有返回可保存的凭据。");
      }
      const secretRef = input.authentication !== "none" ? this.ids.create() : undefined;
      if (secretRef && secretValue) await this.secrets.set(secretRef, secretValue);
      const now = this.clock.now();
      const connection = toConnection(input, discovery, secretRef, now, now);
      try {
        await this.repository.save(connection);
      } catch (error) {
        if (secretRef) await this.secrets.delete(secretRef).catch(() => undefined);
        throw error;
      }
      if (previous?.secretRef && previous.secretRef !== secretRef) {
        await this.secrets.delete(previous.secretRef).catch(() => undefined);
      }
      return connection;
    } finally {
      this.changingServers.delete(input.id);
    }
  }

  async refresh(serverId: string): Promise<McpConnection> {
    this.beginChange(serverId);
    try {
      const current = await this.get(serverId);
      const credential = await this.readCredential(current);
      const discovery = await this.discover(toTarget(current), credential);
      const updated = toConnection(
        {
          id: current.serverId,
          name: current.name,
          endpoint: current.endpoint,
          source: current.source,
          authentication: current.authentication,
          ...(credential ? { credential } : {}),
        },
        discovery,
        current.secretRef,
        current.connectedAt,
        this.clock.now(),
      );
      if (current.secretRef && discovery.credential) {
        await this.secrets.set(current.secretRef, discovery.credential);
      }
      await this.repository.save(updated);
      return updated;
    } finally {
      this.changingServers.delete(serverId);
    }
  }

  async disconnect(serverId: string): Promise<void> {
    this.beginChange(serverId);
    try {
      const current = await this.repository.get(serverId);
      await this.repository.clear(serverId);
      if (current?.secretRef) await this.secrets.delete(current.secretRef).catch(() => undefined);
    } finally {
      this.changingServers.delete(serverId);
    }
  }

  async callTool(
    serverId: string,
    toolName: string,
    input: Readonly<Record<string, McpJsonValue>>,
    runId: string,
    parentSignal: AbortSignal,
  ): Promise<McpJsonValue> {
    const current = await this.get(serverId);
    if (!current.tools.some((tool) => tool.name === toolName && tool.enabled)) {
      throw mcpError("MCP_TOOL_UNAVAILABLE", "当前 MCP 快照不包含该工具，请先刷新。");
    }
    const credential = await this.readCredential(current);
    const operation = linkedController(parentSignal);
    const { controller } = operation;
    const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
    this.activeOperations.add(controller);
    try {
      const result = await this.gateway.callTool(
        toTarget(current),
        credential,
        toolName,
        input,
        controller.signal,
        runId,
      );
      if (current.secretRef && result.credential) {
        await this.secrets.set(current.secretRef, result.credential);
      }
      return result.value;
    } finally {
      clearTimeout(timer);
      this.activeOperations.delete(controller);
      operation.dispose();
    }
  }

  async closeRun(runId: string): Promise<void> {
    await this.gateway.closeRun?.(runId);
  }

  cancelAll(): void {
    for (const controller of this.activeOperations) controller.abort();
  }

  private beginChange(serverId: string): void {
    if (this.changingServers.has(serverId)) {
      throw mcpError("MCP_OPERATION_IN_PROGRESS", "该 MCP Server 正在处理另一个操作。");
    }
    this.changingServers.add(serverId);
  }

  private async discover(
    target: ReturnType<typeof toTarget>,
    credential: string | undefined,
  ): Promise<McpDiscoveryResult> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      target.authentication === "oauth" ? OAUTH_DISCOVERY_TIMEOUT_MS : DISCOVERY_TIMEOUT_MS,
    );
    this.activeOperations.add(controller);
    try {
      return await this.gateway.discover(target, credential, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AppError({
          code: "MCP_CONNECTION_TIMEOUT",
          category: "network",
          userMessage: "MCP 连接超时，请检查网络后重试。",
          retryable: true,
          cause: error,
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
      this.activeOperations.delete(controller);
    }
  }

  private async readCredential(connection: McpConnection): Promise<string | undefined> {
    if (connection.authentication === "none") return undefined;
    const credential = connection.secretRef
      ? await this.secrets.get(connection.secretRef)
      : undefined;
    if (!credential) throw mcpError("MCP_CREDENTIAL_MISSING", "MCP 凭据不可用，请重新连接。");
    return credential;
  }

  private async assertPersistentSecrets(): Promise<void> {
    const status = await this.secrets.getStatus();
    if (!status.available || !status.persistent) {
      throw new AppError({
        code: "SECRET_STORE_UNAVAILABLE",
        category: "security",
        userMessage: "系统安全存储当前不可用，无法保存 MCP 凭据。",
      });
    }
  }
}

function toConnection(
  input: McpServerConnectInput,
  discovery: McpDiscoveryResult,
  secretRef: string | undefined,
  connectedAt: Date,
  updatedAt: Date,
): McpConnection {
  if (discovery.tools.length > MCP_MAX_REMOTE_TOOLS) {
    throw mcpError("MCP_RESPONSE_INVALID", "MCP 返回的工具数量超过 500 个的安全上限。");
  }
  const unique = new Map<string, McpToolSnapshot>();
  for (const tool of discovery.tools) {
    if (!isValidMcpToolName(tool.name)) {
      throw mcpError("MCP_RESPONSE_INVALID", "MCP 返回了无效的工具名称。");
    }
    if (JSON.stringify(tool.inputSchema).length > MCP_MAX_TOOL_SCHEMA_CHARACTERS) {
      throw mcpError("MCP_RESPONSE_INVALID", "MCP 返回的工具参数结构过大。");
    }
    if (!unique.has(tool.name)) {
      unique.set(tool.name, { ...tool, id: `mcp.${input.id}.${tool.name}`, enabled: true });
    }
  }
  if (JSON.stringify([...unique.values()]).length > MCP_MAX_TOOL_CATALOG_CHARACTERS) {
    throw mcpError("MCP_RESPONSE_INVALID", "MCP 返回的完整工具目录超过本地快照上限。");
  }
  return {
    serverId: input.id,
    name: input.name,
    endpoint: input.endpoint,
    source: input.source,
    authentication: input.authentication,
    ...(secretRef ? { secretRef } : {}),
    serverName: discovery.serverName,
    ...(discovery.serverVersion ? { serverVersion: discovery.serverVersion } : {}),
    tools: [...unique.values()],
    connectedAt,
    updatedAt,
  };
}

function toTarget(input: McpServerConnectInput | McpConnection) {
  return {
    id: "id" in input ? input.id : input.serverId,
    name: input.name,
    endpoint: input.endpoint,
    source: input.source,
    authentication: input.authentication,
  };
}

function linkedController(parentSignal: AbortSignal): {
  controller: AbortController;
  dispose: () => void;
} {
  if (parentSignal.aborted) throw new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  parentSignal.addEventListener("abort", onAbort, { once: true });
  return {
    controller,
    dispose: () => parentSignal.removeEventListener("abort", onAbort),
  };
}

function mcpError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "configuration", userMessage });
}
