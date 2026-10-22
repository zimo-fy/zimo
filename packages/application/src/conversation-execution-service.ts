import type {
  AgentRunRepository,
  AgentStreamEnvelope,
  Clock,
  ConversationDetail,
  ConversationRepository,
  ContextCompactionRepository,
  IdGenerator,
  Message,
  ModelGateway,
  ModelId,
  ModelRepository,
  RunId,
  SecretStore,
  TokenUsage,
} from "@zimo/domain";
import { AppError, mergeTokenUsage } from "@zimo/domain";

import * as ConversationRun from "./conversation-run";
import type { ConversationCapabilityService } from "./conversation-capability-service";
import { prepareConversationDocumentContext } from "./conversation-document-context";
import type { ConversationWorkflowRunner } from "./conversation-workflow-runner";
import { resolveConversationRouting } from "./conversation-routing";
import {
  scheduleAssistantUsageMerge,
  STREAM_USAGE_DRAIN_MS,
  createDetachedStreamSignal,
} from "./conversation-run-usage";
import { ConversationTitleService } from "./conversation-title-service";
import { pendingUsageFromError, type IntentRouterService } from "./intent-router-service";
import type { KnowledgeService } from "./knowledge-service";
import { runModelToolLoop } from "./model-tool-loop";
import type { PrototypeCatalogService } from "./prototype-catalog-service";
import type { ControlledToolService } from "./tool-runtime";
import type { SkillRuntimeService } from "./skill-runtime-service";
import type { DocumentArtifactService } from "./document-artifact-service";
import { resolveExecutableModel } from "./conversation-model-resolution";
import { attachCurrentTurnImages } from "./conversation-vision";
import type { WorkspaceService } from "./workspace-service";
import type { ApprovalService } from "./approval-service";
import type { UserMemoryService } from "./user-memory-service";
import type { UserQuestionService } from "./user-question-service";
import { conversationActionAuthorizationOption } from "./conversation-action-authorization";
import { createConversationToolRoundCapture } from "./conversation-tool-round-capture";
import { createConversationToolStepReporter } from "./conversation-tool-steps";
import { ContextCompactionService } from "./context-compaction-service";
import { prepareConversationModelContext } from "./conversation-context-preparation";
import { WEB_ACCESS_TOOL_ID_LIST } from "./web-access-tools";
import { USER_MEMORY_TOOL_ID } from "./user-memory-tool";
import { CapabilityDiscoveryService } from "./capability-discovery-service";
import { BROWSER_TOOL_ID_LIST } from "./browser-tool-ids";
import type { SkillMarketplaceService } from "./skill-marketplace-service";
import type { AgentMarketplaceService } from "./agent-marketplace-service";

