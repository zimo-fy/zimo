import type {
  Clock,
  ContextCompactionRepository,
  ConversationDetail,
  IdGenerator,
  ModelGateway,
  ModelId,
  ModelRepository,
  RunId,
  SecretStore,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import type { ConversationStreamSink } from "./conversation-run";
import { runAlreadyActive } from "./conversation-run";
import type { ConversationCapabilityService } from "./conversation-capability-service";
import {
  ContextCompactionService,
  latestCompletedCompaction,
  type ContextCompactionOptions,
} from "./context-compaction-service";
import { compileConversationMessages } from "./conversation-model-messages";
import { resolveExecutableModel } from "./conversation-model-resolution";

export class ManualConversationCompactionService {
  private readonly active = new Map<string, AbortController>();
  private readonly compaction: ContextCompactionService | undefined;

  constructor(
    private readonly models: ModelRepository,
    private readonly secrets: SecretStore,
    private readonly capabilities: ConversationCapabilityService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    gateway: ModelGateway,
    repository?: ContextCompactionRepository,
    options: Readonly<Pick<ContextCompactionOptions, "retainMessageCount">> = {},
  ) {
    this.compaction = repository
      ? new ContextCompactionService(repository, gateway, clock, ids, options)
      : undefined;
  }

  isCompacting(conversationId: string): boolean {
    return this.active.has(conversationId);
  }

  cancel(conversationId: string): boolean {
    const controller = this.active.get(conversationId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  cancelAll(): void {
    for (const controller of this.active.values()) controller.abort();
  }

  async compact(conversation: ConversationDetail, sink: ConversationStreamSink): Promise<void> {
    if (!this.compaction)
      throw new AppError({
        code: "CONTEXT_COMPACTION_UNAVAILABLE",
        category: "configuration",
        userMessage: "当前无法整理上下文。",
      });
    if (this.isCompacting(conversation.id) || conversation.activeRunId) throw runAlreadyActive();
    const runId = this.ids.create() as RunId;
    const controller = new AbortController();
    this.active.set(conversation.id, controller);
    const timeout = setTimeout(() => controller.abort("timeout"), 120_000);
    let sequence = 0;
    try {
      const capabilities = await this.capabilities.resolve(conversation);
      if (capabilities.workflowId)
        throw new AppError({
          code: "CONTEXT_COMPACTION_WORKFLOW_UNAVAILABLE",
          category: "user",
          userMessage: "当前会话正在使用工作流，暂不支持手动压缩工作流上下文。",
        });
      const agentModelId = capabilities.agentExecution?.agent.modelId as ModelId | undefined;
      const resolved = await resolveExecutableModel(
        this.models,
        agentModelId ?? conversation.modelId,
        agentModelId ? undefined : conversation.catalogModel,
      );
      const apiKey = await this.secrets.get(resolved.provider.secretRef);
      if (!apiKey)
        throw new AppError({
          code: "MODEL_API_KEY_MISSING",
          category: "configuration",
          userMessage: "当前模型凭据不可用。",
        });
      const latest = latestCompletedCompaction(conversation.contextCompactions);
      await this.compaction.prepare({
        conversation,
        contextCompactions: conversation.contextCompactions,
        surfaceMessages: compileConversationMessages({
          history: conversation.messages,
          skills: capabilities.skills,
          hasTools: false,
          ...(capabilities.agentExecution ? { agentExecution: capabilities.agentExecution } : {}),
          ...(latest ? { contextCompaction: latest } : {}),
        }),
        resolved,
        connection: { baseUrl: resolved.provider.baseUrl, modelName: resolved.model.name, apiKey },
        extraContextTokens: 0,
        signal: controller.signal,
        trigger: "manual",
        emit: (event) =>
          sink.emit({
            runId,
            sequence: sequence++,
            emittedAt: this.clock.now().toISOString(),
            event,
          }),
      });
    } catch (error) {
      if (controller.signal.reason === "timeout")
        throw new AppError({
          code: "CONTEXT_COMPACTION_TIMEOUT",
          category: "model",
          userMessage: "上下文整理超时，请稍后重试。",
          retryable: true,
        });
      if (controller.signal.aborted)
        throw new AppError({
          code: "CONTEXT_COMPACTION_CANCELLED",
          category: "user",
          userMessage: "已取消上下文整理。",
        });
      throw error;
    } finally {
      clearTimeout(timeout);
      this.active.delete(conversation.id);
    }
  }
}
