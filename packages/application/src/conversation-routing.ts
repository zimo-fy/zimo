import type { ConversationId, ResolvedModel, RunId } from "@zimo/domain";

import type { IntentRouterService, RoutingOutcome } from "./intent-router-service";
import type { PrototypeCatalogService } from "./prototype-catalog-service";

export function resolveConversationRouting(input: {
  conversationId: ConversationId;
  runId: RunId;
  text?: string;
  workflowId?: string;
  agentId?: string;
  model?: ResolvedModel;
  apiKey?: string;
  signal: AbortSignal;
  router: IntentRouterService;
  prototypeCatalog: PrototypeCatalogService;
}): Promise<RoutingOutcome> {
  if (input.workflowId) {
    return Promise.resolve(fixedRoute("workflow", input.workflowId, "会话已选择 Workflow。"));
  }
  if (input.agentId) {
    return Promise.resolve(fixedRoute("agent", input.agentId, "会话已选择 Agent。"));
  }
  // Ordinary chat no longer performs a separate LLM classification request. The main model
  // discovers installed capabilities on demand through search_capabilities instead.
  return Promise.resolve({
    route: {
      intent: "chat",
      confidence: 1,
      parameters: {},
      reason: "按需能力发现已启用。",
      shouldExecute: false,
    },
    durationMs: 0,
    didFallback: false,
  });
}

function fixedRoute(
  intent: "workflow" | "agent",
  targetId: string,
  reason: string,
): RoutingOutcome {
  return {
    route: {
      intent,
      targetId,
      confidence: 1,
      parameters: {},
      reason,
      shouldExecute: false,
    },
    durationMs: 0,
    didFallback: false,
  };
}
