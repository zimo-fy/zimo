import type { ConversationId, PrototypeId } from "./index";

export interface ConversationCapabilities {
  agentId?: PrototypeId | undefined;
  skillIds: readonly PrototypeId[];
  knowledgeBaseIds: readonly PrototypeId[];
  workflowId?: PrototypeId | undefined;
  mcpToolIds: readonly string[];
  browserEnabled: boolean;
}

export type ConversationCapabilityReferenceKind =
  "agent" | "skill" | "knowledge" | "workflow" | "mcp-server";

export interface ConversationCapabilityRepository {
  changeCapabilities(
    id: ConversationId,
    capabilities: ConversationCapabilities,
    updatedAt: Date,
  ): Promise<void>;
  hasCapabilityReference(kind: ConversationCapabilityReferenceKind, id: string): Promise<boolean>;
}
