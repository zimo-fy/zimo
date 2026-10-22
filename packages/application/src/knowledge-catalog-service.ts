import {
  AppError,
  type KnowledgeDirectoryCatalogGateway,
  type RemoteKnowledgeDirectoryCatalog,
} from "@zimo/domain";

const LIST_TIMEOUT_MS = 30_000;

export class KnowledgeDirectoryCatalogService {
  constructor(private readonly gateway: KnowledgeDirectoryCatalogGateway) {}

  listTree(): Promise<RemoteKnowledgeDirectoryCatalog> {
    return withTimeout((signal) => this.gateway.listTree(signal), LIST_TIMEOUT_MS);
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
      code: timedOut ? "KNOWLEDGE_CATALOG_TIMEOUT" : "KNOWLEDGE_CATALOG_CANCELLED",
      category: timedOut ? "network" : "user",
      userMessage: timedOut ? "获取云端知识库目录超时，请稍后重试。" : "云端知识库目录请求已取消。",
      retryable: timedOut,
      cause,
    });
  } finally {
    clearTimeout(timer);
  }
}
