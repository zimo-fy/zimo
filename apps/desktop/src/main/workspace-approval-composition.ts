import { createHash } from "node:crypto";

import {
  ActionPolicyService,
  ApprovalService,
  WorkspaceService,
  WorkspaceAuthorizationRegistry,
  type SecurityAuditService,
} from "@zimo/application";
import type { ConversationRepository, SessionStore } from "@zimo/domain";
import { SQLiteApprovalRequestRepository } from "@zimo/database-sqlite/approval-request-repository";
import type { ZimoDatabase } from "@zimo/database-sqlite";
import {
  SQLiteWorkspaceApprovalModePreferenceRepository,
  SQLiteWorkspaceDirectoryAuthorizationRepository,
  SQLiteWorkspaceGrantRepository,
} from "@zimo/database-sqlite/workspace-grant-repository";
import type { StructuredLogger } from "@zimo/logging";

import { LocalWorkspaceDirectoryReader } from "./workspace-directory-reader";
import { LocalWorkspaceFileWriter } from "./workspace-file-writer";
import { LocalConversationWorkspaceRootProvider } from "./conversation-workspace-roots";
import { HostWorkspaceCommandExecutor } from "./workspace-command-executor";

export async function createWorkspaceApprovalServices(input: {
  database: ZimoDatabase;
  conversations: ConversationRepository;
  clock: { now(): Date };
  ids: { create(): string };
  logger: StructuredLogger;
  recoveryRoot: string;
  managedWorkspaceRoot: string;
  deniedFileRoots: readonly string[];
  securityAudit: SecurityAuditService;
  sessions: SessionStore;
}): Promise<{ workspaces: WorkspaceService; approvals: ApprovalService }> {
  const workspaces = new WorkspaceService(
    new SQLiteWorkspaceGrantRepository(input.database),
    new LocalWorkspaceDirectoryReader(input.deniedFileRoots),
    input.conversations,
    input.clock,
    input.ids,
    new LocalWorkspaceFileWriter(input.recoveryRoot),
    new LocalConversationWorkspaceRootProvider(input.managedWorkspaceRoot),
    new WorkspaceAuthorizationRegistry(
      new SQLiteWorkspaceDirectoryAuthorizationRepository(input.database),
      input.sessions,
      input.clock,
      input.ids,
      new SQLiteWorkspaceApprovalModePreferenceRepository(input.database),
    ),
    new HostWorkspaceCommandExecutor(),
  );
  const approvals = new ApprovalService(
    new SQLiteApprovalRequestRepository(input.database),
    new ActionPolicyService(),
    input.clock,
    input.ids,
    { fingerprint: (value) => createHash("sha256").update(value).digest("hex") },
    {
      record: async (diagnostic) => {
        await input.securityAudit.approvalSink().record(diagnostic);
        input.logger.log({
          level: diagnostic.event === "denied_by_policy" ? "warn" : "info",
          category: "audit",
          event: `approval.${diagnostic.event}`,
          message: "Action approval lifecycle changed; action content omitted by policy",
          context: {
            event: diagnostic.event,
            ...(diagnostic.approvalId ? { approvalId: diagnostic.approvalId } : {}),
            conversationId: diagnostic.conversationId,
            runId: diagnostic.runId,
            actionKind: diagnostic.actionKind,
            risk: diagnostic.risk,
            ruleId: diagnostic.ruleId,
            ...(diagnostic.decision ? { decision: diagnostic.decision } : {}),
          },
        });
      },
    },
  );
  await approvals.expirePersisted();
  return { workspaces, approvals };
}
