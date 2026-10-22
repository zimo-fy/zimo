import { AppError, type ModelCatalogGateway, type RemoteModelCatalogEntry } from "@zimo/domain";

export class ZimoModelCatalogGateway implements ModelCatalogGateway {
  constructor(
    _baseUrl: string,
    _sessions: unknown,
    _secrets: unknown,
    _fetchImpl: typeof fetch = fetch,
  ) {}

  list(_signal: AbortSignal): Promise<readonly RemoteModelCatalogEntry[]> {
    return Promise.reject(
      new AppError({
        code: "MODEL_CATALOG_DISABLED",
        category: "configuration",
        userMessage: "模型目录不从云端接口加载。",
      }),
    );
  }
}
