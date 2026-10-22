export interface CatalogModelSelection {
  catalogId: string;
  modelCode: string;
  displayName: string;
  supportsReasoning: boolean;
  supportsImages: boolean;
}

export interface RemoteModelCatalogEntry extends CatalogModelSelection {
  providerName: string;
}

export interface ModelCatalogGateway {
  list(signal: AbortSignal): Promise<readonly RemoteModelCatalogEntry[]>;
}

const CATALOG_MODEL_ID = /^[A-Za-z0-9_-]{1,32}$/;
const CATALOG_MODEL_CODE = /^[A-Za-z0-9._:@/-]{1,120}$/;

export function isCatalogModelId(value: string): boolean {
  return CATALOG_MODEL_ID.test(value);
}

export function isCatalogModelCode(value: string): boolean {
  return CATALOG_MODEL_CODE.test(value);
}

export const CLOUD_MODEL_OPTION_PREFIX = "cloud:" as const;

export function toCloudModelOptionValue(catalogId: string): string {
  return `${CLOUD_MODEL_OPTION_PREFIX}${catalogId}`;
}

export function parseCloudModelOptionValue(value: string): string | null {
  if (!value.startsWith(CLOUD_MODEL_OPTION_PREFIX)) return null;
  const catalogId = value.slice(CLOUD_MODEL_OPTION_PREFIX.length);
  return isCatalogModelId(catalogId) ? catalogId : null;
}
