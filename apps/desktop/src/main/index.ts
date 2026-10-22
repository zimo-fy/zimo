import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ConversationCapabilityService,
  ConversationService,
  ConversationWorkflowRunner,
  GeneratedSkillInstallationService,
  SkillRuntimeService,
  IntentRouterService,
  KnowledgeCloudSyncService,
  type McpRegistryService,
  ModelConfigurationService,
  PrototypeCatalogService,
  WorkflowRuntimeService,
  SecurityAuditService,
  UserMemoryService,
  UserQuestionService,
  WebAccessService,
} from "@zimo/application";
import {
  SQLiteAgentRunRepository,
  SQLiteConversationRepository,
  SQLiteDocumentArtifactRepository,
  SQLiteIntentRouteRepository,
  SQLiteKnowledgeCloudLinkRepository,
  SQLiteKnowledgeRepository,
  SQLiteModelRepository,
  SQLitePrototypeRepository,
  SQLiteWorkflowRepository,
  ZimoDatabase,
} from "@zimo/database-sqlite";
import { StructuredLogger } from "@zimo/logging";
import { SQLiteSecurityAuditEventRepository } from "@zimo/database-sqlite/security-audit-repository";
import { SQLiteContextCompactionRepository } from "@zimo/database-sqlite/context-compaction-repository";
import { SQLiteUserMemoryRepository } from "@zimo/database-sqlite/user-memory-repository";
import { SQLiteWebSearchConfigurationRepository } from "@zimo/database-sqlite/web-search-configuration-repository";
import { LangChainOpenAICompatibleGateway } from "@zimo/model-langchain";
import { createSeededPrototypeRepositories } from "@zimo/repositories-mock";
import { app, BrowserWindow, protocol } from "electron";

import { createAgentMarketplaceService } from "./agent-marketplace-composition";
import { resolveOptionalCloudDevApiBaseUrl } from "./auth-configuration";
import { resolveOnboardingLogin } from "./auth-onboarding";
import { createAppFoundationServices } from "./app-foundation-composition";
import { configureApplicationMenu } from "./application-menu";
import { createBackgroundServices } from "./background-services-composition";
import { createBrowserAutomation } from "./browser-automation-composition";
import { loadDesktopMigrations } from "./database-migrations";
import { removeRetiredMcpConnections } from "./mcp-catalog-retirement";
import { configureSessionSecurity, registerAppProtocol } from "./desktop-security";
import {
  documentImageProtocolPrivileges,
  registerDocumentImageProtocol,
} from "./document-image-protocol";
import { createDesktopUpdateService, type DesktopUpdateService } from "./desktop-update-service";
import { createDesktopWindow } from "./desktop-window";
import { createExternalIntegrationServices } from "./external-integration-services";
import { registerDesktopIpcHandlers } from "./ipc-registration";
import { createLocalContentServices } from "./local-content-composition";
import { ZimoKnowledgeDirectoryCatalogGateway } from "@zimo/knowledge-catalog-zimo";

import { createKnowledgeDirectoryCatalogService } from "./knowledge-catalog-composition";
import { createModelCatalogService } from "./model-catalog-composition";
import {
  createSensitiveModelPayloadLogger,
  type SensitiveModelPayloadLogger,
} from "./model-payload-logger";
import { canEditManagedModel } from "./model-configuration";
import { repairBuiltInInstructionSkills, seedRepositoriesOnce } from "./prototype-seeding";
import { createSkillMarketplaceServices } from "./skill-marketplace-composition";
import { createDesktopToolService } from "./tool-composition";
import { createWorkspaceApprovalServices } from "./workspace-approval-composition";
import { prepareAppDataLayout } from "./app-data-layout";
import { DesktopWebSearchGateway } from "./desktop-web-search-gateway";
import { DesktopModelNativeSearchGateway } from "./model-native-search-gateway";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false },
  },
  documentImageProtocolPrivileges(),
]);

let database: ZimoDatabase | null = null;
let logger: StructuredLogger | null = null;
let modelPayloadLogger: SensitiveModelPayloadLogger | null = null;
let conversationService: ConversationService | null = null;
let workflowRuntime: WorkflowRuntimeService | null = null;
let mcpService: McpRegistryService | null = null;
let agentMarketplaceService: ReturnType<typeof createAgentMarketplaceService> | null = null;
let skillMarketplaceService:
  ReturnType<typeof createSkillMarketplaceServices>["marketplace"] | null = null;
