import {
  ControlledToolService,
  createBuiltinReadOnlyTools,
  createDocumentTools,
  createMcpRegisteredTools,
  createWorkspaceTools,
  createWebAccessTools,
  createUserMemoryTool,
  createBrowserTools,
  BrowserRunLease,
  type DocumentArtifactService,
  type KnowledgeService,
  type McpRegistryService,
  type WorkspaceService,
  type SecurityAuditService,
  type WebAccessService,
  type UserMemoryService,
} from "@zimo/application";
import type { BrowserAutomationGateway, Clock } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";

export async function createDesktopToolService(options: {
  knowledge: KnowledgeService;
  documents: DocumentArtifactService;
  workspaces: WorkspaceService;
  mcp: McpRegistryService;
  logger: StructuredLogger | null;
  clock: Clock;
  securityAudit: SecurityAuditService;
  webAccess: WebAccessService;
  userMemories: UserMemoryService;
  browser: BrowserAutomationGateway;
}): Promise<ControlledToolService> {
  const browserLease = new BrowserRunLease();
  return new ControlledToolService(
    [
      ...createBuiltinReadOnlyTools(options.knowledge),
      ...createDocumentTools(options.documents),
      ...createWorkspaceTools(options.workspaces),
      ...createWebAccessTools(options.webAccess),
      createUserMemoryTool(options.userMemories),
      ...createBrowserTools(options.browser, browserLease),
      ...(await options.mcp.list()).flatMap((connection) =>
        createMcpRegisteredTools(connection, options.mcp),
      ),
    ],
    {
      begin: async (value) => {
        await options.securityAudit.recordToolStarted(value);
      },
      record: async (value) => {
        await options.securityAudit.recordToolCompleted(value);
        options.logger?.log({
          level: value.outcome === "failure" || value.outcome === "timed_out" ? "warn" : "info",
          category: "audit",
          event: "tool.execution.completed",
          message: "Controlled tool execution audited",
          context: {
            runId: value.runId,
            workflowId: value.workflowId,
            nodeId: value.nodeId,
            toolCallId: value.toolCallId,
            toolId: value.toolId,
            permissionIds: value.permissionIds,
            inputKeys: value.inputKeys,
            confirmed: value.confirmed,
            durationMs: value.durationMs,
            ...(value.errorCode ? { errorCode: value.errorCode } : {}),
            outcome:
              value.outcome === "timed_out" || value.outcome === "failure"
                ? "failure"
                : value.outcome,
          },
        });
      },
    },
    options.clock,
    {
      closeRun: async (runId) => {
        try {
          await options.mcp.closeRun(runId);
        } finally {
          browserLease.release(runId);
        }
      },
    },
  );
}
