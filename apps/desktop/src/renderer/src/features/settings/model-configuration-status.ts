import type { ModelProviderView } from "@zimo/contracts";

export const MODEL_SETUP_MESSAGE = "请先配置模型再使用";

export function hasUsableModel(providers: readonly ModelProviderView[]): boolean {
  return providers.some(
    (provider) =>
      provider.enabled &&
      provider.baseUrl.trim().length > 0 &&
      provider.models.some((model) => model.enabled && model.name.trim().length > 0),
  );
}
