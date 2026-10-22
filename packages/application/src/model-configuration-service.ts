import type {
  Clock,
  IdGenerator,
  ModelCapabilities,
  ModelGateway,
  ModelConnection,
  ModelId,
  ModelProviderId,
  ModelProviderWithModels,
  ModelRepository,
  SecretStore,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import { requireText } from "./input-validation";

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  streaming: true,
  toolCalling: false,
  structuredOutput: false,
  vision: false,
  reasoning: false,
  promptCaching: false,
};
export const MANAGED_ZIMO_PROVIDER_ID = "6d21df20-fac5-4fd6-b7a1-29f86d86d8d3" as ModelProviderId;
export const MANAGED_ZIMO_MODEL_ID = "3aab4a95-0e5e-40c4-a09e-f59cc27d4fbc" as ModelId;
export const MANAGED_ZIMO_MAX_CONTEXT_TOKENS = 1_200_000;
interface ModelConfigurationOptions {
  allowInsecureLocalhost?: boolean | undefined;
  allowManagedEditing?: boolean | undefined;
  managedOnly?: boolean | undefined;
}
export interface SaveProviderCommand {
  providerId?: string | undefined;
  name: string;
  baseUrl: string;
  apiKey?: string | undefined;
  enabled?: boolean | undefined;
  model: {
    id?: string | undefined;
    name: string;
    displayName: string;
    capabilities?: ModelCapabilities | undefined;
  };
}

export type ProviderConnectionTestCommand =
  { providerId: string } | { baseUrl: string; apiKey: string; modelName: string };

export class ModelConfigurationService {
  constructor(
    private readonly repository: ModelRepository,
    private readonly secrets: SecretStore,
    private readonly gateway: ModelGateway,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly options: ModelConfigurationOptions = {},
  ) {}

  async list(): Promise<readonly ModelProviderWithModels[]> {
    const providers = await this.repository.listProviders();
    return this.options.managedOnly
      ? providers.filter((provider) => provider.provider.id === MANAGED_ZIMO_PROVIDER_ID)
      : providers;
  }

  getDefaultModelId(): Promise<ModelId | null> {
    return this.repository.getDefaultModelId();
  }

  async getSavedConnection(providerId: string): Promise<ModelConnection> {
    const resolved = await this.repository.getProvider(providerId as ModelProviderId);
    const model = resolved?.models.find((item) => item.enabled);
    if (!resolved?.provider.enabled || !model) {
      throw new AppError({
        code: "MODEL_PROVIDER_NOT_FOUND",
        category: "configuration",
        userMessage: "没有可用的模型配置。",
      });
    }
    const apiKey = await this.secrets.get(resolved.provider.secretRef);
    if (!apiKey)
      throw new AppError({
        code: "MODEL_API_KEY_MISSING",
        category: "configuration",
        userMessage: "当前登录账号的模型凭据不可用，请退出后重新登录。",
      });
    return { baseUrl: resolved.provider.baseUrl, modelName: model.name, apiKey };
  }

  async getDefaultConnection(): Promise<ModelConnection> {
    const modelId = await this.repository.getDefaultModelId();
    const providers = await this.repository.listProviders();
    const provider = providers.find((item) => item.models.some((model) => model.id === modelId));
    if (!provider)
      throw new AppError({
        code: "MODEL_PROVIDER_NOT_FOUND",
        category: "configuration",
        userMessage: "没有可用的默认模型。",
      });
    return this.getSavedConnection(provider.provider.id);
  }

