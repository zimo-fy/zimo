import type {
  AgentRunRepository,
  Clock,
  Conversation,
  ConversationDetail,
  ConversationId,
  ConversationRepository,
  ContextCompactionRepository,
  IdGenerator,
  MessageId,
  ModelGateway,
  ModelId,
  ModelRepository,
  RunId,
  SecretStore,
} from "@zimo/domain";
import { AppError, isDocumentImageFormat } from "@zimo/domain";

import * as ConversationRun from "./conversation-run";
import type { ConversationCapabilityService } from "./conversation-capability-service";
import { ConversationExecutionService } from "./conversation-execution-service";
import type { ConversationWorkflowRunner } from "./conversation-workflow-runner";
import { requireText } from "./input-validation";
import type { IntentRouterService } from "./intent-router-service";
import type { KnowledgeService } from "./knowledge-service";
import type { PrototypeCatalogService } from "./prototype-catalog-service";
import type { ControlledToolService } from "./tool-runtime";
import type { SkillRuntimeService } from "./skill-runtime-service";
import type { DocumentArtifactService } from "./document-artifact-service";
import type { WorkspaceService } from "./workspace-service";
import { requireAvailableModel, resolveExecutableModel } from "./conversation-model-resolution";
import { requireVisionCapability } from "./conversation-vision";
import type { ApprovalService } from "./approval-service";
import type { UserMemoryService } from "./user-memory-service";
import type { UserQuestionService } from "./user-question-service";
import { ManualConversationCompactionService } from "./manual-conversation-compaction-service";
import type { SkillMarketplaceService } from "./skill-marketplace-service";
import type { AgentMarketplaceService } from "./agent-marketplace-service";
import type { ModelCatalogService } from "./model-catalog-service";

export class ConversationService {
  private readonly execution: ConversationExecutionService;
  private readonly manualCompaction: ManualConversationCompactionService;

  constructor(
    private readonly conversations: ConversationRepository,
    private readonly models: ModelRepository,
    private readonly secrets: SecretStore,
    private readonly gateway: ModelGateway,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly router: IntentRouterService,
    private readonly prototypeCatalog: PrototypeCatalogService,
    private readonly agentRuns: AgentRunRepository,
    private readonly knowledge: KnowledgeService,
    private readonly tools: ControlledToolService,
    private readonly skillRuntime: SkillRuntimeService,
    private readonly capabilities: ConversationCapabilityService,
    private readonly workflowRunner: ConversationWorkflowRunner,
    private readonly documents: DocumentArtifactService,
    private readonly workspaces?: WorkspaceService,
    private readonly approvals?: ApprovalService,
    private readonly contextCompactions?: ContextCompactionRepository,
    private readonly userMemories?: UserMemoryService,
    streamUsageDrainMs?: number,
    manualCompactionRetainMessageCount?: number,
    userQuestions?: UserQuestionService,
    skillMarketplace?: SkillMarketplaceService,
    agentMarketplace?: AgentMarketplaceService,
    private readonly modelCatalog?: ModelCatalogService,
  ) {
    this.execution = new ConversationExecutionService(
      conversations,
      models,
      secrets,
      gateway,
      clock,
      ids,
      router,
      prototypeCatalog,
      agentRuns,
      knowledge,
      tools,
      skillRuntime,
      capabilities,
      workflowRunner,
      documents,
      workspaces,
      approvals,
      contextCompactions,
      userMemories,
      streamUsageDrainMs,
      userQuestions,
      skillMarketplace,
      agentMarketplace,
    );
    this.manualCompaction = new ManualConversationCompactionService(
      models,
      secrets,
      capabilities,
      clock,
      ids,
      gateway,
      contextCompactions,
      manualCompactionRetainMessageCount === undefined
        ? {}
        : { retainMessageCount: manualCompactionRetainMessageCount },
    );
  }

  list() {
    return this.conversations.list();
  }

  async get(id: string): Promise<ConversationDetail> {
    const value = await this.conversations.getById(id as ConversationId);
    if (!value) throw ConversationRun.conversationNotFound();
    return {
      ...value,
      contextCompactions: (await this.contextCompactions?.listByConversation(value.id)) ?? [],
    };
  }

