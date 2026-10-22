import {
  modelGatewayContentCharacters,
  type ModelGatewayMessage,
  type ModelGatewayToolCall,
  type ModelGatewayToolDefinition,
  type ModelGatewayToolMessage,
  type PrototypeDefinition,
  type ResolvedModel,
} from "@zimo/domain";

import type {
  ModelRequestMessageDiagnostic,
  ModelRequestSkillDiagnostic,
} from "./conversation-run";

export interface WorkflowModelRequestDiagnostic {
  workflowId: string;
  runId: string;
  nodeId: string;
  providerId: string;
  modelId: string;
  agentId: string;
  skills: readonly ModelRequestSkillDiagnostic[];
  knowledgeBaseIds: readonly string[];
  knowledgeContextCharacters: number;
  messages: readonly ModelRequestMessageDiagnostic[];
  totalCharacters: number;
  requestContentLogged: false;
}

interface WorkflowModelPayloadContext {
  schemaVersion: 1;
  workflowId: string;
  runId: string;
  nodeId: string;
  providerId: string;
  modelId: string;
  agentId: string;
  skillIds: readonly string[];
  knowledgeBaseIds: readonly string[];
}

export interface WorkflowModelRequestPayload extends WorkflowModelPayloadContext {
  request: {
    model: string;
    temperature: 0.7;
    stream: true;
    messages: readonly ModelGatewayMessage[];
  };
}

export interface WorkflowModelToolRoundPayload extends WorkflowModelPayloadContext {
  purpose: "workflow_tool_round";
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

export type WorkflowModelPayload = WorkflowModelRequestPayload | WorkflowModelToolRoundPayload;

export interface WorkflowModelRequestObserver {
  inspectModelRequest?(diagnostic: WorkflowModelRequestDiagnostic): void;
  captureModelPayload?(payload: WorkflowModelPayload): void;
}

export function inspectWorkflowModelRequest(
  observer: WorkflowModelRequestObserver,
  input: Readonly<{
    workflowId: string;
    runId: string;
    nodeId: string;
    resolved: ResolvedModel;
    agent: PrototypeDefinition;
    skills: readonly PrototypeDefinition[];
    knowledgeBaseIds: readonly string[];
    knowledgeContextCharacters: number;
    messages: readonly ModelGatewayMessage[];
  }>,
): void {
  const messages = input.messages.map((message, index) => ({
    index,
    role: message.role,
    characters: modelGatewayContentCharacters(message.content),
  }));
  observer.inspectModelRequest?.({
    workflowId: input.workflowId,
    runId: input.runId,
    nodeId: input.nodeId,
    providerId: input.resolved.provider.id,
    modelId: input.resolved.model.id,
    agentId: input.agent.id,
    skills: input.skills.map((skill) => ({
      skillId: skill.id,
      packageId: skill.skillPackageId ?? null,
      version: skill.version,
      instructionCharacters: skill.skillInstructions?.length ?? 0,
    })),
    knowledgeBaseIds: [...input.knowledgeBaseIds],
    knowledgeContextCharacters: input.knowledgeContextCharacters,
    messages,
    totalCharacters: messages.reduce((total, message) => total + message.characters, 0),
    requestContentLogged: false,
  });
  observer.captureModelPayload?.({
    schemaVersion: 1,
    workflowId: input.workflowId,
    runId: input.runId,
    nodeId: input.nodeId,
    providerId: input.resolved.provider.id,
    modelId: input.resolved.model.id,
    agentId: input.agent.id,
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