  async save(command: SaveProviderCommand): Promise<ModelProviderWithModels> {
    const isManagedDevelopmentUpdate = this.isManagedDevelopmentUpdate(command);
    if (this.options.managedOnly && !isManagedDevelopmentUpdate) {
      throw managedConfigurationError();
    }
    const baseUrl = this.validateBaseUrl(command.baseUrl);
    const modelName = requireText(command.model.name, "模型名称", 120);
    const existing = command.providerId
      ? await this.repository.getProvider(command.providerId as ModelProviderId)
      : null;
    if (command.providerId && !existing) {
      throw new AppError({
        code: "MODEL_PROVIDER_NOT_FOUND",
        category: "user",
        userMessage: "没有找到要修改的模型提供商。",
      });
    }
    if (isManagedDevelopmentUpdate && existing?.models[0]?.id !== MANAGED_ZIMO_MODEL_ID) {
      throw managedConfigurationError();
    }
    const name = isManagedDevelopmentUpdate
      ? existing!.provider.name
      : requireText(command.name, "提供商名称", 80);
    const displayName = isManagedDevelopmentUpdate
      ? modelName
      : requireText(command.model.displayName, "模型显示名称", 120);

    const apiKey = command.apiKey?.trim();
    if (!existing && !apiKey) {
      throw new AppError({
        code: "MODEL_API_KEY_REQUIRED",
        category: "configuration",
        userMessage: "请填写 API Key。",
      });
    }

    const providerId = (existing?.provider.id ?? this.ids.create()) as ModelProviderId;
    const modelId = (existing?.models[0]?.id ?? command.model.id ?? this.ids.create()) as ModelId;
    const oldSecretRef = existing?.provider.secretRef;
    const nextSecretRef = apiKey ? this.ids.create() : oldSecretRef;
    if (!nextSecretRef) {
      throw new AppError({
        code: "MODEL_API_KEY_REQUIRED",
        category: "configuration",
        userMessage: "请填写 API Key。",
      });
    }

    if (apiKey) {
      try {
        await this.secrets.set(nextSecretRef, apiKey);
      } catch (error) {
        throw new AppError({
          code: "SECRET_STORE_UNAVAILABLE",
          category: "configuration",
          userMessage: "系统安全存储当前不可用，无法保存 API Key。",
          cause: error,
        });
      }
    }

    const now = this.clock.now();
    const value: ModelProviderWithModels = {
      provider: {
        id: providerId,
        name,
        baseUrl,
        secretRef: nextSecretRef,
        keyHint: apiKey ? keyHint(apiKey) : (existing?.provider.keyHint ?? "••••"),
        kind: "openai-compatible",
        enabled: isManagedDevelopmentUpdate
          ? true
          : (command.enabled ?? existing?.provider.enabled ?? true),
        createdAt: existing?.provider.createdAt ?? now,
        updatedAt: now,
      },
      models: [
        {
          id: modelId,
          providerId,
          name: modelName,
          displayName,
          capabilities: managedCapabilities(
            isManagedDevelopmentUpdate,
            existing?.models[0]?.capabilities,
            command.model.capabilities,
          ),
          enabled: true,
          createdAt: existing?.models[0]?.createdAt ?? now,
          updatedAt: now,
        },
      ],
    };

    try {
      await this.repository.saveProvider(value);
    } catch (error) {
      if (apiKey) await this.secrets.delete(nextSecretRef).catch(() => undefined);
      throw error;
    }
    if (apiKey && oldSecretRef && oldSecretRef !== nextSecretRef) {
      await this.secrets.delete(oldSecretRef).catch(() => undefined);
    }
    return value;
  }

  async delete(providerId: string): Promise<void> {
    this.assertManualConfigurationAllowed();
    const id = providerId as ModelProviderId;
    const provider = await this.repository.getProvider(id);
    if (!provider) return;
    if (await this.repository.hasProviderReferences(id)) {
      throw new AppError({
        code: "MODEL_PROVIDER_IN_USE",
        category: "user",
        userMessage: "该提供商仍被会话使用，请先切换或删除相关会话。",
      });
    }
    await this.repository.deleteProvider(id, this.clock.now());
    await this.secrets.delete(provider.provider.secretRef).catch(() => undefined);
  }

  async setDefault(modelId: string): Promise<ModelId> {
    const id = modelId as ModelId;
    if (this.options.managedOnly && id !== MANAGED_ZIMO_MODEL_ID) {
      throw managedConfigurationError();
    }
    const resolved = await this.repository.getModel(id);
    if (!resolved || !resolved.provider.enabled || !resolved.model.enabled) {
      throw new AppError({
        code: "MODEL_NOT_AVAILABLE",
        category: "configuration",
        userMessage: "所选模型当前不可用。",
      });
    }
    await this.repository.setDefaultModelId(id);
    return id;
  }

