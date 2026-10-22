import type { AssistantStep } from "./assistant-steps";
import type { CatalogModelSelection } from "./model-catalog";
import type {
  ConversationCapabilities,
  ConversationCapabilityRepository,
} from "./conversation-capabilities";
import type { ContextCompaction } from "./context-compaction";

export * from "./conversation-capabilities";
export * from "./model-catalog";
export * from "./knowledge-catalog";
export * from "./agents";
export * from "./errors";
export * from "./tools";
export * from "./communication-channels";
export * from "./mcp";
export * from "./skills";
export * from "./documents";
export * from "./workspaces";
export * from "./automation";
export * from "./approvals";
export * from "./user-questions";
export * from "./security-audit";
export * from "./context-compaction";
export * from "./user-memory";
export * from "./web-access";
export * from "./assistant-steps";
export * from "./browser-automation";
export { mergeTokenUsage } from "./token-usage";

export type EntityId<T extends string> = string & { readonly __entity: T };
export type ModelProviderId = EntityId<"ModelProvider">;
export type ModelId = EntityId<"Model">;
export type ConversationId = EntityId<"Conversation">;
export type MessageId = EntityId<"Message">;
export type RunId = EntityId<"Run">;
export type PrototypeId = EntityId<"Prototype">;
export type KnowledgeDocumentId = EntityId<"KnowledgeDocument">;
export type KnowledgeChunkId = EntityId<"KnowledgeChunk">;

export type PrototypeKind =
  "agent" | "skill" | "knowledge" | "workflow" | "plugin" | "mcp" | "automation";
export type PrototypeStatus = "draft" | "enabled" | "disabled";
export type InstallationStatus = "not_installed" | "installed" | "update_available";

export interface WorkflowNodeDefinition {
  id: string;
  type: "start" | "agent" | "skill" | "knowledge" | "tool" | "condition" | "approval" | "end";
  label: string;
  position: Readonly<{ x: number; y: number }>;
  config?:
    | Readonly<{
        agentId?: string | undefined;
        skillId?: string | undefined;
        knowledgeBaseId?: string | undefined;
        toolId?: string | undefined;
        instruction?: string | undefined;
        expression?: string | undefined;
        inputKey?: string | undefined;
        outputKey?: string | undefined;
        topK?: number | undefined;
      }>
    | undefined;
}

export interface WorkflowEdgeDefinition {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | undefined;
  targetHandle?: string | undefined;
}

export interface PrototypeDocument {
  id: string;
  name: string;
  sizeLabel: string;
  status: "queued" | "processing" | "ready" | "failed";
}

