import { z } from "zod";

export const mcpToolIdSchema = z
  .string()
  .regex(/^mcp\.[a-z0-9][a-z0-9-]{0,63}\.[A-Za-z0-9._-]{1,128}$/);

export const MAX_CONVERSATION_MCP_TOOLS = 300;

export const conversationCapabilityViewShape = {
  agentId: z.uuid().optional(),
  skillIds: z.array(z.uuid()).max(20),
  knowledgeBaseIds: z.array(z.uuid()).max(5),
  workflowId: z.uuid().optional(),
  mcpToolIds: z.array(mcpToolIdSchema).max(MAX_CONVERSATION_MCP_TOOLS),
  browserEnabled: z.boolean(),
};

export const changeConversationCapabilitiesInputSchema = z
  .object({
    conversationId: z.uuid(),
    agentId: z.uuid().nullable(),
    skillIds: z.array(z.uuid()).max(20),
    knowledgeBaseIds: z.array(z.uuid()).max(5),
    workflowId: z.uuid().nullable(),
    mcpToolIds: z.array(mcpToolIdSchema).max(MAX_CONVERSATION_MCP_TOOLS),
    browserEnabled: z.boolean(),
  })
  .strict();
export type ChangeConversationCapabilitiesInput = z.infer<
  typeof changeConversationCapabilitiesInputSchema
>;

export const changeConversationAgentInputSchema = z
  .object({ conversationId: z.uuid(), agentId: z.uuid().nullable() })
  .strict();
export const changeConversationKnowledgeInputSchema = z
  .object({ conversationId: z.uuid(), knowledgeBaseIds: z.array(z.uuid()).max(5) })
  .strict();

const request = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const changeConversationCapabilitiesRequestSchema = request(
  changeConversationCapabilitiesInputSchema,
);
export const changeConversationAgentRequestSchema = request(changeConversationAgentInputSchema);
export const changeConversationKnowledgeRequestSchema = request(
  changeConversationKnowledgeInputSchema,
);
