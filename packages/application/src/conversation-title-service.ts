import type {
  Clock,
  Conversation,
  ConversationRepository,
  ModelConnection,
  ModelGateway,
  ModelId,
  ModelRepository,
  ResolvedModel,
  RunId,
  SecretStore,
  TokenUsage,
} from "@zimo/domain";

import { inspectConversationTitleRequest, type ConversationStreamSink } from "./conversation-run";

const TITLE_SYSTEM_PROMPT =
  "ZIMO_TASK_TITLE: 根据用户请求生成简洁的中文任务标题。只返回标题，不要引号、标点、Markdown 或解释；建议 4 至 18 个汉字。";

export class ConversationTitleService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly models: ModelRepository,
    private readonly secrets: SecretStore,
    private readonly gateway: ModelGateway,
    private readonly clock: Clock,
  ) {}

  async generate(input: {
    conversation: Conversation;
    runId: RunId;
    userText: string;
    resolved?: ResolvedModel | undefined;
    apiKey?: string | null | undefined;
    signal: AbortSignal;
    sink: ConversationStreamSink;
  }): Promise<TokenUsage | undefined> {
    const startedAt = this.clock.now().getTime();
    try {
      const resolved = input.resolved ?? (await this.models.getModel(input.conversation.modelId));
      if (!resolved || !resolved.provider.enabled || !resolved.model.enabled) {
        this.report(input, startedAt, "failure", "MODEL_NOT_AVAILABLE");
        return undefined;
      }
      const apiKey = input.apiKey ?? (await this.secrets.get(resolved.provider.secretRef));
      if (!apiKey) {
        this.report(input, startedAt, "failure", "MODEL_API_KEY_MISSING", resolved.model.id);
        return undefined;
      }
      const messages = [
        { role: "system" as const, content: TITLE_SYSTEM_PROMPT },
        { role: "user" as const, content: input.userText },
      ];
      inspectConversationTitleRequest(input.sink, {
        conversation: input.conversation,
        runId: input.runId,
        resolved,
        messages,
      });
      const result = await generateTitle(
        this.gateway,
        {
          baseUrl: resolved.provider.baseUrl,
          apiKey,
          modelName: resolved.model.name,
        },
        messages,
        input.signal,
      );
      const title = result.title ?? fallbackTitle(input.userText);
      if (!title || result.outcome === "cancelled") {
        this.report(input, startedAt, result.outcome, result.errorCode, resolved.model.id);
        return result.usage;
      }
      const current = await this.conversations.getById(input.conversation.id);
      if (current?.title === "新对话") {
        await this.conversations.rename(current.id, title, this.clock.now());
      }
      this.report(
        input,
        startedAt,
        result.title ? "success" : result.outcome,
        result.errorCode,
        resolved.model.id,
        title.length,
      );
      return result.usage;
    } catch {
      this.report(input, startedAt, "failure", "TASK_TITLE_GENERATION_FAILED");
      return undefined;
    }
  }

  private report(
    input: { conversation: Conversation; runId: RunId; sink: ConversationStreamSink },
    startedAt: number,
    outcome: "success" | "failure" | "cancelled" | "timeout",
    errorCode?: string,
    modelId?: ModelId,
    titleCharacters?: number,
  ) {
    input.sink.inspectTitleGeneration?.({
      conversationId: input.conversation.id,
      runId: input.runId,
      ...(modelId ? { modelId } : {}),
      outcome,
      durationMs: Math.max(0, this.clock.now().getTime() - startedAt),
      ...(errorCode ? { errorCode } : {}),
      ...(titleCharacters !== undefined ? { titleCharacters } : {}),
    });
  }
}

export async function generateTitle(
  gateway: ModelGateway,
  connection: ModelConnection,
  messages: readonly { role: "system" | "user"; content: string }[],
  parentSignal: AbortSignal,
): Promise<{
  title?: string;
  usage?: TokenUsage;
  outcome: "success" | "failure" | "cancelled" | "timeout";
  errorCode?: string;
}> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener("abort", abort, { once: true });
  try {
    let value = "";
    let usage: TokenUsage | undefined;
    for await (const event of gateway.stream(connection, messages, controller.signal)) {
      if (event.type === "text") value += event.text;
      else if (event.type === "usage") usage = event.usage;
    }
    const title = normalizeTitle(value);
    return title
      ? { title, outcome: "success", ...(usage ? { usage } : {}) }
      : { outcome: "failure", errorCode: "TASK_TITLE_EMPTY", ...(usage ? { usage } : {}) };
  } catch {
    if (parentSignal.aborted) return { outcome: "cancelled", errorCode: "TASK_TITLE_CANCELLED" };
    return { outcome: "failure", errorCode: "TASK_TITLE_GENERATION_FAILED" };
  } finally {
    parentSignal.removeEventListener("abort", abort);
  }
}

export function fallbackTitle(userText: string): string | undefined {
  const firstLine = userText.trim().split(/\r?\n/u)[0] ?? "";
  const normalized = firstLine
    .replace(/^(?:请|麻烦)?(?:帮我|帮忙)?(?:看下|看看|处理一下|处理下)?/u, "")
    .replace(/^[，,。！？!?：:\s]+/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalized) return undefined;
  return Array.from(normalized).slice(0, 24).join("");
}

export function normalizeTitle(value: string): string | undefined {
  const firstLine = value.trim().split(/\r?\n/u)[0] ?? "";
  const normalized = firstLine
    .replace(/^#{1,6}\s*/u, "")
    .replace(/^(任务标题|标题)\s*[:：]\s*/u, "")
    .replace(/^[「『“"'`]+|[」』”"'`。！？!?，,；;：:]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (normalized.length < 2) return undefined;
  return Array.from(normalized).slice(0, 30).join("");
}
