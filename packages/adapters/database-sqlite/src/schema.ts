import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey().notNull(),
  provider: text("auth_provider").notNull(),
  externalUserId: text("external_user_id").notNull(),
  account: text("account_id").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  tokenSecretRef: text("token_secret_ref").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const userMemories = sqliteTable(
  "user_memories",
  {
    id: text("id").primaryKey().notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("user_memories_owner_index").on(table.ownerUserId, table.updatedAt)],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey().notNull(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const securityAuditEvents = sqliteTable(
  "security_audit_events",
  {
    id: text("id").primaryKey().notNull(),
    eventType: text("event_type").notNull(),
    conversationId: text("conversation_id"),
    runId: text("run_id").notNull(),
    approvalId: text("approval_id"),
    toolCallId: text("tool_call_id"),
    toolId: text("tool_id"),
    actionKind: text("action_kind"),
    risk: text("risk"),
    decision: text("decision"),
    outcome: text("outcome").notNull(),
    ruleId: text("rule_id"),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    metadataJson: text("metadata_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("security_audit_events_created_index").on(table.createdAt, table.id),
    index("security_audit_events_filter_index").on(
      table.eventType,
      table.risk,
      table.outcome,
      table.createdAt,
    ),
  ],
);

export const modelProviders = sqliteTable(
  "model_providers",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    secretRef: text("secret_ref").notNull(),
    keyHint: text("key_hint").notNull(),
    kind: text("kind").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("model_providers_active_name_unique")
      .on(table.name)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const models = sqliteTable(
  "models",
  {
    id: text("id").primaryKey().notNull(),
    providerId: text("provider_id")
      .notNull()
      .references(() => modelProviders.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    kind: text("kind").notNull(),
    capabilitiesJson: text("capabilities_json").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("models_provider_id_index").on(table.providerId),
    uniqueIndex("models_provider_name_unique").on(table.providerId, table.name),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    agentId: text("agent_id").references(() => prototypeDefinitions.id, {
      onDelete: "restrict",
    }),
    skillIdsJson: text("skill_ids_json").notNull(),
    activeRunId: text("active_run_id"),
    knowledgeBaseIdsJson: text("knowledge_base_ids_json").notNull(),
    workflowId: text("workflow_id").references(() => workflowDefinitions.id, {
      onDelete: "restrict",
    }),
    mcpToolIdsJson: text("mcp_tool_ids_json").notNull(),
    browserEnabled: integer("browser_enabled", { mode: "boolean" }).notNull().default(false),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    catalogModelId: text("catalog_model_id"),
    catalogModelCode: text("catalog_model_code"),
    catalogModelDisplayName: text("catalog_model_display_name"),
    catalogModelReasoning: integer("catalog_model_reasoning", { mode: "boolean" }),
    catalogModelVision: integer("catalog_model_vision", { mode: "boolean" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("conversations_model_id_index").on(table.modelId),
    index("conversations_agent_id_index").on(table.agentId),
    index("conversations_workflow_id_index").on(table.workflowId),
    index("conversations_pinned_updated_index")
      .on(table.isPinned, table.updatedAt)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull(),
    position: integer("position").notNull(),
    replacesMessageId: text("replaces_message_id"),
    errorCode: text("error_code"),
    usageJson: text("usage_json"),
    knowledgeCitationsJson: text("knowledge_citations_json").notNull(),
    stepsJson: text("steps_json"),
    modelDisplayName: text("model_display_name"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("messages_conversation_position_unique").on(table.conversationId, table.position),
    index("messages_conversation_position_index").on(table.conversationId, table.position),
  ],
);

export const conversationContextCompactions = sqliteTable(
  "conversation_context_compactions",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    trigger: text("trigger").notNull(),
    sourceFromMessageId: text("source_from_message_id").notNull(),
    sourceToMessageId: text("source_to_message_id").notNull(),
    coveredThroughPosition: integer("covered_through_position").notNull(),
    retainedFromPosition: integer("retained_from_position").notNull(),
    summary: text("summary"),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens"),
    errorCode: text("error_code"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("conversation_context_compactions_conversation_version_unique").on(
      table.conversationId,
      table.version,
    ),
    index("conversation_context_compactions_status_index").on(table.status, table.updatedAt),
  ],
);

export const conversationWorkspaceGrants = sqliteTable(
  "conversation_workspace_grants",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    rootRef: text("root_ref").notNull(),
    displayName: text("display_name").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("conversation_workspace_grants_conversation_index").on(
      table.conversationId,
      table.createdAt,
    ),
    uniqueIndex("conversation_workspace_grants_root_unique").on(
      table.conversationId,
      table.rootRef,
    ),
  ],
);

export const workspaceDirectoryAuthorizations = sqliteTable(
  "workspace_directory_authorizations",
  {
    id: text("id").primaryKey().notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    rootRef: text("root_ref").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("workspace_directory_authorizations_owner_index").on(table.ownerUserId, table.createdAt),
    uniqueIndex("workspace_directory_authorizations_owner_root_unique").on(
      table.ownerUserId,
      table.rootRef,
    ),
  ],
);

export const approvalRequests = sqliteTable(
  "approval_requests",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    toolCallId: text("tool_call_id").notNull(),
    actionKind: text("action_kind").notNull(),
    actionDigest: text("action_digest").notNull(),
    risk: text("risk").notNull(),
    policyVersion: text("policy_version").notNull(),
    status: text("status").notNull(),
    expiresAt: text("expires_at").notNull(),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("approval_requests_action_unique").on(
      table.runId,
      table.toolCallId,
      table.actionDigest,
    ),
    index("approval_requests_pending_index").on(table.status, table.expiresAt),
    index("approval_requests_conversation_index").on(table.conversationId, table.createdAt),
  ],
);

export const intentRouteRecords = sqliteTable(
  "intent_route_records",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    inputFingerprint: text("input_fingerprint").notNull(),
    inputLength: integer("input_length").notNull(),
    intent: text("intent").notNull(),
    targetId: text("target_id"),
    confidence: real("confidence").notNull(),
    durationMs: integer("duration_ms").notNull(),
    didFallback: integer("did_fallback", { mode: "boolean" }).notNull(),
    fallbackReason: text("fallback_reason"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("intent_route_records_run_id_unique").on(table.runId),
    index("intent_route_records_created_at_index").on(table.createdAt),
    index("intent_route_records_conversation_id_index").on(table.conversationId),
  ],
);

export const prototypeDefinitions = sqliteTable(
  "prototype_definitions",
  {
    id: text("id").primaryKey().notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull(),
    category: text("category").notNull(),
    tagsJson: text("tags_json").notNull(),
    icon: text("icon").notNull(),
    version: text("version").notNull(),
    source: text("source").notNull(),
    modelId: text("model_id"),
    systemPrompt: text("system_prompt"),
    skillIdsJson: text("skill_ids_json").notNull(),
    knowledgeBaseIdsJson: text("knowledge_base_ids_json").notNull(),
    skillPackageId: text("skill_package_id"),
    skillInstructions: text("skill_instructions"),
    skillChecksum: text("skill_checksum"),
    agentCatalogId: text("agent_catalog_id"),
    agentRemoteId: text("agent_remote_id"),
    permissionsJson: text("permissions_json").notNull(),
    capabilitiesJson: text("capabilities_json").notNull(),
    associationsJson: text("associations_json").notNull(),
    installationStatus: text("installation_status"),
    workflowNodesJson: text("workflow_nodes_json").notNull(),
    workflowEdgesJson: text("workflow_edges_json").notNull(),
    documentsJson: text("documents_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("prototype_definitions_kind_updated_at_index").on(table.kind, table.updatedAt),
    uniqueIndex("prototype_definitions_agent_catalog_id_unique")
      .on(table.agentCatalogId)
      .where(sql`${table.kind} = 'agent' AND ${table.agentCatalogId} IS NOT NULL`),
  ],
);

export const workflowDefinitions = sqliteTable(
  "workflow_definitions",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull(),
    category: text("category").notNull(),
    tagsJson: text("tags_json").notNull(),
    icon: text("icon").notNull(),
    version: text("version").notNull(),
    source: text("source").notNull(),
    workflowNodesJson: text("workflow_nodes_json").notNull(),
    workflowEdgesJson: text("workflow_edges_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("workflow_definitions_updated_at_index").on(table.updatedAt)],
);

export const agentRunRecords = sqliteTable(
  "agent_run_records",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id").notNull(),
    agentId: text("agent_id").notNull(),
    modelId: text("model_id").notNull(),
    skillIdsJson: text("skill_ids_json").notNull(),
    knowledgeBaseIdsJson: text("knowledge_base_ids_json").notNull(),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("agent_run_records_conversation_created_index").on(table.conversationId, table.createdAt),
    index("agent_run_records_agent_created_index").on(table.agentId, table.createdAt),
  ],
);

export const knowledgeBases = sqliteTable(
  "knowledge_bases",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull(),
    category: text("category").notNull(),
    tagsJson: text("tags_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("knowledge_bases_status_updated_at_index").on(table.status, table.updatedAt)],
);

export const knowledgeDocuments = sqliteTable(
  "knowledge_documents",
  {
    id: text("id").primaryKey().notNull(),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mediaType: text("media_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum").notNull(),
    storageKey: text("storage_key").notNull(),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    chunkCount: integer("chunk_count").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("knowledge_documents_base_updated_at_index").on(table.knowledgeBaseId, table.updatedAt),
    uniqueIndex("knowledge_documents_base_checksum_unique").on(
      table.knowledgeBaseId,
      table.checksum,
    ),
  ],
);

export const knowledgeCloudLinks = sqliteTable(
  "knowledge_cloud_links",
  {
    id: text("id").primaryKey().notNull(),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    catalogDirectoryId: text("catalog_directory_id").notNull(),
    catalogDocumentId: text("catalog_document_id").notNull(),
    localDocumentId: text("local_document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    remoteChecksum: text("remote_checksum").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("knowledge_cloud_links_base_document_unique").on(
      table.knowledgeBaseId,
      table.catalogDocumentId,
    ),
    index("knowledge_cloud_links_directory_index").on(table.catalogDirectoryId, table.updatedAt),
  ],
);

export const knowledgeChunks = sqliteTable(
  "knowledge_chunks",
  {
    id: text("id").primaryKey().notNull(),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    text: text("text").notNull(),
    metadataJson: text("metadata_json").notNull(),
    embeddingBlob: blob("embedding_blob", { mode: "buffer" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("knowledge_chunks_base_document_index").on(
      table.knowledgeBaseId,
      table.documentId,
      table.ordinal,
    ),
    uniqueIndex("knowledge_chunks_document_ordinal_unique").on(table.documentId, table.ordinal),
  ],
);
