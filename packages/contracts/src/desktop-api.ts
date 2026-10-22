import type { z } from "zod";

import type { AgentMarketplaceDesktopApi } from "./agent-marketplace";
import type { AppUpdatesDesktopApi } from "./app-updates";
import type { AutomationDesktopApi } from "./automation";
import type { AuthSessionView, LoginInputDto } from "./auth";
import type { ChangeConversationCapabilitiesInput } from "./conversation-capabilities";
import type {
  KnowledgeCloudDirectoryBindingView,
  KnowledgeCloudSyncResultView,
  RemoteKnowledgeDirectoryCatalogView,
} from "./knowledge-catalog";
import type { CommunicationChannelsDesktopApi } from "./communication-channels";
import type { DocumentArtifactsDesktopApi } from "./documents";
import type {
  AgentStreamEnvelopeView,
  AppInfoView,
  AppSettingsView,
  ConversationDetailView,
  ConversationSummaryView,
  DefaultModelView,
  EmbeddingModelView,
  IpcResult,
  KnowledgeDocumentView,
  KnowledgeImportResultView,
  KnowledgeSearchHitView,
  CatalogModelView,
  ModelProviderView,
  ModelTestResult,
  PrototypeDetailView,
  PrototypeKindDto,
  PrototypeMutation,
  PrototypeSummaryView,
  RouteTargetView,
  SaveProviderInput,
  SecretStoreStatusView,
  TestProviderInput,
  ToolCapabilityView,
  UpdateSettingsInput,
  WorkflowStreamEnvelopeView,
  prototypeListInputSchema,
  regenerateAcceptedSchema,
  sendAcceptedSchema,
  workflowRunAcceptedSchema,
} from "./index";
import type { GithubMcpDesktopApi } from "./mcp";
import type { SkillMarketplaceDesktopApi } from "./skill-marketplace";
import type { WorkspacesDesktopApi } from "./workspaces";
import type { ApprovalsDesktopApi } from "./approvals";
import type { UserQuestionsDesktopApi } from "./user-questions";
import type { SecurityAuditDesktopApi } from "./security-audit";
import type { SaveUserMemoryInput, UserMemoryView } from "./user-memory";
import type { WebAccessDesktopApi } from "./web-access";