let updateService: DesktopUpdateService | null = null;
let backgroundServices: Awaited<ReturnType<typeof createBackgroundServices>> | null = null;
let browserAutomation: ReturnType<typeof createBrowserAutomation> | null = null;
let shutdownStarted = false;
const moduleDirectory = fileURLToPath(new URL(".", import.meta.url));

const clock = { now: (): Date => new Date() };
const ids = { create: (): string => randomUUID() };
const DEV_MANUAL_COMPACTION_RETAIN_MESSAGE_COUNT = 2;

async function createWindow(): Promise<void> {
  await createDesktopWindow({
    moduleDirectory,
    onClosed: () => {
      conversationService?.cancelAll();
      workflowRuntime?.cancelAll();
      mcpService?.cancelAll();
      agentMarketplaceService?.cancelAll();
      skillMarketplaceService?.cancelAll();
    },
  });
}

app.whenReady().then(async () => {
  configureSessionSecurity();
  if (!process.env.ELECTRON_RENDERER_URL) registerAppProtocol(moduleDirectory);

  const dataLayout = await prepareAppDataLayout(app.getPath("userData"));
  app.setAppLogsPath(dataLayout.system.logs);

  database = new ZimoDatabase(
    dataLayout.accounts.database,
    await loadDesktopMigrations(app.getAppPath()),
  );
  logger = new StructuredLogger(join(dataLayout.system.logs, "zimo.log"));
  updateService = createDesktopUpdateService({
    currentVersion: app.getVersion(),
    logger,
  });
  configureApplicationMenu({
    isDevelopment: !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL),
    onCheckForUpdates: () => void updateService?.check(true),
  });
  modelPayloadLogger = createSensitiveModelPayloadLogger(dataLayout.system.logs, process.env);
  if (modelPayloadLogger) {
    logger.log({
      level: "warn",
      category: "security",
      event: "model.payload_capture.enabled",
      message: "Sensitive development-only LLM payload capture is enabled",
    });
  }
  const { auth, authBaseUrl, secrets, sessions, settings } = createAppFoundationServices({
    database,
    userDataPath: dataLayout.system.root,
    clock,
    ids,
    packaged: app.isPackaged,
    authEndpointOverride: process.env.ZIMO_AUTH_BASE_URL,
    devModelApiKey: process.env.ZIMO_DEV_MODEL_API_KEY,
  });
  browserAutomation = createBrowserAutomation({
    profilesRoot: dataLayout.accounts.browserProfiles,
    workspaceRoot: dataLayout.workspaces,
    logger,
    resolveOwnerId: async () => (await sessions.get())?.externalUserId,
  });
  const modelRepository = new SQLiteModelRepository(database);
  const externalIntegrations = createExternalIntegrationServices({
    database,
    secrets,
    clock,
    ids,
    logger,
    sessions,
  });
  const { communicationChannels } = externalIntegrations;
  mcpService = externalIntegrations.mcp;
  await removeRetiredMcpConnections(mcpService, logger);
  const conversationRepository = new SQLiteConversationRepository(database);
  const contextCompactions = new SQLiteContextCompactionRepository(database);
  const userMemories = new UserMemoryService(
    new SQLiteUserMemoryRepository(database),
    sessions,
    clock,
    ids,
  );
  const securityAudit = new SecurityAuditService(
    new SQLiteSecurityAuditEventRepository(database),
    clock,
    ids,
  );
  const { workspaces, approvals } = await createWorkspaceApprovalServices({
    database,
    conversations: conversationRepository,
    clock,
    ids,
    logger,
    recoveryRoot: dataLayout.system.recovery,
    managedWorkspaceRoot: dataLayout.workspaces,
    deniedFileRoots: [
      dataLayout.system.root,
      dataLayout.accounts.root,
      ...(app.isPackaged ? [app.getAppPath(), process.resourcesPath] : []),
    ],
    securityAudit,
    sessions,
  });
  const userQuestions = new UserQuestionService(clock, ids);
  app.on("web-contents-created", (_event, contents) => {
    contents.once("destroyed", () => userQuestions.cancelOwner(String(contents.id)));
  });
  await conversationRepository.repairInterruptedMessages(clock.now());
  await contextCompactions.repairInterrupted(clock.now());
  const modelGateway = new LangChainOpenAICompatibleGateway((diagnostic) => {
    logger?.log({
      level: "error",
      category: "model",
      event: "model.provider.request.failed",
      message: "Model provider request failed; response content omitted by policy",
      context: { ...diagnostic, outcome: "failure" },
    });
  });
  const allowManagedEditing = canEditManagedModel({
    packaged: app.isPackaged,
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
  });
  const models = new ModelConfigurationService(modelRepository, secrets, modelGateway, clock, ids, {
    allowInsecureLocalhost:
      Boolean(process.env.ELECTRON_RENDERER_URL) ||
      process.env.ZIMO_ALLOW_INSECURE_LOCAL_PROVIDER === "1",
    allowManagedEditing,
    managedOnly: true,
  });
  const nativeSearchGateway = new DesktopModelNativeSearchGateway();
  const webAccess = new WebAccessService(
    new SQLiteWebSearchConfigurationRepository(database),
    sessions,
    secrets,
    new DesktopWebSearchGateway(),
    clock,
    ids,
    nativeSearchGateway,
    () => models.getDefaultConnection(),
  );
  await models.ensureManagedZimoCapabilities();
  const seededRepositories = createSeededPrototypeRepositories(clock.now());
  const agentRepository = new SQLitePrototypeRepository(database, "agent");
  const skillRepository = new SQLitePrototypeRepository(database, "skill");
  const knowledgeRepository = new SQLiteKnowledgeRepository(database);
  const workflowRepository = new SQLiteWorkflowRepository(database);
  await seedRepositoriesOnce(
    database,
    [
      [agentRepository, seededRepositories.agent],
      [skillRepository, seededRepositories.skill],
    ],
    "agent-skill-builtins-v1",
  );
  await repairBuiltInInstructionSkills(skillRepository, seededRepositories.skill);
  await seedRepositoriesOnce(
    database,
    [[knowledgeRepository, seededRepositories.knowledge]],
    "knowledge-builtins-v1",
  );
  await seedRepositoriesOnce(
    database,
    [[workflowRepository, seededRepositories.workflow]],
    "workflow-builtins-v1",
  );
  const prototypeRepositories = {
    ...seededRepositories,
    agent: agentRepository,
    skill: skillRepository,
    knowledge: knowledgeRepository,
    workflow: workflowRepository,
  };
  const prototypes = new PrototypeCatalogService(prototypeRepositories, clock, ids);
  agentMarketplaceService = createAgentMarketplaceService({
    agents: agentRepository,
    clock,
    ids,
    agentsDirectory: app.isPackaged
      ? join(process.resourcesPath, "agents")
      : join(app.getAppPath(), "resources", "agents"),
  });
  const { knowledge, documents } = await createLocalContentServices({
    knowledgeRepository,
    documentRepository: new SQLiteDocumentArtifactRepository(database),
    conversationRepository,
    knowledgeStorageRoot: dataLayout.accounts.knowledge,
    documentStorageRoot: dataLayout.workspaces,
    embeddingModelPath: app.isPackaged
      ? join(process.resourcesPath, "models", "bge-small-zh-v1.5")
      : join(app.getAppPath(), "resources", "models", "bge-small-zh-v1.5"),
    disableEmbeddings: process.env.ZIMO_DISABLE_LOCAL_EMBEDDINGS === "1",
    clock,
    ids,
  });
  registerDocumentImageProtocol(documents);
  const skillServices = createSkillMarketplaceServices({
    skills: skillRepository,
    prototypes,
    clock,
    ids,
    storageRoot: dataLayout.accounts.skills,
    skillsDirectory: join(app.getAppPath(), "resources", "skills"),
  });
  skillMarketplaceService = skillServices.marketplace;
  await skillMarketplaceService.normalizeInstalledSkills();
  const cloudDevApiBaseUrl = resolveOptionalCloudDevApiBaseUrl(authBaseUrl);
  const modelCatalog = createModelCatalogService({
    authBaseUrl: cloudDevApiBaseUrl,
    sessions,
    secrets,
  });
  const knowledgeDirectoryCatalog = createKnowledgeDirectoryCatalogService({
    authBaseUrl: cloudDevApiBaseUrl,
    sessions,
    secrets,
  });
  const knowledgeCloudSync = new KnowledgeCloudSyncService(
    new ZimoKnowledgeDirectoryCatalogGateway(cloudDevApiBaseUrl, sessions, secrets),
    knowledge,
    prototypes,
    new SQLiteKnowledgeCloudLinkRepository(database),
    clock,
    ids,
  );
  const router = new IntentRouterService(
    modelGateway,
    new SQLiteIntentRouteRepository(database),
    clock,
    ids,
    { fingerprint: (value) => createHash("sha256").update(value).digest("hex") },
    800,
    (outcome) =>
      logger?.log({
        level: "info",
        category: "intent-router",
        event: "intent-router.route.completed",
        message: "Intent route completed",
        context: {
          durationMs: outcome.durationMs,
          confidence: outcome.route.confidence,
          intent: outcome.route.intent,
          ...(outcome.route.targetId ? { targetId: outcome.route.targetId } : {}),
          didFallback: outcome.didFallback,
          ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
          outcome: outcome.didFallback ? "fallback" : "success",
        },
      }),
  );
  const tools = await createDesktopToolService({
    knowledge,
    documents,
    workspaces,
    mcp: externalIntegrations.mcp,
    logger,
    clock,
    securityAudit,
    webAccess,
    userMemories,
    browser: browserAutomation,
  });
  const skillRuntime = new SkillRuntimeService(
    skillServices.packageRuntime,
    skillServices.packageRuntime,
    tools,
    new GeneratedSkillInstallationService(
      skillServices.generatedPackageReader,
      skillServices.installation,
    ),
  );
  workflowRuntime = new WorkflowRuntimeService(
    workflowRepository,
    modelRepository,
    secrets,
    modelGateway,
    prototypes,
    knowledge,
    tools,
    skillRuntime,
    clock,
    ids,
  );
  const conversationCapabilities = new ConversationCapabilityService(
    conversationRepository,
    prototypes,
    tools,
  );
  conversationService = new ConversationService(
    conversationRepository,
    modelRepository,
    secrets,
    modelGateway,
    clock,
    ids,
    router,
    prototypes,
    new SQLiteAgentRunRepository(database),
    knowledge,
    tools,
    skillRuntime,
    conversationCapabilities,
    new ConversationWorkflowRunner(workflowRuntime),
    documents,
    workspaces,
    approvals,
    contextCompactions,
    userMemories,
    undefined,
    allowManagedEditing ? DEV_MANUAL_COMPACTION_RETAIN_MESSAGE_COUNT : undefined,
    userQuestions,
    skillServices.marketplace,
    agentMarketplaceService,
    modelCatalog,
  );
  backgroundServices = await createBackgroundServices({
    database,
    communicationChannels: externalIntegrations.communicationChannelRepository,
    sessions,
    secrets,
    conversations: conversationService,
    clock,
    ids,
    logger,
  });
  registerDesktopIpcHandlers({
    services: {
      auth,
      settings,
      secrets,
      models,
      modelCatalog,
      conversations: conversationService,
      documents,
      workspaces,
      approvals,
      userQuestions,
      securityAudit,
      userMemories,
      prototypes,
      knowledge,
      knowledgeDirectoryCatalog,
      knowledgeCloudSync,
      agentMarketplace: agentMarketplaceService,
      skillInstallation: skillServices.installation,
      skillMarketplace: skillServices.marketplace,
      skillPackageReader: skillServices.packageReader,
      workflows: workflowRuntime,
      tools,
      communicationChannels,
      weixinAssistant: backgroundServices.weixinAssistant,
      mcp: mcpService,
      automations: backgroundServices.automations,
      webAccess,
    },
    logger,
    modelPayloadLogger,
    updates: updateService,
    resolveOnboardingLogin: () =>
      resolveOnboardingLogin({
        authBaseUrl,
        packaged: app.isPackaged,
        rendererUrl: process.env.ELECTRON_RENDERER_URL,
      }),
  });
  await backgroundServices.start();
  logger.log({
    level: "info",
    category: "app",
    event: "app.started",
    message: "Zimo started",
  });
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (shutdownStarted) return;
  event.preventDefault();
  shutdownStarted = true;
  conversationService?.cancelAll();
  workflowRuntime?.cancelAll();
  mcpService?.cancelAll();
  agentMarketplaceService?.cancelAll();
  skillMarketplaceService?.cancelAll();
  updateService?.dispose();
  void (async () => {
    await backgroundServices?.stop();
    await browserAutomation?.close();
    database?.close();
    await Promise.all([logger?.flush(), modelPayloadLogger?.flush()]);
    app.quit();
  })();
});
