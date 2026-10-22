import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import type {
  ConversationDetailView,
  McpConnectionView,
  ModelProviderView,
  PrototypeDetailView,
  PrototypeSummaryView,
  RouteTargetView,
} from "@zimo/contracts";
import { Spinner } from "@zimo/ui";

import { ConversationHeader, ConversationInitializing, ConversationNotice } from "./chat-chrome";
import { ChatComposer } from "./chat-composer";
import { handleChatFileDrop, hasDroppedFiles } from "./chat-file-drop";
import { ConversationMessages } from "./conversation-messages";
import { applyRegenerateAccepted } from "./conversation-display-messages";
import { retainMessageUsage } from "./chat-stream";
import { DocumentDropOverlay, DocumentPreviewDialog } from "./document-attachments";
import { useChatArtifacts } from "./use-chat-artifacts";
import { useChatCapabilities } from "./use-chat-capabilities";
import { useChatWorkspaces } from "./use-chat-workspaces";
import { useChatApprovals } from "./use-chat-approvals";
import { useChatQuestions } from "./use-chat-questions";
import { useChatStreamSubscription } from "./use-chat-stream-subscription";
import {
  buildChatModelOptions,
  parseCloudModelSelectionValue,
  selectedChatModelValue,
} from "./chat-model-options";

