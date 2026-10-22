import { readFile } from "node:fs/promises";
import { join } from "node:path";

import initial from "../../../../migrations/0001_initial.sql?raw";
import models from "../../../../migrations/0002_models_and_conversations.sql?raw";
import routes from "../../../../migrations/0003_intent_routes.sql?raw";
import prototypes from "../../../../migrations/0004_agent_skill_catalog.sql?raw";
import agentRuns from "../../../../migrations/0005_agent_runs.sql?raw";
import knowledge from "../../../../migrations/0006_knowledge_retrieval.sql?raw";
import grounding from "../../../../migrations/0007_conversation_knowledge_grounding.sql?raw";
import workflows from "../../../../migrations/0008_workflow_definitions.sql?raw";
import conversationAgent from "../../../../migrations/0009_conversation_agent_binding.sql?raw";
import communicationChannels from "../../../../migrations/0010_communication_channels.sql?raw";
import emailAddress from "../../../../migrations/0011_email_address_binding.sql?raw";
import githubMcp from "../../../../migrations/0012_github_mcp_connection.sql?raw";
import genericMcp from "../../../../migrations/0013_generic_mcp_registry.sql?raw";
import remoteAuth from "../../../../migrations/0014_remote_auth_session.sql?raw";
import mcpOauth from "../../../../migrations/0015_mcp_connection_sources_and_oauth.sql?raw";
import conversationCapabilities from "../../../../migrations/0016_conversation_capability_bindings.sql?raw";
import agentMarketplace from "../../../../migrations/0017_agent_marketplace.sql?raw";
import mcpHeaderToken from "../../../../migrations/0018_mcp_header_token_authentication.sql?raw";
import capabilityDeletionCascade from "../../../../migrations/0019_capability_deletion_cascade.sql?raw";
import mcpCatalogApiKeyAuthentication from "../../../../migrations/0020_mcp_catalog_api_key_authentication.sql?raw";
import weixinAssistantChannel from "../../../../migrations/0021_weixin_assistant_channel.sql?raw";
import documentArtifacts from "../../../../migrations/0022_document_artifacts.sql?raw";
import documentRevisionCreators from "../../../../migrations/0023_document_revision_creators.sql?raw";
import documentMessageRevisions from "../../../../migrations/0024_document_message_revisions.sql?raw";
import conversationWorkspaceGrants from "../../../../migrations/0025_conversation_workspace_grants.sql?raw";
import automationScheduler from "../../../../migrations/0026_automation_scheduler.sql?raw";
import automationDailyTimeWindow from "../../../../migrations/0027_automation_daily_time_window.sql?raw";
import actionApprovalRequests from "../../../../migrations/0028_action_approval_requests.sql?raw";
import securityAuditEvents from "../../../../migrations/0029_security_audit_events.sql?raw";
import workspaceGrantKind from "../../../../migrations/0030_workspace_grant_kind.sql?raw";
import workspaceDirectoryAuthorizations from "../../../../migrations/0031_workspace_directory_authorizations.sql?raw";
import conversationPinning from "../../../../migrations/0032_conversation_pinning.sql?raw";
import workspaceAutoApproveMode from "../../../../migrations/0033_workspace_auto_approve_mode.sql?raw";
import workspaceApprovalModePreferences from "../../../../migrations/0034_workspace_approval_mode_preferences.sql?raw";
import conversationContextCompactions from "../../../../migrations/0035_conversation_context_compactions.sql?raw";
import userMemories from "../../../../migrations/0036_user_memories.sql?raw";
import messageSteps from "../../../../migrations/0037_message_steps.sql?raw";
import conversationBrowserCapability from "../../../../migrations/0038_conversation_browser_capability.sql?raw";
import conversationCatalogModel from "../../../../migrations/0039_conversation_catalog_model.sql?raw";
import defaultBrowserCapability from "../../../../migrations/0040_default_browser_capability.sql?raw";
import knowledgeCloudLinks from "../../../../migrations/0039_knowledge_cloud_links.sql?raw";
import documentImportFormats from "../../../../migrations/0042_document_import_formats.sql?raw";
import messageGenerationModel from "../../../../migrations/0043_message_generation_model.sql?raw";
import conversationCatalogVision from "../../../../migrations/0044_conversation_catalog_vision.sql?raw";
import documentImageFormats from "../../../../migrations/0045_document_image_formats.sql?raw";

