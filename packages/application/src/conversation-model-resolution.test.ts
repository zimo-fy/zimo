import { describe, expect, it } from "vitest";
import type { ModelId, ModelProviderId, ModelProviderWithModels } from "@zimo/domain";

import { MANAGED_ZIMO_MODEL_ID, MANAGED_ZIMO_PROVIDER_ID } from "./model-configuration-service";
import { resolveExecutableModel } from "./conversation-model-resolution";

describe("resolveExecutableModel", () => {
  it("uses the saved model identifier, display name, and API address", async () => {
    const repository = new MemoryModelRepository();

    const resolved = await resolveExecutableModel(repository, MANAGED_ZIMO_MODEL_ID);

    expect(resolved.provider.baseUrl).toBe("https://configured.example/v1");
    expect(resolved.model.name).toBe("configured-model");
    expect(resolved.model.displayName).toBe("Configured Model");
  });

  it("uses the cloud model code with the managed provider connection", async () => {
    const repository = new MemoryModelRepository();
    const resolved = await resolveExecutableModel(repository, MANAGED_ZIMO_MODEL_ID, {
      catalogId: "6",
      modelCode: "deepseek-v4-pro",
      displayName: "deepseek-v4-pro",
      supportsReasoning: true,
      supportsImages: true,
    });

    expect(resolved.model.name).toBe("deepseek-v4-pro");
    expect(resolved.model.displayName).toBe("deepseek-v4-pro");
    expect(resolved.model.capabilities.reasoning).toBe(true);
    expect(resolved.model.capabilities.vision).toBe(true);
    expect(resolved.provider.id).toBe(MANAGED_ZIMO_PROVIDER_ID);
  });

  it("treats missing catalog image support as vision disabled", async () => {
    const repository = new MemoryModelRepository();
    const resolved = await resolveExecutableModel(repository, MANAGED_ZIMO_MODEL_ID, {
      catalogId: "7",
      modelCode: "deepseek-v4-flash",
      displayName: "deepseek-v4-flash",
      supportsReasoning: false,
      supportsImages: false,
    });

    expect(resolved.model.capabilities.vision).toBe(false);
    expect(resolved.model.capabilities.reasoning).toBe(false);
  });
});

class MemoryModelRepository {
  private readonly provider: ModelProviderWithModels = {
    provider: {
      id: MANAGED_ZIMO_PROVIDER_ID,
      name: "Configured Provider",
      baseUrl: "https://configured.example/v1",
      secretRef: "secret-ref",
      keyHint: "****",
      kind: "openai-compatible",
      enabled: true,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
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
        enabled: true,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      },
    ],
  };

  async listProviders() {
    return [this.provider];
  }
  async getProvider(id: ModelProviderId) {
    return id === MANAGED_ZIMO_PROVIDER_ID ? this.provider : null;
  }
  async getModel(id: ModelId) {
    const model = this.provider.models.find((item) => item.id === id);
    return model ? { provider: this.provider.provider, model } : null;
  }
  async saveProvider() {}
  async deleteProvider() {}
  async hasProviderReferences() {
    return false;
  }
  async getDefaultModelId() {
    return MANAGED_ZIMO_MODEL_ID;
  }
  async setDefaultModelId() {}
}
