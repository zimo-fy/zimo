import type {
  AgentStreamEnvelope,
  Conversation,
  Message,
  MessageId,
  ModelGatewayMessage,
  ModelGatewayToolCall,
  ModelGatewayToolDefinition,
  ModelGatewayToolMessage,
  PrototypeDefinition,
  ResolvedModel,
  RunId,
} from "@zimo/domain";
import { AppError, modelGatewayContentCharacters } from "@zimo/domain";

import type {
  WorkflowModelPayload,
  WorkflowModelRequestDiagnostic,
} from "./workflow-model-request";

export interface ModelRequestMessageDiagnostic {
  index: number;
  role: ModelGatewayMessage["role"];
  characters: number;
}

export interface ModelRequestSkillDiagnostic {
  skillId: string;
  packageId: string | null;
  version: string;
  instructionCharacters: number;
}

export interface ConversationModelRequestDiagnostic {
  purpose?: "conversation_response" | "task_title";
  conversationId: string;
  runId: string;
  providerId: string;
  modelId: string;
  agentId: string | null;
  skills: readonly ModelRequestSkillDiagnostic[];
  knowledgeBaseIds: readonly string[];
  knowledgeContextCharacters: number;
  documentContextCharacters: number;
  messages: readonly ModelRequestMessageDiagnostic[];
  totalCharacters: number;
  requestContentLogged: false;
}

interface ConversationModelPayloadContext {
  schemaVersion: 1;
  conversationId: string;
  runId: string;
  providerId: string;
  modelId: string;
  agentId: string | null;
  skillIds: readonly string[];
  knowledgeBaseIds: readonly string[];
}

export interface ConversationModelRequestPayload extends ConversationModelPayloadContext {
  purpose?: "conversation_response" | "task_title";
  request: {
    model: string;
    temperature: 0.7;
    stream: true;
    messages: readonly ModelGatewayMessage[];
  };
}

export interface ConversationModelToolRoundPayload extends ConversationModelPayloadContext {
  purpose: "conversation_tool_round";
  round: number;
  request: {
    model: string;
    temperature: 0.7;
    stream: true;
    messages: readonly ModelGatewayToolMessage[];
    tools: readonly ModelGatewayToolDefinition[];
  };
  response: {
    toolCalls: readonly ModelGatewayToolCall[];
  };
}

export type ConversationModelPayload =
  ConversationModelRequestPayload | ConversationModelToolRoundPayload;

export interface ConversationStreamSink {
  ownerId?: string;
  emit(envelope: AgentStreamEnvelope): void;
  inspectModelRequest?(diagnostic: ConversationModelRequestDiagnostic): void;
  captureModelPayload?(payload: ConversationModelPayload): void;
  inspectNestedWorkflowModelRequest?(diagnostic: WorkflowModelRequestDiagnostic): void;
  captureNestedWorkflowModelPayload?(payload: WorkflowModelPayload): void;
  inspectTitleGeneration?(diagnostic: ConversationTitleGenerationDiagnostic): void;
}

export interface ConversationTitleGenerationDiagnostic {
  conversationId: string;
  runId: string;
  modelId?: string;
  outcome: "success" | "failure" | "cancelled" | "timeout";
  durationMs: number;
  errorCode?: string;
  titleCharacters?: number;
}

export interface ActiveConversationRun {
  controller: AbortController;
  terminal: boolean;
}

export function markTerminal(run: ActiveConversationRun | undefined): void {
  if (run) run.terminal = true;
}

type AgentExecutionDiagnosticSource = Readonly<{
  agent: PrototypeDefinition;
}>;

export function isExecutableInstructionSkill(
  skill: PrototypeDefinition | null | undefined,
): skill is PrototypeDefinition & { skillInstructions: string } {
  return Boolean(
    skill?.status === "enabled" &&
    skill.installationStatus === "installed" &&
    skill.skillInstructions,
  );
}

export function summarizeConversationModelRequest(
  conversation: Conversation,
  runId: RunId,
  resolved: ResolvedModel,
  agentExecution: AgentExecutionDiagnosticSource | undefined,
  skills: readonly PrototypeDefinition[],
  knowledgeBaseIds: readonly string[],
  grounding: Readonly<{ context: string }> | undefined,
  documentContext: string | undefined,
  messages: readonly ModelGatewayMessage[],
): ConversationModelRequestDiagnostic {
  const messageDiagnostics = messages.map((message, index) => ({
    index,
    role: message.role,
    characters: modelGatewayContentCharacters(message.content),
  }));
  return {
    purpose: "conversation_response",
    conversationId: conversation.id,
    runId,
    providerId: resolved.provider.id,
    modelId: resolved.model.id,
    agentId: agentExecution?.agent.id ?? null,
    skills: skills.map((skill) => ({
      skillId: skill.id,
      packageId: skill.skillPackageId ?? null,
      version: skill.version,
      instructionCharacters: skill.skillInstructions?.length ?? 0,
    })),
    knowledgeBaseIds: [...knowledgeBaseIds],
    knowledgeContextCharacters: grounding?.context.length ?? 0,
    documentContextCharacters: documentContext?.length ?? 0,
    messages: messageDiagnostics,
    totalCharacters: messageDiagnostics.reduce((total, message) => total + message.characters, 0),
    requestContentLogged: false,
  };
}

