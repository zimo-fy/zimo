import { describe, expect, it } from "vitest";

import type {
  ModelGateway,
  ModelId,
  ModelProviderId,
  ModelProviderWithModels,
  ModelRepository,
  SecretStore,
} from "@zimo/domain";

import {
  MANAGED_ZIMO_MODEL_ID,
  MANAGED_ZIMO_MAX_CONTEXT_TOKENS,
  MANAGED_ZIMO_PROVIDER_ID,
  ModelConfigurationService,
} from "./model-configuration-service";

describe("ModelConfigurationService managed login model", () => {
  it("stores the login model key and keeps the saved model configuration", async () => {
    const repository = new MemoryModelRepository();
    const secrets = new MemorySecretStore();
    repository.providers.set(legacyProvider.provider.id, legacyProvider);
    seedConfiguredModel(repository);
    const service = createService(repository, secrets);

    const provider = await service.provisionManagedZimoModel("login-model-key-canary");

    expect(provider).toMatchObject({
      provider: {
        id: MANAGED_ZIMO_PROVIDER_ID,
        name: "Configured Provider",
        baseUrl: "https://configured.example/v1",
        enabled: true,
      },
      models: [
        {
          id: MANAGED_ZIMO_MODEL_ID,
          name: "configured-model",
          displayName: "Configured Model",
          capabilities: {
            streaming: true,
            toolCalling: true,
            maxContextTokens: MANAGED_ZIMO_MAX_CONTEXT_TOKENS,
          },
        },
      ],
    });
    expect(await service.getDefaultModelId()).toBe(MANAGED_ZIMO_MODEL_ID);
    expect(await service.list()).toEqual([provider]);
    expect(await secrets.get(provider.provider.secretRef)).toBe("login-model-key-canary");
    expect(repository.providers.get(legacyProvider.provider.id)?.provider.enabled).toBe(false);
  });

  it("keeps the saved model identifier and API address when login refreshes the key", async () => {
    const repository = new MemoryModelRepository();
    const secrets = new MemorySecretStore();
    seedConfiguredModel(repository);
    const service = createService(repository, secrets);
    const provider = await service.provisionManagedZimoModel("login-model-key-canary");
    repository.providers.set(provider.provider.id, {
      provider: { ...provider.provider, baseUrl: "https://updated.example/v1" },
      models: provider.models.map((model) => ({
        ...model,
        name: "updated-model",
        displayName: "Updated Model",
      })),
    });

    const refreshed = await service.provisionManagedZimoModel("rotated-login-key");

    expect(refreshed.provider.baseUrl).toBe("https://updated.example/v1");
    expect(refreshed.models[0]?.name).toBe("updated-model");
    expect(refreshed.models[0]?.displayName).toBe("Updated Model");
    expect(await secrets.get(refreshed.provider.secretRef)).toBe("rotated-login-key");
    expect(await secrets.get(provider.provider.secretRef)).toBeNull();
  });

  it("adds the managed context limit to an existing login model", async () => {
    const repository = new MemoryModelRepository();
    const secrets = new MemorySecretStore();
    seedConfiguredModel(repository);
    const service = createService(repository, secrets);
    const provider = await service.provisionManagedZimoModel("login-model-key-canary");
    repository.providers.set(provider.provider.id, {
      ...provider,
      models: provider.models.map((model) => {
        const legacyCapabilities = { ...model.capabilities };
        delete legacyCapabilities.maxContextTokens;
        return { ...model, capabilities: legacyCapabilities };
      }),
    });

    await service.ensureManagedZimoCapabilities();

    expect(
      repository.providers.get(MANAGED_ZIMO_PROVIDER_ID)?.models[0]?.capabilities,
    ).toMatchObject({ maxContextTokens: MANAGED_ZIMO_MAX_CONTEXT_TOKENS });
  });

  it("rejects manual model configuration in managed mode", async () => {
    const service = createService(new MemoryModelRepository(), new MemorySecretStore());

    await expect(
      service.save({
        name: "Manual",
        baseUrl: "https://example.com/v1",
        apiKey: "secret",
        model: { name: "manual", displayName: "Manual" },
      }),
    ).rejects.toMatchObject({ code: "MODEL_CONFIGURATION_MANAGED" });
  });

  it("updates only the managed model fields in development and rotates an optional key", async () => {
    const repository = new MemoryModelRepository();
    const secrets = new MemorySecretStore();
    seedConfiguredModel(repository);
    const service = createService(repository, secrets, { allowManagedEditing: true });
    const provisioned = await service.provisionManagedZimoModel("login-model-key-canary");

    const updatedWithoutKey = await service.save({
      providerId: MANAGED_ZIMO_PROVIDER_ID,
      name: provisioned.provider.name,
      baseUrl: "https://first-development-model.example/v1",
      model: {
        id: MANAGED_ZIMO_MODEL_ID,
        name: "deepseek-first-development",
        displayName: provisioned.models[0]!.displayName,
      },
    });
    expect(updatedWithoutKey.provider.secretRef).toBe(provisioned.provider.secretRef);
    expect(await secrets.get(updatedWithoutKey.provider.secretRef)).toBe("login-model-key-canary");

    const updated = await service.save({
      providerId: MANAGED_ZIMO_PROVIDER_ID,
      name: "Renderer cannot rename this provider",
      baseUrl: "https://development-model.example/v1/",
      apiKey: "development-key-canary",
      enabled: false,
      model: {
        id: MANAGED_ZIMO_MODEL_ID,
        name: "deepseek-development",
        displayName: "Renderer cannot rename this model",
        capabilities: {
          streaming: false,
          toolCalling: false,
          structuredOutput: true,
          vision: true,
          reasoning: true,
          promptCaching: true,
        },
      },
    });

    expect(updated).toMatchObject({
      provider: {
        name: provisioned.provider.name,
        baseUrl: "https://development-model.example/v1",
        enabled: true,
      },
      models: [
        {
          name: "deepseek-development",
          displayName: "deepseek-development",
          capabilities: { ...provisioned.models[0]!.capabilities, vision: true },
        },
      ],
    });
    expect(await secrets.get(updated.provider.secretRef)).toBe("development-key-canary");
    expect(await secrets.get(updatedWithoutKey.provider.secretRef)).toBeNull();
  });

  it("does not let development editing create or replace another provider", async () => {
    const repository = new MemoryModelRepository();
    const service = createService(repository, new MemorySecretStore(), {
      allowManagedEditing: true,
    });
    seedConfiguredModel(repository);
    await service.provisionManagedZimoModel("login-model-key-canary");

    await expect(
      service.save({
        providerId: legacyProvider.provider.id,
        name: "Legacy",
        baseUrl: "https://example.com/v1",
        model: {
          id: legacyProvider.models[0]!.id,
          name: "legacy",
          displayName: "Legacy",
        },
      }),
    ).rejects.toMatchObject({ code: "MODEL_CONFIGURATION_MANAGED" });
  });

  it("removes the managed credential when the account logs out", async () => {
    const repository = new MemoryModelRepository();
    const secrets = new MemorySecretStore();
    seedConfiguredModel(repository);
    const service = createService(repository, secrets);
    const provider = await service.provisionManagedZimoModel("login-model-key-canary");

    await service.deactivateManagedZimoModel();

    expect(await service.hasManagedZimoModel()).toBe(false);
    expect(await secrets.get(provider.provider.secretRef)).toBeNull();
    expect(repository.providers.get(MANAGED_ZIMO_PROVIDER_ID)?.provider.enabled).toBe(false);
  });

  it("keeps login available when the model configuration is still empty", async () => {
    const repository = new MemoryModelRepository();
    const secrets = new MemorySecretStore();
    const service = createService(repository, secrets);

    const provider = await service.provisionManagedZimoModel("login-model-key-canary");

    expect(provider.provider.baseUrl).toBe("");
    expect(provider.models[0]).toMatchObject({
      name: "",
      displayName: "",
      enabled: false,
      capabilities: { vision: false },
    });
    expect(await secrets.get(provider.provider.secretRef)).toBe("login-model-key-canary");
    expect(await service.hasManagedZimoModel()).toBe(true);
  });
});

