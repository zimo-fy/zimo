import type { CatalogModelView, ModelView } from "@zimo/contracts";

const CLOUD_MODEL_OPTION_PREFIX = "cloud:";

function toCloudModelOptionValue(catalogId: string): string {
  return `${CLOUD_MODEL_OPTION_PREFIX}${catalogId}`;
}

export function parseCloudModelSelectionValue(value: string): string | null {
  if (!value.startsWith(CLOUD_MODEL_OPTION_PREFIX)) return null;
  const catalogId = value.slice(CLOUD_MODEL_OPTION_PREFIX.length);
  return /^[A-Za-z0-9_-]{1,32}$/.test(catalogId) ? catalogId : null;
}

export interface ChatModelOption {
  value: string;
  label: string;
  description: string;
}

export function buildChatModelOptions(input: {
  localModels: readonly ModelView[];
  cloudModels: readonly CatalogModelView[];
  agentModelId?: string | undefined;
}): ChatModelOption[] {
  const agentHint = input.agentModelId ? "Agent 可能覆盖此模型" : "当前会话模型";
  const local = input.localModels.map((model) => ({
    value: model.id,
    label: model.displayName,
    description: agentHint,
  }));
  const cloud = input.cloudModels.map((model) => ({
    value: toCloudModelOptionValue(model.catalogId),
    label: model.displayName,
    description: `${model.providerName}`,
  }));
  return [...local, ...cloud];
}

export function selectedChatModelValue(input: {
  modelId: string;
  catalogModel?: { catalogId: string } | undefined;
}): string {
  return input.catalogModel
    ? toCloudModelOptionValue(input.catalogModel.catalogId)
    : input.modelId;
}