export async function loadDesktopMigrations(appPath: string) {
  const sources = [
    initial,
    models,
    routes,
    prototypes,
    agentRuns,
    knowledge,
    grounding,
    workflows,
    conversationAgent,
    communicationChannels,
    emailAddress,
    githubMcp,
    genericMcp,
    remoteAuth,
    mcpOauth,
    conversationCapabilities,
    agentMarketplace,
    mcpHeaderToken,
    capabilityDeletionCascade,
    mcpCatalogApiKeyAuthentication,
    weixinAssistantChannel,
    documentArtifacts,
    documentRevisionCreators,
    documentMessageRevisions,
    conversationWorkspaceGrants,
    automationScheduler,
    automationDailyTimeWindow,
    actionApprovalRequests,
    securityAuditEvents,
    workspaceGrantKind,
    workspaceDirectoryAuthorizations,
    conversationPinning,
    workspaceAutoApproveMode,
    workspaceApprovalModePreferences,
    conversationContextCompactions,
    userMemories,
    messageSteps,
    conversationBrowserCapability,
    conversationCatalogModel,
    defaultBrowserCapability,
    knowledgeCloudLinks,
    documentImportFormats,
    messageGenerationModel,
    conversationCatalogVision,
    documentImageFormats,
  ];
  const names = [
    "initial",
    "models-and-conversations",
    "intent-routes",
    "agent-skill-catalog",
    "agent-runs",
    "knowledge-retrieval",
    "conversation-knowledge-grounding",
    "workflow-definitions",
    "conversation-agent-binding",
    "communication-channels",
    "email-address-binding",
    "github-mcp-connection",
    "generic-mcp-registry",
    "remote-auth-session",
    "mcp-connection-sources-and-oauth",
    "conversation-capability-bindings",
    "agent-marketplace",
    "mcp-header-token-authentication",
    "capability-deletion-cascade",
    "mcp-catalog-api-key-authentication",
    "weixin-assistant-channel",
    "document-artifacts",
    "document-revision-creators",
    "document-message-revisions",
    "conversation-workspace-grants",
    "automation-scheduler",
    "automation-daily-time-window",
    "action-approval-requests",
    "security-audit-events",
    "workspace-grant-kind",
    "workspace-directory-authorizations",
    "conversation-pinning",
    "workspace-auto-approve-mode",
    "workspace-approval-mode-preferences",
    "conversation-context-compactions",
    "user-memories",
    "message-steps",
    "conversation-browser-capability",
    "conversation-catalog-model",
    "default-browser-capability",
    "knowledge-cloud-links",
    "document-import-formats",
    "message-generation-model",
    "conversation-catalog-vision",
    "document-image-formats",
  ];
  return Promise.all(
    names.map(async (name, index) => ({
      version: index + 1,
      name,
      sql:
        sources[index] ||
        (await readFile(
          join(
            appPath,
            "migrations",
            `${String(index + 1).padStart(4, "0")}_${fileName(name)}.sql`,
          ),
          "utf8",
        )),
    })),
  );
}

function fileName(name: string): string {
  const overrides: Record<string, string> = {
    "models-and-conversations": "models_and_conversations",
    "intent-routes": "intent_routes",
    "agent-skill-catalog": "agent_skill_catalog",
    "agent-runs": "agent_runs",
    "knowledge-retrieval": "knowledge_retrieval",
    "conversation-knowledge-grounding": "conversation_knowledge_grounding",
    "workflow-definitions": "workflow_definitions",
    "conversation-agent-binding": "conversation_agent_binding",
    "communication-channels": "communication_channels",
    "email-address-binding": "email_address_binding",
    "github-mcp-connection": "github_mcp_connection",
    "generic-mcp-registry": "generic_mcp_registry",
    "remote-auth-session": "remote_auth_session",
    "mcp-connection-sources-and-oauth": "mcp_connection_sources_and_oauth",
    "conversation-capability-bindings": "conversation_capability_bindings",
    "agent-marketplace": "agent_marketplace",
    "mcp-header-token-authentication": "mcp_header_token_authentication",
    "capability-deletion-cascade": "capability_deletion_cascade",
    "mcp-catalog-api-key-authentication": "mcp_catalog_api_key_authentication",
    "weixin-assistant-channel": "weixin_assistant_channel",
    "document-artifacts": "document_artifacts",
    "document-revision-creators": "document_revision_creators",
    "document-message-revisions": "document_message_revisions",
    "conversation-workspace-grants": "conversation_workspace_grants",
    "automation-scheduler": "automation_scheduler",
    "automation-daily-time-window": "automation_daily_time_window",
    "action-approval-requests": "action_approval_requests",
    "security-audit-events": "security_audit_events",
    "workspace-grant-kind": "workspace_grant_kind",
    "workspace-directory-authorizations": "workspace_directory_authorizations",
    "conversation-pinning": "conversation_pinning",
    "workspace-auto-approve-mode": "workspace_auto_approve_mode",
    "workspace-approval-mode-preferences": "workspace_approval_mode_preferences",
    "conversation-context-compactions": "conversation_context_compactions",
    "message-steps": "message_steps",
    "conversation-catalog-model": "conversation_catalog_model",
    "conversation-browser-capability": "conversation_browser_capability",
    "default-browser-capability": "default_browser_capability",
    "knowledge-cloud-links": "knowledge_cloud_links",
    "document-import-formats": "document_import_formats",
    "message-generation-model": "message_generation_model",
    "conversation-catalog-vision": "conversation_catalog_vision",
    "document-image-formats": "document_image_formats",
  };
  return overrides[name] ?? name;
}
