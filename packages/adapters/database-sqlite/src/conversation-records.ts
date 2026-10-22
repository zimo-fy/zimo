import type {
  AssistantStep,
  CatalogModelSelection,
  ConversationId,
  KnowledgeCitation,
  Message,
  MessageId,
  MessageStatus,
  TokenUsage,
} from "@zimo/domain";

export interface ConversationRow {
  id: string;
  title: string;
  model_id: string;
  agent_id: string | null;
  skill_ids_json: string;
  active_run_id: string | null;
  knowledge_base_ids_json: string;
  workflow_id: string | null;
  mcp_tool_ids_json: string;
  catalog_model_id?: string | null;
  catalog_model_code?: string | null;
  catalog_model_display_name?: string | null;
  catalog_model_reasoning?: number | null;
  catalog_model_vision?: number | null;
  browser_enabled: number;
  created_at: string;
  updated_at: string;
}

export function readCatalogModel(row: ConversationRow): CatalogModelSelection | undefined {
  if (!row.catalog_model_id || !row.catalog_model_code || !row.catalog_model_display_name) {
    return undefined;
  }
  return {
    catalogId: row.catalog_model_id,
    modelCode: row.catalog_model_code,
    displayName: row.catalog_model_display_name,
    supportsReasoning: row.catalog_model_reasoning === 1,
    supportsImages: row.catalog_model_vision === 1,
  };
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  status: string;
  position: number;
  replaces_message_id: string | null;
  error_code: string | null;
  usage_json: string | null;
  knowledge_citations_json: string;
  steps_json: string | null;
  model_display_name: string | null;
  created_at: string;
  updated_at: string;
}

export function parseMessageUsage(usageJson: string | null): TokenUsage | undefined {
  if (!usageJson) return undefined;
  const parsedUsage = JSON.parse(usageJson) as TokenUsage & { schemaVersion: number };
  return {
    ...(parsedUsage.inputTokens !== undefined ? { inputTokens: parsedUsage.inputTokens } : {}),
    ...(parsedUsage.outputTokens !== undefined ? { outputTokens: parsedUsage.outputTokens } : {}),
    ...(parsedUsage.totalTokens !== undefined ? { totalTokens: parsedUsage.totalTokens } : {}),
    ...(parsedUsage.cachedInputTokens !== undefined
      ? { cachedInputTokens: parsedUsage.cachedInputTokens }
      : {}),
  };
}

export function parseMessageSteps(
  stepsJson: string | null | undefined,
): AssistantStep[] | undefined {
  if (!stepsJson) return undefined;
  const parsed = JSON.parse(stepsJson) as { schemaVersion?: number; steps?: unknown };
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    return undefined;
  }
  const steps = parsed.steps.flatMap((item) => {
    const step = parseStoredAssistantStep(item);
    return step ? [step] : [];
  });
  return steps.length > 0 ? steps.slice(0, 100) : undefined;
}

export function serializeMessageSteps(steps: readonly AssistantStep[]): string {
  return JSON.stringify({ schemaVersion: 1, steps });
}

export function mapConversationMessage(row: MessageRow): Message {
  const usage = parseMessageUsage(row.usage_json);
  const steps = parseMessageSteps(row.steps_json);
  return {
    id: row.id as MessageId,
    conversationId: row.conversation_id as ConversationId,
    role: row.role as Message["role"],
    content: row.content,
    status: row.status as MessageStatus,
    position: row.position,
    ...(row.replaces_message_id ? { replacesMessageId: row.replaces_message_id as MessageId } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(usage ? { usage } : {}),
    ...(row.knowledge_citations_json !== "[]"
      ? { knowledgeCitations: JSON.parse(row.knowledge_citations_json) as KnowledgeCitation[] }
      : {}),
    ...(steps ? { steps } : {}),
    ...(row.model_display_name ? { modelDisplayName: row.model_display_name } : {}),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function parseStoredAssistantStep(value: unknown): AssistantStep | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || row.id.length === 0 || row.id.length > 120) return undefined;
  if (typeof row.title !== "string" || row.title.length === 0 || row.title.length > 80) {
    return undefined;
  }
  if (!isStepKind(row.kind) || !isStepStatus(row.status)) return undefined;
  const relativeTarget = optionalStepText(row.relativeTarget);
  const resultTitle = optionalStepText(row.resultTitle);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    ...(resultTitle ? { resultTitle } : {}),
    ...(relativeTarget ? { relativeTarget } : {}),
  };
}

function optionalStepText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 80 ? value : undefined;
}

function isStepKind(value: unknown): value is AssistantStep["kind"] {
  return (
    value === "file_read" ||
    value === "file_write" ||
    value === "file_delete" ||
    value === "command" ||
    value === "network" ||
    value === "external_app" ||
    value === "tool"
  );
}

function isStepStatus(value: unknown): value is AssistantStep["status"] {
  return (
    value === "running" ||
    value === "completed" ||
    value === "denied" ||
    value === "failed" ||
    value === "cancelled"
  );
}