export class ConversationExecutionService {
  private readonly activeRuns = new Map<string, ConversationRun.ActiveConversationRun>();
  private readonly titleService: ConversationTitleService;
  private readonly contextCompaction: ContextCompactionService | undefined;
  private readonly capabilityDiscovery: CapabilityDiscoveryService;
  private readonly streamUsageDrainMs: number;

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
    contextCompactions?: ContextCompactionRepository,
    private readonly userMemories?: UserMemoryService,
    streamUsageDrainMs?: number,
    private readonly userQuestions?: UserQuestionService,
    skillMarketplace?: SkillMarketplaceService,
    agentMarketplace?: AgentMarketplaceService,
  ) {
    this.streamUsageDrainMs = streamUsageDrainMs ?? STREAM_USAGE_DRAIN_MS;
    this.titleService = new ConversationTitleService(
      conversations,
      models,
      secrets,
      gateway,
      clock,
    );
    this.contextCompaction = contextCompactions
      ? new ContextCompactionService(contextCompactions, gateway, clock, ids, {})
      : undefined;
    this.capabilityDiscovery = new CapabilityDiscoveryService(
      prototypeCatalog,
      tools,
      skillRuntime,
      skillMarketplace,
      agentMarketplace,
    );
  }
  start(
    conversation: ConversationDetail,
    assistant: Message,
    sink: ConversationRun.ConversationStreamSink,
  ): void {
    const runId = conversation.activeRunId as RunId;
    const controller = new AbortController();
    this.activeRuns.set(runId, { controller, terminal: false });
    void this.execute(conversation, assistant, sink, controller).finally(() => {
      this.activeRuns.delete(runId);
    });
  }

  cancel(runId: string): boolean {
    const run = this.activeRuns.get(runId);
    if (!run) return false;
    if (run.terminal) return false;
    run.controller.abort();
    return true;
  }

  cancelAll(): void {
    for (const run of this.activeRuns.values()) {
      if (!run.terminal) run.controller.abort();
    }
  }

  private async execute(
    conversation: ConversationDetail,
    assistant: Message,
    sink: ConversationRun.ConversationStreamSink,
    controller: AbortController,
  ): Promise<void> {
    const runId = conversation.activeRunId as RunId;
    let sequence = 0;
    let usage: TokenUsage | undefined;
    let pendingRouterUsage: Promise<TokenUsage | undefined> | undefined;
    let generationUsage: TokenUsage | undefined;
    let pendingText = "";
    let agentRunStarted = false;
    let lastFlushAt = this.clock.now().getTime();
    let runFinalized = false;
    const emit = (event: AgentStreamEnvelope["event"]) => {
      sink.emit({
        runId,
        sequence: sequence++,
        emittedAt: this.clock.now().toISOString(),
        event,
      });
    };
    const flushText = async () => {
      if (!pendingText) return;
      const value = pendingText;
      await this.conversations.appendMessageText(assistant.id, value, this.clock.now());
      pendingText = pendingText.slice(value.length);
      lastFlushAt = this.clock.now().getTime();
    };

    const persistLateUsage = async (incoming: TokenUsage | undefined) => {
      if (!incoming) return;
      const merged = await this.conversations.mergeMessageUsage(assistant.id, incoming);
      if (merged) emit({ type: "usage.updated", messageId: assistant.id, usage: merged });
    };
    const toolSteps = createConversationToolStepReporter({
      messageId: assistant.id,
      conversations: this.conversations,
      emit,
    });
    const announceCancel = async () => {
      if (runFinalized) return;
      runFinalized = true;
      await flushText().catch(() => undefined);
      await toolSteps.cancelRunning().catch(() => undefined);
      if (agentRunStarted) {
        await this.agentRuns.finish(runId, "cancelled", this.clock.now()).catch(() => undefined);
      }
      await this.conversations.updateMessageStatus(
        assistant.id,
        ["pending", "streaming"],
        "cancelled",
        { updatedAt: this.clock.now() },
      );
      ConversationRun.markTerminal(this.activeRuns.get(runId));
      await this.conversations.clearActiveRun(conversation.id, runId, this.clock.now());
      emit({ type: "run.cancelled" });
    };

    try {
      const capabilityExecution = await this.capabilities.resolve(conversation);
      const { agentExecution, skills, knowledgeBaseIds, workflowId, mcpToolIds } =
        capabilityExecution;
      const agentModelId = agentExecution?.agent.modelId as ModelId | undefined;
      const resolved = workflowId
        ? undefined
        : await resolveExecutableModel(
            this.models,
            agentModelId ?? conversation.modelId,
            agentModelId ? undefined : conversation.catalogModel,
          );
      const apiKey = resolved ? await this.secrets.get(resolved.provider.secretRef) : undefined;
      if (resolved && !apiKey) {
        throw new AppError({
          code: "MODEL_API_KEY_MISSING",
          category: "configuration",
          userMessage: "当前登录账号的模型凭据不可用，请退出后重新登录。",
        });
      }
      if (agentExecution && resolved) {
        await this.agentRuns.start({
          id: runId,
          conversationId: conversation.id,
          agentId: agentExecution.agent.id,
          modelId: resolved.model.id,
          skillIds: skills.map((skill) => skill.id),
          knowledgeBaseIds,
          status: "running",
          createdAt: this.clock.now(),
          updatedAt: this.clock.now(),
        });
        agentRunStarted = true;
      }
      const documentExecution = await prepareConversationDocumentContext({
        conversation,
        documents: this.documents,
        signal: controller.signal,
        vision: resolved?.model.capabilities.vision === true,
      });
      const routeText = documentExecution.visionTurn.currentUserMessage?.content;
      const attachmentContext = documentExecution.context;
      const workspaceExecution = (await this.workspaces?.prepareModelAccess(conversation.id)) ?? {
        toolIds: [],
        mode: "ask" as const,
      };
      const routing = await resolveConversationRouting({
        conversationId: conversation.id,
        runId,
        ...(routeText ? { text: routeText } : {}),
        ...(workflowId ? { workflowId } : {}),
        ...(agentExecution ? { agentId: agentExecution.agent.id } : {}),
        ...(resolved ? { model: resolved } : {}),
        ...(apiKey ? { apiKey } : {}),
        signal: controller.signal,
        router: this.router,
        prototypeCatalog: this.prototypeCatalog,
      });
      usage = routing.usage;
      pendingRouterUsage = routing.pendingUsage;
      emit({ type: "route.completed", route: routing.route });
      if (usage) emit({ type: "usage.updated", messageId: assistant.id, usage });
      if (agentExecution && !workflowId) {
        emit({
          type: "agent.started",
          agentId: agentExecution.agent.id,
          agentName: agentExecution.agent.name,
          skillIds: skills.map((skill) => skill.id),
        });
      }
      const grounding =
        !workflowId && routeText && knowledgeBaseIds.length > 0
          ? await this.knowledge.retrieveContext(knowledgeBaseIds, routeText)
          : undefined;
      if (grounding?.citations.length) {
        await this.conversations.saveKnowledgeCitations(assistant.id, grounding.citations);
        emit({
          type: "knowledge.retrieved",
          messageId: assistant.id,
          citations: grounding.citations,
        });
      }
      await this.conversations.updateMessageStatus(assistant.id, ["pending"], "streaming", {
        updatedAt: this.clock.now(),
      });
      emit({ type: "message.started", messageId: assistant.id });

      if (workflowId && routeText) {
        const result = await this.workflowRunner.run({
          workflowId,
          conversationId: conversation.id,
          text: attachmentContext ? `${routeText}\n\n${attachmentContext}` : routeText,
          skills,
          mcpToolIds,
          signal: controller.signal,
          sink,
        });
        if (result.citations.length) {
          await this.conversations.saveKnowledgeCitations(assistant.id, result.citations);
          emit({
            type: "knowledge.retrieved",
            messageId: assistant.id,
            citations: result.citations,
          });
        }
        if (result.output) {
          pendingText += result.output;
          emit({ type: "message.delta", messageId: assistant.id, text: result.output });
        }
      } else {
        const model = resolved!;
        const agentMcpServerIds = agentExecution?.agent.mcpServerIds ?? [];
        const skillToolIds = await this.skillRuntime.prepareTools(skills);
        const documentToolIds = documentExecution.toolIds;
        const workspaceToolIds = workspaceExecution.toolIds;
        const memorySnapshot = await this.userMemories?.snapshotActive();
        const registeredToolIds = new Set(this.tools.list().map((tool) => tool.id));
        const canSaveUserMemory = Boolean(
          sink.ownerId &&
          model.model.capabilities.toolCalling &&
          memorySnapshot &&
          registeredToolIds.has(USER_MEMORY_TOOL_ID),
        );
        const canAskUserQuestion = Boolean(
          sink.ownerId && this.userQuestions && model.model.capabilities.toolCalling,
        );
        const toolIds = [
          ...mcpToolIds,
          ...skillToolIds,
          ...documentToolIds,
          ...workspaceToolIds,
          ...WEB_ACCESS_TOOL_ID_LIST.filter((toolId) => registeredToolIds.has(toolId)),
          ...(canSaveUserMemory ? [USER_MEMORY_TOOL_ID] : []),
          ...BROWSER_TOOL_ID_LIST.filter((toolId) => registeredToolIds.has(toolId)),
        ];
        const prepared = await prepareConversationModelContext({
          conversation,
          resolved: model,
          apiKey: apiKey!,
          ...(agentExecution ? { agentExecution } : {}),
          skills,
          ...(grounding?.context ? { knowledgeContext: grounding.context } : {}),
          ...(attachmentContext ? { documentContext: attachmentContext } : {}),
          ...(workspaceExecution.context ? { workspaceContext: workspaceExecution.context } : {}),
          agentMcpServerIds,
          toolIds,
          tools: this.tools,
          hasCapabilitySearch: model.model.capabilities.toolCalling,
          ...(this.contextCompaction ? { contextCompaction: this.contextCompaction } : {}),
          ...(memorySnapshot
            ? {
                userMemories: memorySnapshot.memories,
              }
            : {}),
          signal: controller.signal,
          emit,
        });
        const { connection, hasTools } = prepared;
        const messages = await attachCurrentTurnImages(
          prepared.messages,
          documentExecution.visionTurn,
          (messageId) =>
            this.documents.compileMessageImageParts(conversation.id, messageId, controller.signal),
        );
        ConversationRun.inspectConversationModelRequest(sink, {
          conversation,
          runId,
          resolved: model,
          agentExecution,
          skills,
          knowledgeBaseIds,
          grounding,
          documentContext: attachmentContext,
          messages,
        });
        if (controller.signal.aborted) throw ConversationRun.abortError();
        const streamDrain = createDetachedStreamSignal(controller.signal, this.streamUsageDrainMs);
        const onRunAbort = () => {
          void announceCancel().catch(() => undefined);
        };
        controller.signal.addEventListener("abort", onRunAbort, { once: true });
        try {
          if (hasTools || canAskUserQuestion) {
            if (!model.model.capabilities.toolCalling) {
              throw new AppError({
                code: "MODEL_TOOL_CALLING_UNAVAILABLE",
                category: "configuration",
                userMessage: "当前登录模型不支持所选工具能力，请联系管理员检查模型配置。",
              });
            }
            const result = await runModelToolLoop({
              gateway: this.gateway,
              connection,
              messages,
              mcpServerIds: agentMcpServerIds,
              toolIds,
              tools: this.tools,
              signal: controller.signal,
              streamSignal: streamDrain.signal,
              context: {
                runId,
                workflowId: conversation.id,
                nodeId: "conversation-agent",
                ...(canSaveUserMemory && memorySnapshot
                  ? { ownerUserId: memorySnapshot.ownerUserId }
                  : {}),
              },
              createToolCallId: () => this.ids.create(),
              ...conversationActionAuthorizationOption({
                approvals: this.approvals,
                conversationId: conversation.id,
                runId,
                ownerId: sink.ownerId,
                mode: workspaceExecution.mode,
                signal: controller.signal,
                emit,
              }),
              captureRound: createConversationToolRoundCapture({
                sink,
                conversationId: conversation.id,
                runId,
                providerId: model.provider.id,
                modelId: model.model.id,
                modelName: model.model.name,
                agentId: agentExecution?.agent.id ?? null,
                skillIds: skills.map((skill) => skill.id),
                knowledgeBaseIds,
              }),
              onStep: (step) => toolSteps.onStep(step),
              searchCapabilities: (request, activeToolIds, signal) =>
                this.capabilityDiscovery.search(request, activeToolIds, signal),
              ...(canAskUserQuestion
                ? {
                    askUserQuestion: (rawQuestions: Readonly<Record<string, unknown>>) =>
                      this.userQuestions!.ask({
                        rawQuestions,
                        conversationId: conversation.id,
                        runId,
                        ownerId: sink.ownerId!,
                        signal: controller.signal,
                        emit,
                      }),
                  }
                : {}),
              onText: async (text) => {
                if (controller.signal.aborted) return;
                pendingText += text;
                emit({ type: "message.delta", messageId: assistant.id, text });
                if (
                  pendingText.length >= 4_096 ||
                  this.clock.now().getTime() - lastFlushAt >= 250
                ) {
                  await flushText();
                }
              },
            });
            if (result.usage) {
              generationUsage = result.usage;
              usage = mergeTokenUsage(usage, result.usage);
              if (usage) emit({ type: "usage.updated", messageId: assistant.id, usage });
            }
          } else {
            try {
              for await (const event of this.gateway.stream(
                connection,
                messages,
                streamDrain.signal,
              )) {
                if (event.type === "usage") {
                  generationUsage = event.usage;
                  const snapshot = mergeTokenUsage(usage, generationUsage);
                  if (snapshot) {
                    emit({ type: "usage.updated", messageId: assistant.id, usage: snapshot });
                  }
                }
                if (controller.signal.aborted) continue;
                if (event.type === "text" && event.text) {
                  pendingText += event.text;
                  emit({ type: "message.delta", messageId: assistant.id, text: event.text });
                  if (
                    pendingText.length >= 4_096 ||
                    this.clock.now().getTime() - lastFlushAt >= 250
                  ) {
                    await flushText();
                  }
                }
              }
            } catch (error) {
              if (
                !controller.signal.aborted &&
                !(error instanceof Error && error.name === "AbortError")
              ) {
                throw error;
              }
            }
            usage = mergeTokenUsage(usage, generationUsage);
          }
        } finally {
          controller.signal.removeEventListener("abort", onRunAbort);
          streamDrain.dispose();
        }
        if (controller.signal.aborted) {
          await announceCancel();
          await persistLateUsage(usage);
          this.harvestRouterUsage(assistant.id, pendingRouterUsage, emit);
          return;
        }
      }

      await flushText();
      const shouldGenerateTitle =
        conversation.title === "新对话" &&
        Boolean(routeText) &&
        conversation.messages.filter((message) => message.role === "user").length === 1;
      if (shouldGenerateTitle) {
        const titleUsage = await this.titleService.generate({
          conversation,
          runId,
          userText: routeText!,
          resolved,
          apiKey,
          signal: controller.signal,
          sink,
        });
        usage = mergeTokenUsage(usage, titleUsage);
        if (controller.signal.aborted) throw ConversationRun.abortError();
      }
      if (controller.signal.aborted) {
        await announceCancel();
        await persistLateUsage(usage);
        this.harvestRouterUsage(assistant.id, pendingRouterUsage, emit);
        return;
      }
      const completed = await this.conversations.updateMessageStatus(
        assistant.id,
        ["streaming"],
        "completed",
        { ...(usage ? { usage } : {}), updatedAt: this.clock.now() },
      );
      if (!completed) {
        this.harvestRouterUsage(assistant.id, pendingRouterUsage, emit);
        return;
      }
      ConversationRun.markTerminal(this.activeRuns.get(runId));
      await this.conversations.clearActiveRun(conversation.id, runId, this.clock.now());
      if (agentRunStarted) await this.agentRuns.finish(runId, "completed", this.clock.now());
      emit({ type: "message.completed", messageId: assistant.id });
      emit({ type: "run.completed" });
      this.harvestRouterUsage(assistant.id, pendingRouterUsage, emit);
    } catch (error) {
      await flushText().catch(() => undefined);
      pendingRouterUsage = pendingRouterUsage ?? pendingUsageFromError(error);
      const cancelled =
        controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
      if (cancelled) {
        await announceCancel();
        await persistLateUsage(usage);
        this.harvestRouterUsage(assistant.id, pendingRouterUsage, emit);
        return;
      }
      const appError = ConversationRun.toGenerationError(error);
      await toolSteps.failRunning().catch(() => undefined);
      if (agentRunStarted) {
        await this.agentRuns
          .finish(runId, "failed", this.clock.now(), appError.code)
          .catch(() => undefined);
      }
      await this.conversations.updateMessageStatus(
        assistant.id,
        ["pending", "streaming"],
        "failed",
        {
          errorCode: appError.code,
          ...(usage ? { usage } : {}),
          updatedAt: this.clock.now(),
        },
      );
      ConversationRun.markTerminal(this.activeRuns.get(runId));
      await this.conversations.clearActiveRun(conversation.id, runId, this.clock.now());
      emit({
        type: "run.failed",
        error: {
          code: appError.code,
          category: appError.category,
          message: appError.userMessage,
          retryable: appError.retryable,
        },
      });
      this.harvestRouterUsage(assistant.id, pendingRouterUsage, emit);
    }
  }

  private harvestRouterUsage(
    messageId: Message["id"],
    pending: Promise<TokenUsage | undefined> | undefined,
    emit: (event: AgentStreamEnvelope["event"]) => void,
  ): void {
    scheduleAssistantUsageMerge({ pending, messageId, conversations: this.conversations, emit });
  }
}