export function ChatPage({
  conversationId,
  draft,
  taskRevision,
  initialAgentId,
  onInitialAgentConsumed,
  onTasksChanged,
  onDraftCommitted,
  onCreateConversation,
  onOpenSettings,
}: {
  conversationId?: string | undefined;
  draft: boolean;
  taskRevision: number;
  initialAgentId?: string | undefined;
  onInitialAgentConsumed(): void;
  onTasksChanged(): Promise<void>;
  onDraftCommitted(id: string): void;
  onCreateConversation(): void;
  onOpenSettings(): void;
}) {
  const [detail, setDetail] = useState<ConversationDetailView | null>(null);
  const [providers, setProviders] = useState<ModelProviderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [content, setContent] = useState("");
  const [errorState, setErrorState] = useState<{
    conversationId: string | undefined;
    message: string;
  } | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [routeTargets, setRouteTargets] = useState<RouteTargetView[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<PrototypeSummaryView[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<PrototypeDetailView | null>(null);
  const [mcpConnections, setMcpConnections] = useState<readonly McpConnectionView[]>([]);
  const activeId = useRef<string | null>(null);
  const dragDepth = useRef(0);
  const preferredAgentId = useRef(initialAgentId);
  const setError: Dispatch<SetStateAction<string | null>> = useCallback(
    (value) => {
      setErrorState((previous) => {
        const currentMessage =
          previous && previous.conversationId === conversationId ? previous.message : null;
        const message = typeof value === "function" ? value(currentMessage) : value;
        return message ? { conversationId, message } : null;
      });
    },
    [conversationId],
  );
  const error =
    errorState && errorState.conversationId === conversationId ? errorState.message : null;
  const capabilityActions = useChatCapabilities({
    detail,
    setDetail,
    setSelectedAgent,
    setError,
  });
  const artifactActions = useChatArtifacts(setError);
  const workspaceActions = useChatWorkspaces(setError);
  const approvalActions = useChatApprovals(setError);
  const questionActions = useChatQuestions(setError);
  const refreshArtifacts = artifactActions.refresh;
  const refreshWorkspaces = workspaceActions.refresh;
  const refreshApprovals = approvalActions.refresh;
  const refreshQuestions = questionActions.refresh;

  const localModels = useMemo(
    () => providers.flatMap((provider) => provider.models.filter((model) => model.enabled)),
    [providers],
  );
  const savedCatalogModel = detail?.catalogModel;
  const modelOptions = useMemo(
    () =>
      buildChatModelOptions({
        localModels,
        cloudModels: savedCatalogModel ? [{ ...savedCatalogModel, providerName: "当前会话" }] : [],
        agentModelId: selectedAgent?.modelId,
      }),
    [localModels, savedCatalogModel, selectedAgent?.modelId],
  );
  const displayedDetail = detail?.id === conversationId ? detail : null;
  const modelValue = displayedDetail
    ? selectedChatModelValue({
        modelId: displayedDetail.modelId,
        catalogModel: displayedDetail.catalogModel,
      })
    : "";
  const pendingApproval = approvalActions.pending.find(
    (item) => item.event.conversationId === displayedDetail?.id,
  );
  const pendingQuestion = questionActions.pending.find(
    (item) => item.conversationId === displayedDetail?.id,
  );

  const openConversation = useCallback(
    async (id: string, preferredAgentId?: string) => {
      let result = await window.zimo.conversations.get(crypto.randomUUID(), id);
      if (!result.ok) {
        if (result.error.code === "CONVERSATION_NOT_FOUND") {
          await onTasksChanged();
          return;
        }
        setError(result.error.message);
        return;
      }
      if (preferredAgentId && result.data.agentId !== preferredAgentId) {
        result = await window.zimo.conversations.changeAgent(
          crypto.randomUUID(),
          id,
          preferredAgentId,
        );
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
      }
      activeId.current = id;
      setDetail((current) => retainMessageUsage(current, result.data));
      await Promise.all([
        refreshArtifacts(id),
        refreshWorkspaces(id),
        refreshApprovals(id),
        refreshQuestions(id),
      ]);
      if (activeId.current !== id) return;
      if (!result.data.agentId) {
        setSelectedAgent(null);
        return;
      }
      const agentResult = await window.zimo.prototypes.get(
        crypto.randomUUID(),
        "agent",
        result.data.agentId,
      );
      if (activeId.current !== id) return;
      if (agentResult.ok) setSelectedAgent(agentResult.data);
      else {
        setSelectedAgent(null);
        setError(agentResult.error.message);
      }
    },
    [
      onTasksChanged,
      refreshApprovals,
      refreshArtifacts,
      refreshWorkspaces,
      refreshQuestions,
      setError,
    ],
  );

  const handleRunTerminal = useCallback(() => {
    const id = activeId.current;
    if (id) void openConversation(id);
    void onTasksChanged();
  }, [onTasksChanged, openConversation]);

  useChatStreamSubscription({
    setDetail,
    setSending,
    setError,
    applyApproval: approvalActions.applyStream,
    applyQuestion: questionActions.applyStream,
    onTerminal: handleRunTerminal,
  });

  useEffect(() => {
    let active = true;
    void Promise.all([
      window.zimo.models.list(crypto.randomUUID()),
      window.zimo.router.listTargets(crypto.randomUUID()),
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "knowledge", status: "enabled" }),
      window.zimo.mcp.list(crypto.randomUUID()),
    ]).then(([providerResult, targetResult, knowledgeResult, mcpResult]) => {
      if (!active) return;
      if (providerResult.ok) setProviders(providerResult.data);
      if (targetResult.ok) setRouteTargets(targetResult.data);
      if (knowledgeResult.ok) setKnowledgeBases(knowledgeResult.data);
      if (mcpResult.ok) setMcpConnections(mcpResult.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    preferredAgentId.current = initialAgentId;
  }, [initialAgentId]);

  useEffect(() => {
    if (loading) return;
    if (!conversationId) {
      activeId.current = null;
      return;
    }
    const agentId = preferredAgentId.current;
    preferredAgentId.current = undefined;
    if (agentId) onInitialAgentConsumed();
    void openConversation(conversationId, agentId);
  }, [conversationId, loading, onInitialAgentConsumed, openConversation, taskRevision]);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = content.trim();
    if (!detail || !text || sending) return;
    const draftArtifactIds = artifactActions.artifacts
      .filter((artifact) => artifact.conversationId === detail.id)
      .filter((artifact) => !artifact.messageId)
      .map((artifact) => artifact.id);
    setContent("");
    setError(null);
    setSending(true);
    const result = await window.zimo.conversations.send(
      crypto.randomUUID(),
      detail.id,
      text,
      draftArtifactIds,
    );
    if (!result.ok) {
      setSending(false);
      setContent(text);
      setError(result.error.message);
      return;
    }
    if (draft) onDraftCommitted(detail.id);
    await openConversation(detail.id);
    await onTasksChanged();
  }

  async function stopGeneration() {
    if (!detail?.activeRunId) return;
    await window.zimo.conversations.cancel(crypto.randomUUID(), detail.activeRunId);
  }

  async function compactConversation() {
    if (!displayedDetail || compacting || sending || displayedDetail.activeRunId) return;
    setCompacting(true);
    setError(null);
    try {
      const result = await window.zimo.conversations.compact(
        crypto.randomUUID(),
        displayedDetail.id,
      );
      if (!result.ok) {
        if (result.error.code !== "CONTEXT_COMPACTION_CANCELLED") setError(result.error.message);
        return;
      }
      if (activeId.current === result.data.id) setDetail(result.data);
    } catch {
      setError("会话整理失败，请稍后重试。");
    } finally {
      setCompacting(false);
    }
  }

  async function regenerate(messageId?: string) {
    if (!detail || sending || compacting) return;
    const targetId =
      messageId ??
      [...detail.messages].reverse().find((message) => message.role === "assistant")?.id;
    if (!targetId) return;
    setSending(true);
    setError(null);
    const result = await window.zimo.conversations.regenerate(
      crypto.randomUUID(),
      detail.id,
      targetId,
    );
    if (!result.ok) {
      setSending(false);
      setError(result.error.message);
      return;
    }
    setDetail((current) => applyRegenerateAccepted(current, detail.id, targetId, result.data));
    await openConversation(detail.id);
  }

  async function changeModel(value: string) {
    if (!detail) return;
    if (parseCloudModelSelectionValue(value)) return;
    const result = await window.zimo.conversations.changeModel(
      crypto.randomUUID(),
      detail.id,
      value,
    );
    if (result.ok) {
      setDetail(result.data);
      await onTasksChanged();
    } else setError(result.error.message);
  }

  useEffect(() => {
    if (!loading && localModels.length === 0) onOpenSettings();
  }, [loading, localModels.length, onOpenSettings]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="正在恢复对话" />
      </div>
    );
  }

  if (!localModels.length) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="请先配置模型再使用" />
      </div>
    );
  }

  return (
    <div className="h-screen min-w-0">
      <section
        className="relative flex h-full min-h-0 min-w-0 flex-col bg-neutral-50"
        onDragEnter={(event) => {
          if (!hasDroppedFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepth.current += 1;
          setDraggingFiles(true);
        }}
        onDragOver={(event) => {
          if (hasDroppedFiles(event.dataTransfer)) event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!hasDroppedFiles(event.dataTransfer)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDraggingFiles(false);
        }}
        onDrop={(event) => {
          if (!hasDroppedFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDraggingFiles(false);
          const files = Array.from(event.dataTransfer.files);
          if (displayedDetail)
            void handleChatFileDrop({
              conversationId: displayedDetail.id,
              files,
              attachWorkspace: workspaceActions.attachDropped,
              importArtifacts: artifactActions.importDropped,
            });
        }}
      >
        {draggingFiles && displayedDetail && !sending && <DocumentDropOverlay />}
        {displayedDetail ? (
          <>
            {!draft && <ConversationHeader title={displayedDetail.title} />}
            {error && <ConversationNotice message={error} onDismiss={() => setError(null)} />}

            <ConversationMessages
              detail={displayedDetail}
              containerLabel={draft ? "新建任务空白会话" : undefined}
              artifacts={artifactActions.artifacts.filter(
                (artifact) => artifact.conversationId === displayedDetail.id,
              )}
              onExportArtifact={(artifactId, revisionId) =>
                void artifactActions.exportArtifact(displayedDetail.id, artifactId, revisionId)
              }
              onPreviewArtifact={(artifactId, revisionId) =>
                void artifactActions.previewArtifact(displayedDetail.id, artifactId, revisionId)
              }
              compacting={compacting}
              onCompact={() => void compactConversation()}
              onRegenerate={(messageId) => void regenerate(messageId)}
              onCancelCompaction={() => {
                void window.zimo.conversations.cancelCompaction(
                  crypto.randomUUID(),
                  displayedDetail.id,
                );
              }}
            />
            <ChatComposer
              detail={displayedDetail}
              modelOptions={modelOptions}
              modelValue={modelValue}
              routeTargets={routeTargets}
              knowledgeBases={knowledgeBases}
              selectedAgent={selectedAgent}
              mcpConnections={mcpConnections}
              content={content}
              sending={sending}
              savingCapabilities={capabilityActions.savingCapabilities || artifactActions.busy}
              error={null}
              draftArtifacts={artifactActions.artifacts.filter(
                (artifact) => artifact.conversationId === displayedDetail.id && !artifact.messageId,
              )}
              importingFiles={artifactActions.busy}
              workspaces={workspaceActions.workspaces.filter(
                (workspace) => workspace.conversationId === displayedDetail.id,
              )}
              workspaceBusy={workspaceActions.busy}
              {...(pendingApproval ? { pendingApproval } : {})}
              {...(pendingQuestion ? { pendingQuestion } : {})}
              approvalBusy={approvalActions.busy}
              questionBusy={questionActions.busy}
              onContentChange={setContent}
              onSelectAgent={(agentId) => void capabilityActions.selectAgent(agentId)}
              onChangeKnowledgeBase={(knowledgeBaseId) =>
                void capabilityActions.changeKnowledgeBase(knowledgeBaseId)
              }
              onToggleSkill={(skillId) => void capabilityActions.toggleSkill(skillId)}
              onSelectWorkflow={(workflowId) => void capabilityActions.selectWorkflow(workflowId)}
              onToggleMcpServer={(connection) => void capabilityActions.toggleMcpServer(connection)}
              onChangeModel={(modelId) => void changeModel(modelId)}
              onSend={(event) => void sendMessage(event)}
              onStop={() => void stopGeneration()}
              onRegenerate={() => void regenerate()}
              onAddFiles={() => void artifactActions.select(displayedDetail.id)}
              onAddWorkspace={() => void workspaceActions.select(displayedDetail.id)}
              onRemoveWorkspace={(workspaceId) =>
                void workspaceActions.remove(displayedDetail.id, workspaceId)
              }
              onChangeWorkspaceMode={(mode) =>
                void workspaceActions.changeMode(displayedDetail.id, mode)
              }
              onResolveApproval={(decision) => {
                if (pendingApproval) void approvalActions.resolve(pendingApproval, decision);
              }}
              onAnswerQuestion={(answers) => {
                if (pendingQuestion) void questionActions.answer(pendingQuestion, answers);
              }}
              onRemoveArtifact={(artifactId) =>
                void artifactActions.remove(displayedDetail.id, artifactId)
              }
              onPreviewArtifact={(artifactId, revisionId) =>
                void artifactActions.previewArtifact(displayedDetail.id, artifactId, revisionId)
              }
            />
            <DocumentPreviewDialog
              preview={artifactActions.preview}
              conversationId={displayedDetail.id}
              onClose={artifactActions.closePreview}
            />
          </>
        ) : (
          <ConversationInitializing error={error} onRetry={onCreateConversation} />
        )}
      </section>
    </div>
  );
}