function createService(
  repository: MemoryModelRepository,
  secrets: MemorySecretStore,
  options: { allowManagedEditing?: boolean } = {},
) {
  const ids = ["secret-ref-1", "secret-ref-2"];
  return new ModelConfigurationService(
    repository,
    secrets,
    {} as ModelGateway,
    { now: () => new Date("2026-09-09T00:00:00.000Z") },
    { create: () => ids.shift() ?? "secret-ref-next" },
    { managedOnly: true, ...options },
  );
}

function seedConfiguredModel(repository: MemoryModelRepository): void {
  repository.providers.set(MANAGED_ZIMO_PROVIDER_ID, {
    provider: {
      id: MANAGED_ZIMO_PROVIDER_ID,
      name: "Configured Provider",
      baseUrl: "https://configured.example/v1",
      secretRef: "old-secret",
      keyHint: "••••old",
      kind: "openai-compatible",
      enabled: false,
      createdAt: new Date("2026-09-08T00:00:00.000Z"),
      updatedAt: new Date("2026-09-08T00:00:00.000Z"),
    },
    models: [
      {
        id: MANAGED_ZIMO_MODEL_ID,
        providerId: MANAGED_ZIMO_PROVIDER_ID,
        name: "configured-model",
        displayName: "Configured Model",
        capabilities: {
          streaming: true,
          toolCalling: true,
          structuredOutput: false,
          vision: false,
          reasoning: false,
          promptCaching: false,
        },
        enabled: false,
        createdAt: new Date("2026-09-08T00:00:00.000Z"),
        updatedAt: new Date("2026-09-08T00:00:00.000Z"),
      },
    ],
  });
}

