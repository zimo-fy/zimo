import { AppError, type ModelCatalogGateway, type RemoteModelCatalogEntry } from "@zimo/domain";

const LIST_TIMEOUT_MS = 20_000;

export class ModelCatalogService {
  constructor(private readonly gateway: ModelCatalogGateway) {}

  list(): Promise<readonly RemoteModelCatalogEntry[]> {
    return withTimeout((signal) => this.gateway.list(signal), LIST_TIMEOUT_MS);
  }

  async require(catalogId: string): Promise<RemoteModelCatalogEntry> {
    const entry = (await this.list()).find((item) => item.catalogId === catalogId);
    if (!entry) {
      throw new AppError({
        code: "MODEL_CATALOG_ITEM_NOT_FOUND",
        category: "user",
        userMessage: "云端模型不存在或已停用，请重新选择。",
      });
    }
    return entry;
  }
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (cause) {
    if (!timedOut && !controller.signal.aborted) throw cause;
    throw new AppError({
      code: timedOut ? "MODEL_CATALOG_TIMEOUT" : "MODEL_CATALOG_CANCELLED",
      category: timedOut ? "network" : "user",
      userMessage: timedOut ? "获取云端模型超时，请稍后重试。" : "云端模型请求已取消。",
      retryable: timedOut,
      cause,
    });
  } finally {
    clearTimeout(timer);
  }
}