  async test(command: ProviderConnectionTestCommand, signal?: AbortSignal): Promise<void> {
    if ("providerId" in command) {
      const resolved = await this.repository.getProvider(command.providerId as ModelProviderId);
      const model = resolved?.models.find((item) => item.enabled);
      if (!resolved || !model) {
        throw new AppError({
          code: "MODEL_PROVIDER_NOT_FOUND",
          category: "configuration",
          userMessage: "没有可测试的模型配置。",
        });
      }
      const apiKey = await this.secrets.get(resolved.provider.secretRef);
      if (!apiKey) {
        throw new AppError({
          code: "MODEL_API_KEY_MISSING",
          category: "configuration",
          userMessage: "当前登录账号的模型凭据不可用，请退出后重新登录。",
        });
      }
      await this.gateway.testConnection(
        { baseUrl: resolved.provider.baseUrl, apiKey, modelName: model.name },
        signal,
      );
      return;
    }
    this.assertManualConfigurationAllowed();
    await this.gateway.testConnection(
      {
        baseUrl: this.validateBaseUrl(command.baseUrl),
        apiKey: command.apiKey,
        modelName: requireText(command.modelName, "模型名称", 120),
      },
      signal,
    );
  }

  async provisionManagedZimoModel(apiKeyInput: string): Promise<ModelProviderWithModels> {
    const apiKey = requireText(apiKeyInput, "登录模型凭据", 16_384);
    const existing = await this.repository.getProvider(MANAGED_ZIMO_PROVIDER_ID);
    const existingModel = existing?.models.find((item) => item.id === MANAGED_ZIMO_MODEL_ID);
    const modelName = existingModel?.name.trim() ?? "";
    const displayName = existingModel?.displayName.trim() ?? "";
    const savedBaseUrl = existing?.provider.baseUrl.trim() ?? "";
    const configured = Boolean(
      existing && existingModel && savedBaseUrl && modelName && displayName,
    );
    const baseUrl = configured ? this.validateBaseUrl(savedBaseUrl) : "";
    const oldSecretRef = existing?.provider.secretRef;
    const nextSecretRef = this.ids.create();
    try {
      await this.secrets.set(nextSecretRef, apiKey);
    } catch (cause) {
      throw new AppError({
        code: "SECRET_STORE_UNAVAILABLE",
        category: "configuration",
        userMessage: "系统安全存储当前不可用，无法保存登录账号的模型凭据。",
        cause,
      });
    }
    const now = this.clock.now();
    const value: ModelProviderWithModels = {
      provider: {
        id: MANAGED_ZIMO_PROVIDER_ID,
        name: existing?.provider.name.trim() || "登录模型",
        baseUrl,
        secretRef: nextSecretRef,
        keyHint: keyHint(apiKey),
        kind: "openai-compatible",
        enabled: true,
        createdAt: existing?.provider.createdAt ?? now,
        updatedAt: now,
      },
      models: [
        {
          id: MANAGED_ZIMO_MODEL_ID,
          providerId: MANAGED_ZIMO_PROVIDER_ID,
          name: modelName,
          displayName,
          capabilities: {
            ...(existingModel?.capabilities ?? DEFAULT_CAPABILITIES),
            toolCalling: existingModel?.capabilities.toolCalling ?? true,
            maxContextTokens: MANAGED_ZIMO_MAX_CONTEXT_TOKENS,
          },
          enabled: configured,
          createdAt: existingModel?.createdAt ?? now,
          updatedAt: now,
        },
      ],
    };
    try {
      await this.repository.saveProvider(value);
      await this.repository.setDefaultModelId(MANAGED_ZIMO_MODEL_ID);
      await this.disableLegacyProviders(now);
    } catch (cause) {
      await this.secrets.delete(nextSecretRef).catch(() => undefined);
      throw cause;
    }
    if (oldSecretRef && oldSecretRef !== nextSecretRef) {
      await this.secrets.delete(oldSecretRef).catch(() => undefined);
    }
    return value;
  }