  async create(modelId?: string): Promise<ConversationDetail> {
    const selectedId = (modelId as ModelId | undefined) ?? (await this.models.getDefaultModelId());
    if (!selectedId) {
      throw new AppError({
        code: "DEFAULT_MODEL_REQUIRED",
        category: "configuration",
        userMessage: "请先在设置中配置并选择默认模型。",
      });
    }
    await requireAvailableModel(this.models, selectedId);
    const now = this.clock.now();
    const value: Conversation = {
      id: this.ids.create() as ConversationId,
      title: "新对话",
      modelId: selectedId,
      skillIds: [],
      knowledgeBaseIds: [],
      mcpToolIds: [],
      browserEnabled: true,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.conversations.create(value);
    return { ...value, contextCompactions: [] };
  }

  async rename(id: string, rawTitle: string): Promise<ConversationDetail> {
    const title = requireText(rawTitle, "会话标题", 120);
    await this.get(id);
    await this.conversations.rename(id as ConversationId, title, this.clock.now());
    return this.get(id);
  }

  async setPinned(id: string, pinned: boolean): Promise<void> {
    await this.get(id);
    await this.conversations.setPinned(id as ConversationId, pinned);
  }

  async changeModel(id: string, modelId: string): Promise<ConversationDetail> {
    const conversation = await this.get(id);
    if (this.manualCompaction.isCompacting(id)) throw ConversationRun.runAlreadyActive();
    if (conversation.activeRunId) throw ConversationRun.runAlreadyActive();
    await requireAvailableModel(this.models, modelId as ModelId);
    await this.conversations.changeModel(
      id as ConversationId,
      modelId as ModelId,
      this.clock.now(),
    );
    return this.get(id);
  }

  async selectCatalogModel(id: string, catalogId: string): Promise<ConversationDetail> {
    if (!this.modelCatalog) {
      throw new AppError({
        code: "MODEL_CATALOG_UNAVAILABLE",
        category: "configuration",
        userMessage: "云端模型目录当前不可用。",
      });
    }
    const conversation = await this.get(id);
    if (this.manualCompaction.isCompacting(id) || conversation.activeRunId) {
      throw ConversationRun.runAlreadyActive();
    }
    const entry = await this.modelCatalog.require(catalogId);
    await this.conversations.setCatalogModel(
      id as ConversationId,
      {
        catalogId: entry.catalogId,
        modelCode: entry.modelCode,
        displayName: entry.displayName,
        supportsReasoning: entry.supportsReasoning,
        supportsImages: entry.supportsImages,
      },
      this.clock.now(),
    );
    return this.get(id);
  }

  async changeAgent(id: string, agentId: string | null): Promise<ConversationDetail> {
    const conversation = await this.get(id);
    return this.changeCapabilities(id, {
      agentId,
      skillIds: conversation.skillIds,
      knowledgeBaseIds: conversation.knowledgeBaseIds,
      workflowId: conversation.workflowId ?? null,
      mcpToolIds: conversation.mcpToolIds,
      browserEnabled: conversation.browserEnabled,
    });
  }

  async changeKnowledgeBases(
    id: string,
    knowledgeBaseIds: readonly string[],
  ): Promise<ConversationDetail> {
    const conversation = await this.get(id);
    return this.changeCapabilities(id, {
      agentId: conversation.agentId ?? null,
      skillIds: conversation.skillIds,
      knowledgeBaseIds,
      workflowId: conversation.workflowId ?? null,
      mcpToolIds: conversation.mcpToolIds,
      browserEnabled: conversation.browserEnabled,
    });
  }

  async changeCapabilities(
    id: string,
    input: {
      agentId: string | null;
      skillIds: readonly string[];
      knowledgeBaseIds: readonly string[];
      workflowId: string | null;
      mcpToolIds: readonly string[];
      browserEnabled: boolean;
    },
  ): Promise<ConversationDetail> {
    if (this.manualCompaction.isCompacting(id)) throw ConversationRun.runAlreadyActive();
    await this.capabilities.change(id, input, this.clock.now());
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const value = await this.get(id);
    if (this.manualCompaction.isCompacting(id)) throw ConversationRun.runAlreadyActive();
    if (value.activeRunId) this.cancel(value.activeRunId);
    await this.conversations.softDelete(id as ConversationId, this.clock.now());
  }

  async send(
    input: {
      conversationId: string;
      content: string;
      artifactIds?: readonly string[];
    },
    sink: ConversationRun.ConversationStreamSink,
  ): Promise<{ runId: string; userMessageId: string; assistantMessageId: string }> {
    const artifactIds = [...new Set(input.artifactIds ?? [])];
    if (artifactIds.length !== (input.artifactIds?.length ?? 0) || artifactIds.length > 10) {
      throw new AppError({
        code: "DOCUMENT_ATTACHMENT_INVALID",
        category: "user",
        userMessage: "附件数量或标识无效，请重新选择。",
      });
    }
    const conversation = await this.get(input.conversationId);
    const drafts =
      artifactIds.length > 0
        ? (await this.documents.list(conversation.id)).filter(
            (artifact) => artifactIds.includes(artifact.id) && !artifact.messageId,
          )
        : [];
    const hasImages = drafts.some((artifact) => isDocumentImageFormat(artifact.format));
    const resolved = await resolveExecutableModel(
      this.models,
      conversation.modelId,
      conversation.catalogModel,
    );
    requireVisionCapability(hasImages, resolved.model.capabilities.vision);
    const content = input.content.trim()
      ? requireText(input.content, "消息", 100_000)
      : hasImages
        ? ""
        : requireText(input.content, "消息", 100_000);
    if (this.manualCompaction.isCompacting(conversation.id))
      throw ConversationRun.runAlreadyActive();
    if (conversation.activeRunId) throw ConversationRun.runAlreadyActive();
    const runId = this.ids.create() as RunId;
    const now = this.clock.now();
    const modelDisplayName = await this.generationModelDisplayName(conversation);
    const userMessage = ConversationRun.makeConversationMessage(
      this.ids.create() as MessageId,
      conversation,
      "user",
      content,
      now,
    );
    const assistantMessage = ConversationRun.makeConversationMessage(
      this.ids.create() as MessageId,
      conversation,
      "assistant",
      "",
      now,
      { offset: 1, ...(modelDisplayName ? { modelDisplayName } : {}) },
    );
    await this.conversations.createRunMessages({
      conversationId: conversation.id,
      runId,
      userMessage,
      assistantMessage,
      artifactIds,
    });
    this.execution.start(
      { ...conversation, activeRunId: runId, messages: [...conversation.messages, userMessage] },
      assistantMessage,
      sink,
    );
    return { runId, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id };
  }

  async regenerate(
    conversationId: string,
    messageId: string,
    sink: ConversationRun.ConversationStreamSink,
  ): Promise<{ runId: string; assistantMessageId: string }> {
    const conversation = await this.get(conversationId);
    if (this.manualCompaction.isCompacting(conversation.id))
      throw ConversationRun.runAlreadyActive();
    if (conversation.activeRunId) throw ConversationRun.runAlreadyActive();
    const replaced = conversation.messages.find(
      (message) => message.id === messageId && message.role === "assistant",
    );
    if (!replaced) {
      throw new AppError({
        code: "MESSAGE_NOT_REGENERATABLE",
        category: "user",
        userMessage: "只能重新生成已有的助手回答。",
      });
    }
    const history = conversation.messages.filter((message) => message.position < replaced.position);
    const runId = this.ids.create() as RunId;
    const modelDisplayName = await this.generationModelDisplayName(conversation);
    const assistantMessage = ConversationRun.makeConversationMessage(
      this.ids.create() as MessageId,
      conversation,
      "assistant",
      "",
      this.clock.now(),
      {
        replacesMessageId: replaced.id,
        ...(modelDisplayName ? { modelDisplayName } : {}),
      },
    );
    await this.conversations.createRunMessages({
      conversationId: conversation.id,
      runId,
      assistantMessage,
    });
    this.execution.start(
      { ...conversation, activeRunId: runId, messages: history },
      assistantMessage,
      sink,
    );
    return { runId, assistantMessageId: assistantMessage.id };
  }

  cancel(runId: string): boolean {
    return this.execution.cancel(runId);
  }

  async compact(
    conversationId: string,
    sink: ConversationRun.ConversationStreamSink,
  ): Promise<ConversationDetail> {
    const conversation = await this.get(conversationId);
    await this.manualCompaction.compact(conversation, sink);
    return this.get(conversationId);
  }

  cancelCompaction(conversationId: string): boolean {
    return this.manualCompaction.cancel(conversationId);
  }

  cancelAll(): void {
    this.execution.cancelAll();
    this.manualCompaction.cancelAll();
  }

  private async generationModelDisplayName(
    conversation: Conversation,
  ): Promise<string | undefined> {
    const catalogName = conversation.catalogModel?.displayName.trim();
    if (catalogName) return catalogName.slice(0, 120);
    const resolved = await this.models.getModel(conversation.modelId);
    const localName = resolved?.model.displayName.trim();
    return localName ? localName.slice(0, 120) : undefined;
  }
}