export interface PrototypeDefinition {
  id: PrototypeId;
  kind: PrototypeKind;
  name: string;
  description: string;
  status: PrototypeStatus;
  category: string;
  tags: readonly string[];
  icon: string;
  version: string;
  source: string;
  modelId?: string;
  systemPrompt?: string;
  skillIds?: readonly PrototypeId[];
  knowledgeBaseIds?: readonly PrototypeId[];
  mcpServerIds?: readonly string[];
  skillPackageId?: string;
  skillInstructions?: string;
  skillChecksum?: string;
  agentCatalogId?: string;
  agentRemoteId?: string;
  permissions: readonly string[];
  capabilities: readonly string[];
  associations: readonly string[];
  installationStatus?: InstallationStatus;
  secretHint?: string;
  triggerType?: "manual" | "schedule" | "webhook" | "message" | "file_change";
  workflowNodes: readonly WorkflowNodeDefinition[];
  workflowEdges: readonly WorkflowEdgeDefinition[];
  documents: readonly PrototypeDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PrototypeRepository {
  list(): Promise<readonly PrototypeDefinition[]>;
  getById(id: PrototypeId): Promise<PrototypeDefinition | null>;
  save(value: PrototypeDefinition): Promise<void>;
  delete(id: PrototypeId): Promise<void>;
}

// Dedicated ports keep module policy out of the shared IPC transport.
export interface AgentRepository extends PrototypeRepository {
  readonly kind: "agent";
}
export interface SkillRepository extends PrototypeRepository {
  readonly kind: "skill";
}
export interface KnowledgeBaseRepository extends PrototypeRepository {
  readonly kind: "knowledge";
}

export type KnowledgeDocumentStatus = "queued" | "processing" | "ready" | "failed";

export interface KnowledgeDocument {
  id: KnowledgeDocumentId;
  knowledgeBaseId: PrototypeId;
  name: string;
  mediaType: string;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
  status: KnowledgeDocumentStatus;
  errorCode?: string | undefined;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChunkMetadata {
  pageNumber?: number | undefined;
  slideNumber?: number | undefined;
  sheetName?: string | undefined;
  heading?: string | undefined;
  startIndex?: number | undefined;
  endIndex?: number | undefined;
}

export interface KnowledgeChunk {
  id: KnowledgeChunkId;
  knowledgeBaseId: PrototypeId;
  documentId: KnowledgeDocumentId;
  ordinal: number;
  text: string;
  metadata: KnowledgeChunkMetadata;
  embedding?: readonly number[] | undefined;
  createdAt: Date;
}

export interface KnowledgeLexicalHit {
  chunk: KnowledgeChunk;
  score: number;
}

export interface KnowledgeRepository extends KnowledgeBaseRepository {
  listDocuments(knowledgeBaseId: PrototypeId): Promise<readonly KnowledgeDocument[]>;
  getDocument(id: KnowledgeDocumentId): Promise<KnowledgeDocument | null>;
  findDocumentByChecksum(
    knowledgeBaseId: PrototypeId,
    checksum: string,
  ): Promise<KnowledgeDocument | null>;
  saveDocument(document: KnowledgeDocument): Promise<void>;
  deleteDocument(id: KnowledgeDocumentId): Promise<void>;
  replaceChunks(documentId: KnowledgeDocumentId, chunks: readonly KnowledgeChunk[]): Promise<void>;
  listChunks(knowledgeBaseId: PrototypeId): Promise<readonly KnowledgeChunk[]>;
  searchLexical(
    knowledgeBaseId: PrototypeId,
    query: string,
    limit: number,
  ): Promise<readonly KnowledgeLexicalHit[]>;
}

export interface ExtractedKnowledgeSegment {
  text: string;
  metadata: KnowledgeChunkMetadata;
}

export interface ImportedKnowledgeFile {
  name: string;
  mediaType: string;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
  segments: readonly ExtractedKnowledgeSegment[];
}

export interface KnowledgeFileImporter {
  importFile(sourcePath: string, storageDirectory: string): Promise<ImportedKnowledgeFile>;
  removeManagedFile(storageDirectory: string, storageKey: string): Promise<void>;
}

export type EmbeddingModelStatus = "ready" | "failed";

export interface EmbeddingModelInfo {
  key: string;
  displayName: string;
  revision: string;
  dimensions: number;
  status: EmbeddingModelStatus;
  localOnly: boolean;
  errorCode?: string | undefined;
}

export interface EmbeddingProvider {
  getStatus(): Promise<EmbeddingModelInfo>;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}
export interface WorkflowRepository extends PrototypeRepository {
  readonly kind: "workflow";
}
export interface PluginRepository extends PrototypeRepository {
  readonly kind: "plugin";
}
export interface McpServerRepository extends PrototypeRepository {
  readonly kind: "mcp";
}
export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  create(): string;
}

export type AppLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface AppSettings {
  appearance: "light";
  logLevel: AppLogLevel;
  reduceMotion: boolean;
}

export interface AppSettingsStore {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

export interface SecretStoreStatus {
  available: boolean;
  backend: string;
  persistent: boolean;
  reason?: string;
}

export interface SecretStore {
  getStatus(): Promise<SecretStoreStatus>;
  set(ref: string, secret: string): Promise<void>;
  get(ref: string): Promise<string | null>;
  delete(ref: string): Promise<void>;
}

export * from "./auth";

export interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  vision: boolean;
  reasoning: boolean;
  promptCaching: boolean;
  maxContextTokens?: number | undefined;
}

export interface ModelProviderConfig {
  id: ModelProviderId;
  name: string;
  baseUrl: string;
  secretRef: string;
  keyHint: string;
  kind: "openai-compatible";
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelDefinition {
  id: ModelId;
  providerId: ModelProviderId;
  name: string;
  displayName: string;
  capabilities: ModelCapabilities;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelProviderWithModels {
  provider: ModelProviderConfig;
  models: readonly ModelDefinition[];
}

export interface ResolvedModel {
  provider: ModelProviderConfig;
  model: ModelDefinition;
}

export interface ModelRepository {
  listProviders(): Promise<readonly ModelProviderWithModels[]>;
  getProvider(id: ModelProviderId): Promise<ModelProviderWithModels | null>;
  getModel(id: ModelId): Promise<ResolvedModel | null>;
  saveProvider(value: ModelProviderWithModels): Promise<void>;
  deleteProvider(id: ModelProviderId, deletedAt: Date): Promise<void>;
  hasProviderReferences(id: ModelProviderId): Promise<boolean>;
  getDefaultModelId(): Promise<ModelId | null>;
  setDefaultModelId(id: ModelId): Promise<void>;
}

export type ModelGatewayTextPart = Readonly<{ type: "text"; text: string }>;
export type ModelGatewayImagePart = Readonly<{
  type: "image_url";
  image_url: Readonly<{ url: string }>;
}>;
export type ModelGatewayContentPart = ModelGatewayTextPart | ModelGatewayImagePart;

export type ModelGatewayMessageContent = string | readonly ModelGatewayContentPart[];

export interface ModelGatewayMessage {
  role: "user" | "assistant" | "system";
  content: ModelGatewayMessageContent;
}

export function modelGatewayContentCharacters(content: ModelGatewayMessageContent): number {
  if (typeof content === "string") return content.length;
  return content.reduce((total, part) => total + (part.type === "text" ? part.text.length : 0), 0);
}

export interface ModelGatewayToolDefinition {
  name: string;
  description: string;
  inputSchema: Readonly<Record<string, unknown>>;
}

export interface ModelGatewayToolCall {
  id: string;
  name: string;
  arguments: Readonly<Record<string, unknown>>;
}

export type ModelGatewayToolMessage =
  | ModelGatewayMessage
  | Readonly<{ role: "assistant"; content: string; toolCalls: readonly ModelGatewayToolCall[] }>
  | Readonly<{ role: "tool"; content: string; toolCallId: string; name: string }>;

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
}

export type ModelStreamEvent =
  { type: "text"; text: string } | { type: "usage"; usage: TokenUsage } | { type: "completed" };

export type ModelToolStreamEvent =
  ModelStreamEvent | { type: "tool_calls"; toolCalls: readonly ModelGatewayToolCall[] };

export interface ModelConnection {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

export interface ModelGateway {
  testConnection(connection: ModelConnection, signal?: AbortSignal): Promise<void>;
  stream(
    connection: ModelConnection,
    messages: readonly ModelGatewayMessage[],
    signal: AbortSignal,
  ): AsyncIterable<ModelStreamEvent>;
  streamWithTools?(
    connection: ModelConnection,
    messages: readonly ModelGatewayToolMessage[],
    tools: readonly ModelGatewayToolDefinition[],
    signal: AbortSignal,
  ): AsyncIterable<ModelToolStreamEvent>;
}

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "streaming" | "completed" | "cancelled" | "failed";

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  position: number;
  replacesMessageId?: MessageId;
  errorCode?: string;
  usage?: TokenUsage;
  knowledgeCitations?: readonly KnowledgeCitation[];
  steps?: readonly AssistantStep[];
  modelDisplayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation extends ConversationCapabilities {
  id: ConversationId;
  title: string;
  modelId: ModelId;
  catalogModel?: CatalogModelSelection;
  activeRunId?: RunId;
  messages: readonly Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationDetail extends Conversation {
  contextCompactions: readonly ContextCompaction[];
}

export interface ConversationSummary {
  id: ConversationId;
  title: string;
  modelId: ModelId;
  modelDisplayName: string;
  messageCount: number;
  lastMessagePreview?: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationRepository extends ConversationCapabilityRepository {
  create(conversation: Conversation): Promise<void>;
  getById(id: ConversationId): Promise<Conversation | null>;
  list(): Promise<readonly ConversationSummary[]>;
  createRunMessages(options: {
    conversationId: ConversationId;
    runId: RunId;
    userMessage?: Message;
    assistantMessage: Message;
    artifactIds?: readonly string[];
  }): Promise<void>;
  appendMessageText(id: MessageId, delta: string, updatedAt: Date): Promise<void>;
  updateMessageStatus(
    id: MessageId,
    from: readonly MessageStatus[],
    status: MessageStatus,
    options: { errorCode?: string; usage?: TokenUsage; updatedAt: Date },
  ): Promise<boolean>;
  mergeMessageUsage(id: MessageId, incoming: TokenUsage): Promise<TokenUsage | undefined>;
  clearActiveRun(id: ConversationId, runId: RunId, updatedAt: Date): Promise<void>;
  rename(id: ConversationId, title: string, updatedAt: Date): Promise<void>;
  setPinned(id: ConversationId, pinned: boolean): Promise<void>;
  changeModel(id: ConversationId, modelId: ModelId, updatedAt: Date): Promise<void>;
  setCatalogModel(
    id: ConversationId,
    selection: CatalogModelSelection,
    updatedAt: Date,
  ): Promise<void>;
  saveKnowledgeCitations(id: MessageId, citations: readonly KnowledgeCitation[]): Promise<void>;
  saveMessageSteps(id: MessageId, steps: readonly AssistantStep[]): Promise<void>;
  softDelete(id: ConversationId, deletedAt: Date): Promise<void>;
  repairInterruptedMessages(updatedAt: Date): Promise<void>;
}

export type RouteIntent = "chat" | "agent" | "skill" | "workflow" | "unknown";
export type RouteFallbackReason =
  | "timeout"
  | "classifier_error"
  | "invalid_schema"
  | "low_confidence"
  | "invalid_target"
  | "no_classifier";

export interface RouteTarget {
  id: string;
  type: "agent" | "skill" | "workflow";
  name: string;
  description: string;
  enabled: boolean;
  parameterSchema?: Readonly<Record<string, unknown>>;
}

export interface IntentRoute {
  intent: RouteIntent;
  targetId?: string;
  confidence: number;
  parameters: Readonly<Record<string, unknown>>;
  reason?: string;
  shouldExecute: false;
}

export interface IntentClassificationRequest {
  text: string;
  targets: readonly RouteTarget[];
}

export interface IntentClassificationResult {
  value: unknown;
  usage?: TokenUsage;
}

export interface IntentClassifier {
  classify(
    connection: ModelConnection,
    request: IntentClassificationRequest,
    signal: AbortSignal,
  ): Promise<IntentClassificationResult>;
}

export interface IntentRouteRecord {
  id: string;
  conversationId: ConversationId;
  runId: RunId;
  inputFingerprint: string;
  inputLength: number;
  intent: RouteIntent;
  targetId?: string;
  confidence: number;
  durationMs: number;
  didFallback: boolean;
  fallbackReason?: RouteFallbackReason;
  createdAt: Date;
}

export interface IntentRouteRepository {
  save(record: IntentRouteRecord): Promise<void>;
}

export type AgentRunStatus = "running" | "completed" | "cancelled" | "failed";

export interface AgentRunRecord {
  id: RunId;
  conversationId: ConversationId;
  agentId: PrototypeId;
  modelId: ModelId;
  skillIds: readonly PrototypeId[];
  knowledgeBaseIds: readonly PrototypeId[];
  status: AgentRunStatus;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeCitation {
  index: number;
  knowledgeBaseId: PrototypeId;
  knowledgeBaseName: string;
  documentId: KnowledgeDocumentId;
  documentName: string;
  chunkId: KnowledgeChunkId;
  score: number;
  metadata: KnowledgeChunkMetadata;
}

export interface AgentRunRepository {
  start(record: AgentRunRecord): Promise<void>;
  finish(
    id: RunId,
    status: Exclude<AgentRunStatus, "running">,
    updatedAt: Date,
    errorCode?: string,
  ): Promise<void>;
}

export interface Fingerprinter {
  fingerprint(value: string): string;
}

export * from "./agent-stream";