export interface ZimoDesktopApi {
  webAccess: WebAccessDesktopApi;
  userMemories: {
    list(requestId: string): Promise<IpcResult<UserMemoryView[]>>;
    save(requestId: string, input: SaveUserMemoryInput): Promise<IpcResult<UserMemoryView>>;
    delete(requestId: string, id: string): Promise<IpcResult<{ success: true }>>;
  };
  automations: AutomationDesktopApi;
  updates: AppUpdatesDesktopApi;
  app: { getInfo(requestId: string): Promise<IpcResult<AppInfoView>> };
  auth: {
    getSession(requestId: string): Promise<IpcResult<AuthSessionView | null>>;
    login(requestId: string, input: LoginInputDto): Promise<IpcResult<AuthSessionView>>;
    logout(requestId: string): Promise<IpcResult<{ success: true }>>;
  };
  settings: {
    get(requestId: string): Promise<IpcResult<AppSettingsView>>;
    update(requestId: string, input: UpdateSettingsInput): Promise<IpcResult<AppSettingsView>>;
  };
  security: { getSecretStoreStatus(requestId: string): Promise<IpcResult<SecretStoreStatusView>> };
  models: {
    list(requestId: string): Promise<IpcResult<ModelProviderView[]>>;
    listCatalog(requestId: string): Promise<IpcResult<CatalogModelView[]>>;
    saveProvider(
      requestId: string,
      input: SaveProviderInput,
    ): Promise<IpcResult<ModelProviderView>>;
    deleteProvider(requestId: string, providerId: string): Promise<IpcResult<{ success: true }>>;
    testProvider(requestId: string, input: TestProviderInput): Promise<IpcResult<ModelTestResult>>;
    getDefault(requestId: string): Promise<IpcResult<DefaultModelView>>;
    setDefault(requestId: string, modelId: string): Promise<IpcResult<DefaultModelView>>;
  };
  conversations: {
    compact(requestId: string, conversationId: string): Promise<IpcResult<ConversationDetailView>>;
    cancelCompaction(
      requestId: string,
      conversationId: string,
    ): Promise<IpcResult<{ accepted: boolean }>>;
    list(requestId: string): Promise<IpcResult<ConversationSummaryView[]>>;
    get(requestId: string, conversationId: string): Promise<IpcResult<ConversationDetailView>>;
    create(requestId: string, modelId?: string): Promise<IpcResult<ConversationDetailView>>;
    rename(
      requestId: string,
      conversationId: string,
      title: string,
    ): Promise<IpcResult<ConversationDetailView>>;
    setPinned(
      requestId: string,
      conversationId: string,
      pinned: boolean,
    ): Promise<IpcResult<{ success: true }>>;
    changeModel(
      requestId: string,
      conversationId: string,
      modelId: string,
    ): Promise<IpcResult<ConversationDetailView>>;
    selectCatalogModel(
      requestId: string,
      conversationId: string,
      catalogId: string,
    ): Promise<IpcResult<ConversationDetailView>>;
    changeAgent(
      requestId: string,
      conversationId: string,
      agentId: string | null,
    ): Promise<IpcResult<ConversationDetailView>>;
    changeKnowledgeBases(
      requestId: string,
      conversationId: string,
      knowledgeBaseIds: readonly string[],
    ): Promise<IpcResult<ConversationDetailView>>;
    changeCapabilities(
      requestId: string,
      input: ChangeConversationCapabilitiesInput,
    ): Promise<IpcResult<ConversationDetailView>>;
    delete(requestId: string, conversationId: string): Promise<IpcResult<{ success: true }>>;
    send(
      requestId: string,
      conversationId: string,
      content: string,
      artifactIds?: readonly string[],
    ): Promise<IpcResult<z.infer<typeof sendAcceptedSchema>>>;
    cancel(requestId: string, runId: string): Promise<IpcResult<{ accepted: boolean }>>;
    regenerate(
      requestId: string,
      conversationId: string,
      messageId: string,
    ): Promise<IpcResult<z.infer<typeof regenerateAcceptedSchema>>>;
    onStream(listener: (envelope: AgentStreamEnvelopeView) => void): () => void;
  };
  artifacts: DocumentArtifactsDesktopApi;
  workspaces: WorkspacesDesktopApi;
  approvals: ApprovalsDesktopApi;
  userQuestions: UserQuestionsDesktopApi;
  securityAudit: SecurityAuditDesktopApi;
  prototypes: {
    list(
      requestId: string,
      input: z.infer<typeof prototypeListInputSchema>,
    ): Promise<IpcResult<PrototypeSummaryView[]>>;
    get(
      requestId: string,
      kind: PrototypeKindDto,
      id: string,
    ): Promise<IpcResult<PrototypeDetailView>>;
    mutate(requestId: string, input: PrototypeMutation): Promise<IpcResult<PrototypeDetailView>>;
  };
  agents: AgentMarketplaceDesktopApi;
  skills: SkillMarketplaceDesktopApi;
  knowledge: {
    listDocuments(
      requestId: string,
      knowledgeBaseId: string,
    ): Promise<IpcResult<KnowledgeDocumentView[]>>;
    importSelectedFiles(
      requestId: string,
      knowledgeBaseId: string,
    ): Promise<IpcResult<KnowledgeImportResultView | null>>;
    importDroppedFiles(
      requestId: string,
      knowledgeBaseId: string,
      files: readonly unknown[],
    ): Promise<IpcResult<KnowledgeImportResultView>>;
    deleteDocument(
      requestId: string,
      knowledgeBaseId: string,
      documentId: string,
    ): Promise<IpcResult<{ success: true }>>;
    search(
      requestId: string,
      knowledgeBaseId: string,
      query: string,
      limit?: number,
    ): Promise<IpcResult<KnowledgeSearchHitView[]>>;
    getEmbeddingModel(requestId: string): Promise<IpcResult<EmbeddingModelView>>;
    listRemoteDirectoryCatalog(
      requestId: string,
    ): Promise<IpcResult<RemoteKnowledgeDirectoryCatalogView>>;
    listCloudSyncBindings(
      requestId: string,
    ): Promise<IpcResult<KnowledgeCloudDirectoryBindingView[]>>;
    syncCloudDirectory(
      requestId: string,
      catalogDirectoryId: string,
      mode: "import" | "update",
    ): Promise<IpcResult<KnowledgeCloudSyncResultView>>;
  };
  router: {
    listTargets(
      requestId: string,
      type?: "agent" | "skill" | "workflow",
    ): Promise<IpcResult<RouteTargetView[]>>;
  };
  workflows: {
    run(
      requestId: string,
      workflowId: string,
      input: string,
      confirmedToolIds?: readonly string[],
    ): Promise<IpcResult<z.infer<typeof workflowRunAcceptedSchema>>>;
    cancel(requestId: string, runId: string): Promise<IpcResult<{ accepted: boolean }>>;
    onStream(listener: (envelope: WorkflowStreamEnvelopeView) => void): () => void;
  };
  tools: { list(requestId: string): Promise<IpcResult<ToolCapabilityView[]>> };
  communicationChannels: CommunicationChannelsDesktopApi;
  mcp: GithubMcpDesktopApi;
}
