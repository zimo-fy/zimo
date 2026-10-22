import type { CatalogModelSelection, ModelId, ModelRepository, ResolvedModel } from "@zimo/domain";
import { AppError, isCatalogModelCode, isCatalogModelId } from "@zimo/domain";

import { MANAGED_ZIMO_MODEL_ID, MANAGED_ZIMO_PROVIDER_ID } from "./model-configuration-service";

export async function requireAvailableModel(models: ModelRepository, modelId: ModelId) {
  const resolved = await models.getModel(modelId);
  if (!resolved || !resolved.provider.enabled || !resolved.model.enabled) {
    throw new AppError({
      code: "MODEL_NOT_AVAILABLE",
      category: "configuration",
      userMessage: "当前模型不可用，请在设置中选择其他模型。",
    });
  }
  return resolved;
}

export async function resolveExecutableModel(
  models: ModelRepository,
  modelId: ModelId,
  catalogModel?: CatalogModelSelection,
): Promise<ResolvedModel> {
  if (!catalogModel) return requireAvailableModel(models, modelId);
  if (!isCatalogModelCode(catalogModel.modelCode) || !isCatalogModelId(catalogModel.catalogId)) {
    throw new AppError({
      code: "MODEL_CATALOG_MODEL_INVALID",
      category: "security",
      userMessage: "云端模型标识无效，请重新选择模型。",
    });
  }
  const managed = await models.getProvider(MANAGED_ZIMO_PROVIDER_ID);
  const model = managed?.models.find((item) => item.id === MANAGED_ZIMO_MODEL_ID && item.enabled);
  if (!managed?.provider.enabled || !model) {
    throw new AppError({
      code: "MODEL_CATALOG_PROVIDER_UNAVAILABLE",
      category: "configuration",
      userMessage: "云端模型需要可用的登录模型配置，请退出后重新登录。",
    });
  }
  return {
    provider: managed.provider,
    model: {
      ...model,
      name: catalogModel.modelCode,
      displayName: catalogModel.displayName,
      capabilities: {
        ...model.capabilities,
        reasoning: catalogModel.supportsReasoning,
        vision: catalogModel.supportsImages,
      },
    },
  };
}