export function inspectConversationModelRequest(
  sink: ConversationStreamSink,
  input: Readonly<{
    conversation: Conversation;
    runId: RunId;
    resolved: ResolvedModel;
    agentExecution?: AgentExecutionDiagnosticSource | undefined;
    skills: readonly PrototypeDefinition[];
    knowledgeBaseIds: readonly string[];
    grounding?: Readonly<{ context: string }> | undefined;
    documentContext?: string | undefined;
    messages: readonly ModelGatewayMessage[];
  }>,
): void {
  sink.inspectModelRequest?.(
    summarizeConversationModelRequest(
      input.conversation,
      input.runId,
      input.resolved,
      input.agentExecution,
      input.skills,
      input.knowledgeBaseIds,
      input.grounding,
      input.documentContext,
      input.messages,
    ),
  );
  sink.captureModelPayload?.({
    schemaVersion: 1,
    purpose: "conversation_response",
    conversationId: input.conversation.id,
    runId: input.runId,
    providerId: input.resolved.provider.id,
    modelId: input.resolved.model.id,
    agentId: input.agentExecution?.agent.id ?? null,
    skillIds: input.skills.map((skill) => skill.id),
    knowledgeBaseIds: [...input.knowledgeBaseIds],
    request: {
      model: input.resolved.model.name,
      temperature: 0.7,
      stream: true,
      messages: input.messages.map((message) => ({ ...message })),
    },
  });
}

export function inspectConversationTitleRequest(
  sink: ConversationStreamSink,
  input: Readonly<{
    conversation: Conversation;
    runId: RunId;
    resolved: ResolvedModel;
    messages: readonly ModelGatewayMessage[];
  }>,
): void {
  const messageDiagnostics = input.messages.map((message, index) => ({
    index,
    role: message.role,
    characters: modelGatewayContentCharacters(message.content),
  }));
  sink.inspectModelRequest?.({
    purpose: "task_title",
    conversationId: input.conversation.id,
    runId: input.runId,
    providerId: input.resolved.provider.id,
    modelId: input.resolved.model.id,
    agentId: null,
    skills: [],
    knowledgeBaseIds: [],
    knowledgeContextCharacters: 0,
    documentContextCharacters: 0,
    messages: messageDiagnostics,
    totalCharacters: messageDiagnostics.reduce((total, message) => total + message.characters, 0),
    requestContentLogged: false,
  });
  sink.captureModelPayload?.({
    schemaVersion: 1,
    purpose: "task_title",
    conversationId: input.conversation.id,
    runId: input.runId,
    providerId: input.resolved.provider.id,
    modelId: input.resolved.model.id,
    agentId: null,
    skillIds: [],
    knowledgeBaseIds: [],
    request: {
      model: input.resolved.model.name,
      temperature: 0.7,
      stream: true,
      messages: input.messages.map((message) => ({ ...message })),
    },
  });
}

export function makeConversationMessage(
  id: MessageId,
  conversation: Conversation,
  role: "user" | "assistant",
  content: string,
  now: Date,
  options: {
    offset?: number;
    replacesMessageId?: MessageId;
    modelDisplayName?: string;
  } = {},
): Message {
  const position =
    Math.max(-1, ...conversation.messages.map((item) => item.position)) + 1 + (options.offset ?? 0);
  return {
    id,
    conversationId: conversation.id,
    role,
    content,
    status: role === "user" ? "completed" : "pending",
    position,
    ...(options.replacesMessageId ? { replacesMessageId: options.replacesMessageId } : {}),
    ...(role === "assistant" && options.modelDisplayName
      ? { modelDisplayName: options.modelDisplayName }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function conversationNotFound(): AppError {
  return new AppError({
    code: "CONVERSATION_NOT_FOUND",
    category: "user",
    userMessage: "没有找到该会话。",
  });
}

export function runAlreadyActive(): AppError {
  return new AppError({
    code: "CONVERSATION_RUN_ACTIVE",
    category: "user",
    userMessage: "当前会话正在生成，请先停止。",
  });
}

export function abortError(): Error {
  const error = new Error("Generation aborted");
  error.name = "AbortError";
  return error;
}

export function toGenerationError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError({
    code: "MODEL_GENERATION_FAILED",
    category: "model",
    userMessage: "模型生成失败，请检查连接后重试。",
    retryable: true,
    cause: error,
  });
}