  async hasManagedZimoModel(): Promise<boolean> {
    const provider = await this.repository.getProvider(MANAGED_ZIMO_PROVIDER_ID);
    if (!provider) return false;
    return Boolean(await this.secrets.get(provider.provider.secretRef));
  }

  async ensureManagedZimoCapabilities(): Promise<void> {
    const existing = await this.repository.getProvider(MANAGED_ZIMO_PROVIDER_ID);
    const model = existing?.models.find((item) => item.id === MANAGED_ZIMO_MODEL_ID);
    if (
      !existing ||
      !model ||
      model.capabilities.maxContextTokens === MANAGED_ZIMO_MAX_CONTEXT_TOKENS
    )
      return;
    const now = this.clock.now();
    await this.repository.saveProvider({
      provider: { ...existing.provider, updatedAt: now },
      models: existing.models.map((item) =>
        item.id === MANAGED_ZIMO_MODEL_ID
          ? {
              ...item,
              capabilities: {
                ...item.capabilities,
                maxContextTokens: MANAGED_ZIMO_MAX_CONTEXT_TOKENS,
              },
              updatedAt: now,
            }
          : item,
      ),
    });
  }

  async deactivateManagedZimoModel(): Promise<void> {
    const existing = await this.repository.getProvider(MANAGED_ZIMO_PROVIDER_ID);
    if (!existing) return;
    await this.repository.saveProvider({
      provider: { ...existing.provider, enabled: false, updatedAt: this.clock.now() },
      models: existing.models.map((model) => ({ ...model, enabled: false })),
    });
    await this.secrets.delete(existing.provider.secretRef);
  }

  private async disableLegacyProviders(now: Date): Promise<void> {
    const providers = await this.repository.listProviders();
    await Promise.all(
      providers
        .filter(
          (provider) =>
            provider.provider.id !== MANAGED_ZIMO_PROVIDER_ID && provider.provider.enabled,
        )
        .map((provider) =>
          this.repository.saveProvider({
            provider: { ...provider.provider, enabled: false, updatedAt: now },
            models: provider.models.map((model) => ({ ...model, enabled: false, updatedAt: now })),
          }),
        ),
    );
  }

  private assertManualConfigurationAllowed(): void {
    if (this.options.managedOnly) throw managedConfigurationError();
  }

  private isManagedDevelopmentUpdate(command: SaveProviderCommand): boolean {
    return !!(
      this.options.managedOnly &&
      this.options.allowManagedEditing &&
      command.providerId === MANAGED_ZIMO_PROVIDER_ID &&
      command.model.id === MANAGED_ZIMO_MODEL_ID
    );
  }

  private validateBaseUrl(raw: string): string {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      throw invalidProviderUrl();
    }
    const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(this.options.allowInsecureLocalhost && isLoopback))
    ) {
      throw invalidProviderUrl();
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  }
}

function managedCapabilities(
  preserveExisting: boolean,
  existing: ModelCapabilities | undefined,
  requested: ModelCapabilities | undefined,
): ModelCapabilities {
  const previous = existing ?? DEFAULT_CAPABILITIES;
  if (!preserveExisting) return requested ?? previous;
  return {
    ...previous,
    vision: requested?.vision ?? previous.vision,
    maxContextTokens: previous.maxContextTokens ?? MANAGED_ZIMO_MAX_CONTEXT_TOKENS,
  };
}

function managedConfigurationError(): AppError {
  return new AppError({
    code: "MODEL_CONFIGURATION_MANAGED",
    category: "configuration",
    userMessage: "模型配置由当前登录账号统一提供，无需手动修改。",
  });
}

function keyHint(apiKey: string): string {
  const suffix = apiKey.slice(-4);
  return `••••${suffix}`;
}

function invalidProviderUrl(): AppError {
  return new AppError({
    code: "MODEL_PROVIDER_URL_INVALID",
    category: "security",
    userMessage: "API 地址必须使用 HTTPS。开发测试可显式启用 localhost HTTP。",
  });
}
