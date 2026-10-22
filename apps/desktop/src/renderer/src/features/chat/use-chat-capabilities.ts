import type {
  ConversationDetailView,
  McpConnectionView,
  PrototypeDetailView,
} from "@zimo/contracts";
import { useState, type Dispatch, type SetStateAction } from "react";

import { toggleMcpServerTools } from "./mcp-server-selection";

type CapabilityPatch = Partial<{
  agentId: string | null;
  skillIds: readonly string[];
  knowledgeBaseIds: readonly string[];
  workflowId: string | null;
  mcpToolIds: readonly string[];
}>;

export function useChatCapabilities(input: {
  detail: ConversationDetailView | null;
  setDetail: Dispatch<SetStateAction<ConversationDetailView | null>>;
  setSelectedAgent: Dispatch<SetStateAction<PrototypeDetailView | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
}) {
  const { detail, setDetail, setSelectedAgent, setError } = input;
  const [savingCapabilities, setSavingCapabilities] = useState(false);

  async function save(patch: CapabilityPatch): Promise<ConversationDetailView | null> {
    if (!detail || savingCapabilities) return null;
    setError(null);
    setSavingCapabilities(true);
    try {
      const result = await window.zimo.conversations.changeCapabilities(crypto.randomUUID(), {
        conversationId: detail.id,
        agentId: patch.agentId === undefined ? (detail.agentId ?? null) : patch.agentId,
        skillIds: [...(patch.skillIds ?? detail.skillIds)],
        knowledgeBaseIds: [...(patch.knowledgeBaseIds ?? detail.knowledgeBaseIds)],
        workflowId: patch.workflowId === undefined ? (detail.workflowId ?? null) : patch.workflowId,
        mcpToolIds: [...(patch.mcpToolIds ?? detail.mcpToolIds)],
        browserEnabled: true,
      });
      if (!result.ok) {
        setError(result.error.message);
        return null;
      }
      setDetail(result.data);
      return result.data;
    } finally {
      setSavingCapabilities(false);
    }
  }

  async function selectAgent(agentId: string) {
    const updated = await save({ agentId: agentId || null });
    if (!updated) return;
    if (!agentId) {
      setSelectedAgent(null);
      return;
    }
    const result = await window.zimo.prototypes.get(crypto.randomUUID(), "agent", agentId);
    if (result.ok) setSelectedAgent(result.data);
    else setError(result.error.message);
  }

  return {
    savingCapabilities,
    selectAgent,
    changeKnowledgeBase: (knowledgeBaseId: string) =>
      save({ knowledgeBaseIds: knowledgeBaseId ? [knowledgeBaseId] : [] }),
    selectWorkflow: (workflowId: string) => save({ workflowId: workflowId || null }),
    toggleSkill: (skillId: string) =>
      save({
        skillIds: detail?.skillIds.includes(skillId)
          ? detail.skillIds.filter((id) => id !== skillId)
          : [...(detail?.skillIds ?? []), skillId],
      }),
    toggleMcpServer: (connection: McpConnectionView) =>
      save({
        mcpToolIds: toggleMcpServerTools(connection, detail?.mcpToolIds ?? []),
      }),
  };
}
