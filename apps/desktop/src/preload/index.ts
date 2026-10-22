import {
  agentStreamEnvelopeSchema,
  appInfoViewSchema,
  appSettingsViewSchema,
  authSessionViewSchema,
  catalogModelViewSchema,
  cancelResultSchema,
  cancelRunRequestSchema,
  conversationDetailViewSchema,
  conversationIdRequestSchema,
  compactConversationRequestSchema,
  conversationSummaryViewSchema,
  createConversationRequestSchema,
  defaultModelViewSchema,
  deleteProviderRequestSchema,
  embeddingModelViewSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  ipcResultSchema,
  knowledgeBaseIdRequestSchema,
  knowledgeDeleteDocumentRequestSchema,
  knowledgeDocumentViewSchema,
  knowledgeDroppedImportRequestSchema,
  knowledgeImportResultViewSchema,
  remoteKnowledgeDirectoryCatalogViewSchema,
  knowledgeCloudDirectoryBindingViewSchema,
  knowledgeCloudSyncDirectoryRequestSchema,
  knowledgeCloudSyncResultViewSchema,
  knowledgeSearchHitViewSchema,
  knowledgeSearchRequestSchema,
  loginRequestSchema,
  modelProviderViewSchema,
  modelTestResultSchema,
  prototypeDetailViewSchema,
  prototypeGetRequestSchema,
  prototypeListRequestSchema,
  prototypeMutationRequestSchema,
  prototypeSummaryViewSchema,
  routeTargetListRequestSchema,
  routeTargetViewSchema,
  regenerateAcceptedSchema,
  regenerateMessageRequestSchema,
  renameConversationRequestSchema,
  setConversationPinnedRequestSchema,
  saveProviderRequestSchema,
  secretStoreStatusViewSchema,
  sendAcceptedSchema,
  sendMessageRequestSchema,
  setDefaultModelRequestSchema,
  successViewSchema,
  saveUserMemoryRequestSchema,
  deleteUserMemoryRequestSchema,
  userMemoryViewSchema,
  testProviderRequestSchema,
  toolCapabilityViewSchema,
  updateSettingsRequestSchema,
  changeConversationModelRequestSchema,
  selectCatalogModelRequestSchema,
  changeConversationKnowledgeRequestSchema,
  changeConversationAgentRequestSchema,
  changeConversationCapabilitiesRequestSchema,
  workflowCancelRequestSchema,
  workflowRunAcceptedSchema,
  workflowRunRequestSchema,
  workflowStreamEnvelopeSchema,
  type ZimoDesktopApi,
} from "@zimo/contracts";
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";

import { agentApi } from "./agent-api";
import { automationApi } from "./automation-api";
import { communicationChannelsApi } from "./communication-channel-api";
import { documentArtifactApi } from "./document-artifact-api";
import { mcpApi } from "./mcp-api";
import { skillApi } from "./skill-api";
import { updateApi } from "./update-api";
import { workspaceApi } from "./workspace-api";
import { approvalApi } from "./approval-api";
import { userQuestionApi } from "./user-question-api";
import { securityAuditApi } from "./security-audit-api";
import { webAccessApi } from "./web-access-api";

