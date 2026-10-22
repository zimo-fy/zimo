import type {
  Clock,
  IdGenerator,
  ModelConnection,
  ModelNativeSearchGateway,
  SecretStore,
  SessionStore,
  WebSearchConfiguration,
  WebSearchConfigurationRepository,
  WebSearchGateway,
  WebSearchProviderKind,
  WebSearchResult,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

export interface WebSearchConfigurationView {
  enabled: boolean;
  provider: WebSearchProviderKind;
  baseUrl: string;
  hasApiKey: boolean;
}

export interface SaveWebSearchConfigurationCommand {
  enabled: boolean;
  provider: WebSearchProviderKind;
  baseUrl?: string | undefined;
  apiKey?: string | undefined;
}

export class WebAccessService {
  constructor(
    private readonly configurations: WebSearchConfigurationRepository,
    private readonly sessions: SessionStore,
    private readonly secrets: SecretStore,
    private readonly gateway: WebSearchGateway,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly nativeGateway?: ModelNativeSearchGateway,
    private readonly resolveDefaultModel?: () => Promise<ModelConnection>,
  ) {}

  async getConfiguration(): Promise<WebSearchConfigurationView> {
    const ownerUserId = await this.requireOwner();
    const configuration = await this.configurations.get(ownerUserId);
    return configuration
      ? {
          enabled: true,
          provider: configuration.provider,
          baseUrl: configuration.baseUrl ?? "",
          hasApiKey: Boolean(
            configuration.secretRef && (await this.secrets.get(configuration.secretRef)),
          ),
        }
      : { enabled: false, provider: "tavily", baseUrl: "", hasApiKey: false };
  }

  async saveConfiguration(
    command: SaveWebSearchConfigurationCommand,
  ): Promise<WebSearchConfigurationView> {
    const ownerUserId = await this.requireOwner();
    const previous = await this.configurations.get(ownerUserId);
    if (!command.enabled) {
      await this.configurations.delete(ownerUserId);
      if (previous?.secretRef) await this.secrets.delete(previous.secretRef).catch(() => undefined);
      return { enabled: false, provider: command.provider, baseUrl: "", hasApiKey: false };
    }

    const baseUrl = normalizeBaseUrl(command.provider, command.baseUrl);
    const apiKey = command.apiKey?.trim();
    const canReuseSecret =
      previous?.provider === command.provider && Boolean(previous.secretRef) && !apiKey;
    if (
      command.provider !== "searxng" &&
      command.provider !== "model_native" &&
      !apiKey &&
      !canReuseSecret
    ) {
      throw configurationError("请填写搜索服务 API Key。");
    }

    const secretRef =
      command.provider === "searxng" || command.provider === "model_native"
        ? undefined
        : canReuseSecret
          ? previous?.secretRef
          : this.ids.create();
    if (secretRef && apiKey) await this.secrets.set(secretRef, apiKey);
    const configuration: WebSearchConfiguration = {
      ownerUserId,
      provider: command.provider,
      ...(baseUrl ? { baseUrl } : {}),
      ...(secretRef ? { secretRef } : {}),
      updatedAt: this.clock.now(),
    };
    try {
      await this.configurations.save(configuration);
    } catch (error) {
      if (secretRef && secretRef !== previous?.secretRef) {
        await this.secrets.delete(secretRef).catch(() => undefined);
      }
      throw error;
    }
    if (previous?.secretRef && previous.secretRef !== secretRef) {
      await this.secrets.delete(previous.secretRef).catch(() => undefined);
    }
    return this.getConfiguration();
  }

  async testConfiguration(command: SaveWebSearchConfigurationCommand): Promise<number> {
    if (!command.enabled) throw configurationError("请先启用联网搜索。");
    const ownerUserId = await this.requireOwner();
    const current = await this.configurations.get(ownerUserId);
    const apiKey =
      command.apiKey?.trim() ||
      (current?.provider === command.provider && current.secretRef
        ? await this.secrets.get(current.secretRef)
        : undefined);
    if (command.provider !== "searxng" && command.provider !== "model_native" && !apiKey) {
      throw configurationError("请填写搜索服务 API Key。");
    }
    const startedAt = this.clock.now().getTime();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      command.provider === "model_native" ? 45_000 : 20_000,
    );
    try {
      if (command.provider === "model_native") {
        if (!this.nativeGateway || !this.resolveDefaultModel)
          throw configurationError("原生搜索服务不可用。");
        const result = await this.nativeGateway.search(
          await this.resolveDefaultModel(),
          { query: "深圳地铁 5 号线 官方网站", count: 2 },
          controller.signal,
        );
        if (result.results.length === 0) throw configurationError("当前模型未返回有效搜索来源。");
        return Math.max(0, this.clock.now().getTime() - startedAt);
      }
      await this.gateway.search(
        {
          provider: command.provider,
          ...(apiKey ? { apiKey } : {}),
          ...(normalizeBaseUrl(command.provider, command.baseUrl)
            ? { baseUrl: normalizeBaseUrl(command.provider, command.baseUrl) }
            : {}),
          query: "Zimo web search connectivity test",
          count: 1,
        },
        controller.signal,
      );
      return Math.max(0, this.clock.now().getTime() - startedAt);
    } finally {
      clearTimeout(timeout);
    }
  }

  async testNativeSearch(
    connection: ModelConnection,
  ): Promise<{ latencyMs: number; sourceCount: number; errorCount: number }> {
    if (!this.nativeGateway) throw configurationError("原生搜索服务不可用。");
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const result = await this.nativeGateway.search(
        connection,
        { query: "深圳地铁 5 号线 官方网站", count: 3 },
        controller.signal,
      );
      if (result.results.length === 0) throw configurationError("当前模型未返回有效搜索来源。");
      return {
        latencyMs: Math.round(performance.now() - startedAt),
        sourceCount: result.results.length,
        errorCount: result.errorCount,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async search(
    input: Readonly<{
      query: string;
      count: number;
      freshness?: "day" | "week" | "month" | undefined;
    }>,
    signal: AbortSignal,
    modelConnection?: ModelConnection,
  ): Promise<readonly WebSearchResult[]> {
    const ownerUserId = await this.requireOwner();
    const configuration = await this.configurations.get(ownerUserId);
    if (!configuration) throw configurationError("请先在设置中配置联网搜索服务。");
    const apiKey = configuration.secretRef
      ? await this.secrets.get(configuration.secretRef)
      : undefined;
    if (configuration.provider === "model_native") {
      if (!this.nativeGateway || (!modelConnection && !this.resolveDefaultModel))
        throw configurationError("当前运行没有可用的模型连接，无法执行原生搜索。");
      const connection = modelConnection ?? (await this.resolveDefaultModel!());
      const query = input.freshness
        ? `${input.query}（优先查找最近${{ day: "一天", week: "一周", month: "一个月" }[input.freshness]}的信息）`
        : input.query;
      const response = await this.nativeGateway.search(
        connection,
        { query, count: input.count },
        signal,
      );
      return response.results;
    }
    if (configuration.provider !== "searxng" && !apiKey) {
      throw configurationError("联网搜索凭据不可用，请在设置中重新配置。");
    }
    return this.gateway.search(
      {
        provider: configuration.provider,
        ...(apiKey ? { apiKey } : {}),
        ...(configuration.baseUrl ? { baseUrl: configuration.baseUrl } : {}),
        ...input,
      },
      signal,
    );
  }

  fetch(url: string, maxCharacters: number, signal: AbortSignal) {
    return this.gateway.fetch({ url, maxCharacters }, signal);
  }

  private async requireOwner(): Promise<string> {
    const session = await this.sessions.get();
    if (!session?.externalUserId) throw configurationError("请先登录后再配置联网搜索。");
    return session.externalUserId;
  }
}

function normalizeBaseUrl(
  provider: WebSearchProviderKind,
  raw: string | undefined,
): string | undefined {
  if (provider !== "searxng") return undefined;
  const value = raw?.trim().replace(/\/+$/, "");
  if (!value || value.length > 2_000) throw configurationError("请填写有效的 SearXNG HTTPS 地址。");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw configurationError("请填写有效的 SearXNG HTTPS 地址。");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw configurationError("SearXNG 仅支持不含账号信息的公网 HTTPS 地址。");
  }
  return parsed.toString().replace(/\/$/, "");
}

function configurationError(message: string): AppError {
  return new AppError({
    code: "WEB_SEARCH_CONFIGURATION_INVALID",
    category: "configuration",
    userMessage: message,
  });
}
