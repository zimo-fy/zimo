import type {
  AgentMarketplaceService,
  AutomationService,
  AuthService,
  CommunicationChannelService,
  DocumentArtifactService,
  ControlledToolService,
  ConversationService,
  McpRegistryService,
  InstructionSkillInstallationService,
  SkillMarketplaceService,
  KnowledgeService,
  KnowledgeCloudSyncService,
  KnowledgeDirectoryCatalogService,
  ModelCatalogService,
  ModelConfigurationService,
  PrototypeCatalogService,
  SettingsService,
  WorkflowRuntimeService,
  WeixinAssistantService,
  WorkspaceService,
  ApprovalService,
  SecurityAuditService,
  UserMemoryService,
  UserQuestionService,
  WebAccessService,
} from "@zimo/application";
import type { LoginInput } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import type { EncryptedFileSecretStore } from "@zimo/secret-store";
import type { LocalInstructionSkillPackageReader } from "@zimo/skill-local";

import { registerAgentIpcHandlers } from "./agent-ipc";
import { registerAutomationIpcHandlers } from "./automation-ipc";
import { registerAppIpcHandlers } from "./app-ipc";
import { registerCommunicationChannelIpcHandlers } from "./communication-channel-ipc";
import { registerConversationIpcHandlers } from "./conversation-ipc";
import { registerDocumentArtifactIpcHandlers } from "./document-artifact-ipc";
import { createIpcHandlerRegistrar } from "./ipc-handler";
import { registerMcpIpcHandlers } from "./mcp-ipc";
import { registerModelIpcHandlers } from "./model-ipc";
import type { SensitiveModelPayloadLogger } from "./model-payload-logger";
import { registerPrototypeKnowledgeIpcHandlers } from "./prototype-knowledge-ipc";
import { registerSkillIpcHandlers } from "./skill-ipc";
import type { DesktopUpdateService } from "./desktop-update-service";
import { registerUpdateIpcHandlers } from "./update-ipc";
import { registerWorkflowIpcHandlers } from "./workflow-ipc";
import { registerWorkspaceIpcHandlers } from "./workspace-ipc";
import { registerApprovalIpcHandlers } from "./approval-ipc";
import { registerUserQuestionIpcHandlers } from "./user-question-ipc";
import { registerSecurityAuditIpcHandlers } from "./security-audit-ipc";
import { registerUserMemoryIpcHandlers } from "./user-memory-ipc";
import { registerWebAccessIpcHandlers } from "./web-access-ipc";

export interface DesktopIpcServices {
  auth: AuthService;
  settings: SettingsService;
  secrets: EncryptedFileSecretStore;
  models: ModelConfigurationService;
  modelCatalog: ModelCatalogService;
  conversations: ConversationService;
  documents: DocumentArtifactService;
  workspaces: WorkspaceService;
  approvals: ApprovalService;
  userQuestions: UserQuestionService;
  securityAudit: SecurityAuditService;
  userMemories: UserMemoryService;
  prototypes: PrototypeCatalogService;
  knowledge: KnowledgeService;
  knowledgeDirectoryCatalog: KnowledgeDirectoryCatalogService;
  knowledgeCloudSync: KnowledgeCloudSyncService;
  agentMarketplace: AgentMarketplaceService;
  skillInstallation: InstructionSkillInstallationService;
  skillMarketplace: SkillMarketplaceService;
  skillPackageReader: LocalInstructionSkillPackageReader;
  workflows: WorkflowRuntimeService;
  tools: ControlledToolService;
  communicationChannels: CommunicationChannelService;
  weixinAssistant: WeixinAssistantService;
  mcp: McpRegistryService;
  automations: AutomationService;
  webAccess: WebAccessService;
}

export function registerDesktopIpcHandlers(options: {
  services: DesktopIpcServices;
  logger: StructuredLogger | null;
  modelPayloadLogger: SensitiveModelPayloadLogger | null;
  updates: DesktopUpdateService;
  resolveOnboardingLogin: () => LoginInput;
}): void {
  const register = createIpcHandlerRegistrar(options.logger);
  registerAppIpcHandlers(
    register,
    { ...options.services, resolveOnboardingLogin: options.resolveOnboardingLogin },
    options.logger,
  );
  registerUpdateIpcHandlers(register, options.updates);
  if (!options.logger) throw new Error("Logger unavailable during IPC registration");
  registerAutomationIpcHandlers(register, {
    automations: options.services.automations,
    logger: options.logger,
  });
  registerModelIpcHandlers(register, {
    models: options.services.models,
    catalog: options.services.modelCatalog,
    webAccess: options.services.webAccess,
    logger: options.logger,
  });
  registerConversationIpcHandlers(register, {
    conversations: options.services.conversations,
    automations: options.services.automations,
    documents: options.services.documents,
    logger: options.logger,
    modelPayloadLogger: options.modelPayloadLogger,
  });
  registerDocumentArtifactIpcHandlers(register, {
    documents: options.services.documents,
    logger: options.logger,
  });
  registerWorkspaceIpcHandlers(register, {
    workspaces: options.services.workspaces,
    logger: options.logger,
  });
  registerApprovalIpcHandlers(register, options.services.approvals);
  registerUserQuestionIpcHandlers(register, options.services.userQuestions);
  registerSecurityAuditIpcHandlers(register, options.services.securityAudit);
  registerUserMemoryIpcHandlers(register, options.services.userMemories);
  registerWebAccessIpcHandlers(register, options.services.webAccess);
  registerPrototypeKnowledgeIpcHandlers(register, {
    prototypes: options.services.prototypes,
    knowledge: options.services.knowledge,
    knowledgeDirectoryCatalog: options.services.knowledgeDirectoryCatalog,
    knowledgeCloudSync: options.services.knowledgeCloudSync,
    logger: options.logger,
  });
  registerAgentIpcHandlers(register, {
    marketplace: options.services.agentMarketplace,
    logger: options.logger,
  });
  registerSkillIpcHandlers(register, {
    installation: options.services.skillInstallation,
    marketplace: options.services.skillMarketplace,
    packageReader: options.services.skillPackageReader,
    logger: options.logger,
  });
  registerWorkflowIpcHandlers(register, {
    workflows: options.services.workflows,
    tools: options.services.tools,
    logger: options.logger,
    payloadLogger: options.modelPayloadLogger,
  });
  registerCommunicationChannelIpcHandlers({
    register,
    service: options.services.communicationChannels,
    assistant: options.services.weixinAssistant,
    logger: options.logger,
  });
  registerMcpIpcHandlers({
    register,
    service: options.services.mcp,
    tools: options.services.tools,
    logger: options.logger,
  });
}