const legacyProvider: ModelProviderWithModels = {
  provider: {
    id: "00000000-0000-4000-8000-000000000201" as ModelProviderId,
    name: "Legacy",
    baseUrl: "https://legacy.example/v1",
    secretRef: "legacy-secret-ref",
    keyHint: "••••gacy",
    kind: "openai-compatible",
    enabled: true,
    createdAt: new Date("2026-09-08T00:00:00.000Z"),
    updatedAt: new Date("2026-09-08T00:00:00.000Z"),
  },
  models: [
    {
      id: "00000000-0000-4000-8000-000000000202" as ModelId,
      providerId: "00000000-0000-4000-8000-000000000201" as ModelProviderId,
      name: "legacy-model",
      displayName: "Legacy Model",
      capabilities: {
        streaming: true,
        toolCalling: false,
        structuredOutput: false,
        vision: false,
        reasoning: false,
        promptCaching: false,
      },
      enabled: true,
      createdAt: new Date("2026-09-08T00:00:00.000Z"),
      updatedAt: new Date("2026-09-08T00:00:00.000Z"),
    },
  ],
};

class MemoryModelRepository implements ModelRepository {
  readonly providers = new Map<ModelProviderId, ModelProviderWithModels>();
  defaultModelId: ModelId | null = null;

  async listProviders() {
    return [...this.providers.values()];
  }

  async getProvider(id: ModelProviderId) {
    return this.providers.get(id) ?? null;
  }

  async getModel(id: ModelId) {
    for (const value of this.providers.values()) {
      const model = value.models.find((candidate) => candidate.id === id);
      if (model) return { provider: value.provider, model };
    }
    return null;
  }

  async saveProvider(value: ModelProviderWithModels) {
    this.providers.set(value.provider.id, value);
  }

  async deleteProvider(id: ModelProviderId) {
    this.providers.delete(id);
  }

  async hasProviderReferences() {
    return false;
  }

  async getDefaultModelId() {
    return this.defaultModelId;
  }

  async setDefaultModelId(id: ModelId) {
    this.defaultModelId = id;
  }
}

class MemorySecretStore implements SecretStore {
  readonly values = new Map<string, string>();

  async getStatus() {
    return { available: true, backend: "memory", persistent: true };
  }

  async set(ref: string, value: string) {
    this.values.set(ref, value);
  }

  async get(ref: string) {
    return this.values.get(ref) ?? null;
  }

  async delete(ref: string) {
    this.values.delete(ref);
  }
}