const api: ZimoDesktopApi = {
  webAccess: webAccessApi,
  userMemories: {
    list: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(userMemoryViewSchema.array().max(100)).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.userMemoriesList, request),
      );
    },
    save: async (requestId, input) => {
      const request = saveUserMemoryRequestSchema.parse({ requestId, payload: input });
      return ipcResultSchema(userMemoryViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.userMemoriesSave, request),
      );
    },
    delete: async (requestId, id) => {
      const request = deleteUserMemoryRequestSchema.parse({ requestId, payload: { id } });
      return ipcResultSchema(successViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.userMemoriesDelete, request),
      );
    },
  },
  automations: automationApi,
  updates: updateApi,
  artifacts: documentArtifactApi,
  workspaces: workspaceApi,
  approvals: approvalApi,
  userQuestions: userQuestionApi,
  securityAudit: securityAuditApi,
  agents: agentApi,
  app: {
    getInfo: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(appInfoViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.appGetInfo, request),
      );
    },
  },
  auth: {
    getSession: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(authSessionViewSchema.nullable()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.authGetSession, request),
      );
    },
    login: async (requestId, input) => {
      const request = loginRequestSchema.parse({ requestId, payload: input });
      return ipcResultSchema(authSessionViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.authLogin, request),
      );
    },
    startOnboarding: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(authSessionViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.authStartOnboarding, request),
      );
    },
    logout: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(successViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.authLogout, request),
      );
    },
  },
  settings: {
    get: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(appSettingsViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.settingsGet, request),
      );
    },
    update: async (requestId, input) => {
      const request = updateSettingsRequestSchema.parse({ requestId, payload: input });
      return ipcResultSchema(appSettingsViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, request),
      );
    },
  },
  security: {
    getSecretStoreStatus: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(secretStoreStatusViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.securityGetSecretStatus, request),
      );
    },
  },
  models: {
    list: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(modelProviderViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.modelsList, request),
      );
    },
    listCatalog: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(catalogModelViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.modelsListCatalog, request),
      );
    },
    saveProvider: async (requestId, input) => {
      const request = saveProviderRequestSchema.parse({ requestId, payload: input });
      return ipcResultSchema(modelProviderViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.modelsSaveProvider, request),
      );
    },
    deleteProvider: async (requestId, providerId) => {
      const request = deleteProviderRequestSchema.parse({ requestId, payload: { providerId } });
      return ipcResultSchema(successViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.modelsDeleteProvider, request),
      );
    },
    testProvider: async (requestId, input) => {
      const request = testProviderRequestSchema.parse({ requestId, payload: input });
      return ipcResultSchema(modelTestResultSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.modelsTestProvider, request),
      );
    },
    getDefault: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(defaultModelViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.modelsGetDefault, request),
      );
    },
    setDefault: async (requestId, modelId) => {
      const request = setDefaultModelRequestSchema.parse({ requestId, payload: { modelId } });
      return ipcResultSchema(defaultModelViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.modelsSetDefault, request),
      );
    },
  },
  conversations: {
    compact: async (requestId, conversationId) => {
      const request = compactConversationRequestSchema.parse({
        requestId,
        payload: { conversationId },
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationCompact, request),
      );
    },
    cancelCompaction: async (requestId, conversationId) => {
      const request = compactConversationRequestSchema.parse({
        requestId,
        payload: { conversationId },
      });
      return ipcResultSchema(cancelResultSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationCompactCancel, request),
      );
    },
    list: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(conversationSummaryViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsList, request),
      );
    },
    get: async (requestId, conversationId) => {
      const request = conversationIdRequestSchema.parse({
        requestId,
        payload: { conversationId },
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsGet, request),
      );
    },
    create: async (requestId, modelId) => {
      const request = createConversationRequestSchema.parse({
        requestId,
        payload: modelId ? { modelId } : {},
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsCreate, request),
      );
    },
    rename: async (requestId, conversationId, title) => {
      const request = renameConversationRequestSchema.parse({
        requestId,
        payload: { conversationId, title },
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsRename, request),
      );
    },
    setPinned: async (requestId, conversationId, pinned) => {
      const request = setConversationPinnedRequestSchema.parse({
        requestId,
        payload: { conversationId, pinned },
      });
      return ipcResultSchema(successViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsSetPinned, request),
      );
    },
    changeModel: async (requestId, conversationId, modelId) => {
      const request = changeConversationModelRequestSchema.parse({
        requestId,
        payload: { conversationId, modelId },
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsChangeModel, request),
      );
    },
    selectCatalogModel: async (requestId, conversationId, catalogId) => {
      const request = selectCatalogModelRequestSchema.parse({
        requestId,
        payload: { conversationId, catalogId },
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsSelectCatalogModel, request),
      );
    },
    changeAgent: async (requestId, conversationId, agentId) => {
      const request = changeConversationAgentRequestSchema.parse({
        requestId,
        payload: { conversationId, agentId },
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsChangeAgent, request),
      );
    },
    changeKnowledgeBases: async (requestId, conversationId, knowledgeBaseIds) => {
      const request = changeConversationKnowledgeRequestSchema.parse({
        requestId,
        payload: { conversationId, knowledgeBaseIds },
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsChangeKnowledge, request),
      );
    },
    changeCapabilities: async (requestId, input) => {
      const request = changeConversationCapabilitiesRequestSchema.parse({
        requestId,
        payload: input,
      });
      return ipcResultSchema(conversationDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsChangeCapabilities, request),
      );
    },
    delete: async (requestId, conversationId) => {
      const request = conversationIdRequestSchema.parse({
        requestId,
        payload: { conversationId },
      });
      return ipcResultSchema(successViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationsDelete, request),
      );
    },
    send: async (requestId, conversationId, content, artifactIds = []) => {
      const request = sendMessageRequestSchema.parse({
        requestId,
        payload: { conversationId, content, artifactIds },
      });
      return ipcResultSchema(sendAcceptedSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationSend, request),
      );
    },
    cancel: async (requestId, runId) => {
      const request = cancelRunRequestSchema.parse({ requestId, payload: { runId } });
      return ipcResultSchema(cancelResultSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationCancel, request),
      );
    },
    regenerate: async (requestId, conversationId, messageId) => {
      const request = regenerateMessageRequestSchema.parse({
        requestId,
        payload: { conversationId, messageId },
      });
      return ipcResultSchema(regenerateAcceptedSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.conversationRegenerate, request),
      );
    },
    onStream: (listener) => {
      const wrapped = (_event: IpcRendererEvent, raw: unknown) => {
        const parsed = agentStreamEnvelopeSchema.safeParse(raw);
        if (parsed.success) listener(parsed.data);
      };
      ipcRenderer.on(IPC_CHANNELS.agentStream, wrapped);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.agentStream, wrapped);
    },
  },
  prototypes: {
    list: async (requestId, input) => {
      const request = prototypeListRequestSchema.parse({ requestId, payload: input });
      return ipcResultSchema(prototypeSummaryViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.prototypeList, request),
      );
    },
    get: async (requestId, kind, id) => {
      const request = prototypeGetRequestSchema.parse({ requestId, payload: { kind, id } });
      return ipcResultSchema(prototypeDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.prototypeGet, request),
      );
    },
    mutate: async (requestId, input) => {
      const request = prototypeMutationRequestSchema.parse({ requestId, payload: input });
      return ipcResultSchema(prototypeDetailViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.prototypeMutate, request),
      );
    },
  },
  skills: skillApi,
  knowledge: {
    listDocuments: async (requestId, knowledgeBaseId) => {
      const request = knowledgeBaseIdRequestSchema.parse({
        requestId,
        payload: { knowledgeBaseId },
      });
      return ipcResultSchema(knowledgeDocumentViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeListDocuments, request),
      );
    },
    importSelectedFiles: async (requestId, knowledgeBaseId) => {
      const request = knowledgeBaseIdRequestSchema.parse({
        requestId,
        payload: { knowledgeBaseId },
      });
      return ipcResultSchema(knowledgeImportResultViewSchema.nullable()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeImportSelected, request),
      );
    },
    importDroppedFiles: async (requestId, knowledgeBaseId, files) => {
      const sourcePaths = files.map((file) =>
        webUtils.getPathForFile(file as Parameters<typeof webUtils.getPathForFile>[0]),
      );
      const request = knowledgeDroppedImportRequestSchema.parse({
        requestId,
        payload: { knowledgeBaseId, sourcePaths },
      });
      return ipcResultSchema(knowledgeImportResultViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeImportDropped, request),
      );
    },
    deleteDocument: async (requestId, knowledgeBaseId, documentId) => {
      const request = knowledgeDeleteDocumentRequestSchema.parse({
        requestId,
        payload: { knowledgeBaseId, documentId },
      });
      return ipcResultSchema(successViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeDeleteDocument, request),
      );
    },
    search: async (requestId, knowledgeBaseId, query, limit) => {
      const request = knowledgeSearchRequestSchema.parse({
        requestId,
        payload: { knowledgeBaseId, query, ...(limit ? { limit } : {}) },
      });
      return ipcResultSchema(knowledgeSearchHitViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeSearch, request),
      );
    },
    getEmbeddingModel: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(embeddingModelViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeGetEmbeddingModel, request),
      );
    },
    listRemoteDirectoryCatalog: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(remoteKnowledgeDirectoryCatalogViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeListRemoteDirectoryCatalog, request),
      );
    },
    listCloudSyncBindings: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(knowledgeCloudDirectoryBindingViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeListCloudSyncBindings, request),
      );
    },
    syncCloudDirectory: async (requestId, catalogDirectoryId, mode) => {
      const request = knowledgeCloudSyncDirectoryRequestSchema.parse({
        requestId,
        payload: { catalogDirectoryId, mode },
      });
      return ipcResultSchema(knowledgeCloudSyncResultViewSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.knowledgeSyncCloudDirectory, request),
      );
    },
  },
  router: {
    listTargets: async (requestId, type) => {
      const request = routeTargetListRequestSchema.parse({
        requestId,
        payload: type ? { type } : {},
      });
      return ipcResultSchema(routeTargetViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.routerListTargets, request),
      );
    },
  },
  workflows: {
    run: async (requestId, workflowId, input, confirmedToolIds = []) => {
      const request = workflowRunRequestSchema.parse({
        requestId,
        payload: { workflowId, input, confirmedToolIds },
      });
      return ipcResultSchema(workflowRunAcceptedSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.workflowRun, request),
      );
    },
    cancel: async (requestId, runId) => {
      const request = workflowCancelRequestSchema.parse({ requestId, payload: { runId } });
      return ipcResultSchema(cancelResultSchema).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.workflowCancel, request),
      );
    },
    onStream: (listener) => {
      const wrapped = (_event: IpcRendererEvent, raw: unknown) => {
        const parsed = workflowStreamEnvelopeSchema.safeParse(raw);
        if (parsed.success) listener(parsed.data);
      };
      ipcRenderer.on(IPC_CHANNELS.workflowStream, wrapped);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.workflowStream, wrapped);
    },
  },
  tools: {
    list: async (requestId) => {
      const request = emptyRequestSchema.parse({ requestId, payload: {} });
      return ipcResultSchema(toolCapabilityViewSchema.array()).parse(
        await ipcRenderer.invoke(IPC_CHANNELS.toolsList, request),
      );
    },
  },
  communicationChannels: communicationChannelsApi,
  mcp: mcpApi,
};

contextBridge.exposeInMainWorld("zimo", Object.freeze(api));
