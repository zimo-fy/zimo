import type { WorkspaceService } from "@zimo/application";
import {
  IPC_CHANNELS,
  successViewSchema,
  workspaceAttachDroppedRequestSchema,
  workspaceAuthorizationListRequestSchema,
  workspaceAuthorizationRevokeRequestSchema,
  workspaceAuthorizationViewSchema,
  workspaceChangeModeRequestSchema,
  workspaceGrantViewSchema,
  workspaceListRequestSchema,
  workspaceRemoveRequestSchema,
  workspaceSelectRequestSchema,
  type WorkspaceGrantView,
  type WorkspaceAuthorizationView,
} from "@zimo/contracts";
import type { WorkspaceGrant } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import { BrowserWindow, dialog } from "electron";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerWorkspaceIpcHandlers(
  register: RegisterIpcHandler,
  options: { workspaces: WorkspaceService; logger: StructuredLogger | null },
): void {
  register({
    channel: IPC_CHANNELS.workspaceList,
    input: workspaceListRequestSchema,
    output: workspaceGrantViewSchema.array(),
    handle: async ({ payload }) =>
      (await options.workspaces.list(payload.conversationId)).map(toWorkspaceGrantView),
  });
  register({
    channel: IPC_CHANNELS.workspaceSelect,
    input: workspaceSelectRequestSchema,
    output: workspaceGrantViewSchema.nullable(),
    handle: async ({ payload }, event) => {
      const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const dialogOptions = {
        title: "添加工作目录到当前任务",
        properties: ["openDirectory"] as ["openDirectory"],
      };
      const selection = parent
        ? await dialog.showOpenDialog(parent, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
      if (selection.canceled || !selection.filePaths[0]) return null;
      return attach(options, payload.conversationId, selection.filePaths[0], "picker");
    },
  });
  register({
    channel: IPC_CHANNELS.workspaceAttachDropped,
    input: workspaceAttachDroppedRequestSchema,
    output: workspaceGrantViewSchema,
    handle: ({ payload }) => attach(options, payload.conversationId, payload.sourcePath, "drop"),
  });
  register({
    channel: IPC_CHANNELS.workspaceRemove,
    input: workspaceRemoveRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.workspaces.remove(payload.conversationId, payload.workspaceId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "workspace.grant.removed",
        message: "Conversation workspace grant removed",
        context: {
          conversationId: payload.conversationId,
          workspaceId: payload.workspaceId,
          outcome: "success",
        },
      });
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.workspaceChangeMode,
    input: workspaceChangeModeRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.workspaces.changeMode(payload.conversationId, payload.mode);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "workspace.approval_mode.changed",
        message: "Conversation workspace approval mode changed",
        context: {
          conversationId: payload.conversationId,
          mode: payload.mode,
          outcome: "success",
        },
      });
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.workspaceAuthorizationList,
    input: workspaceAuthorizationListRequestSchema,
    output: workspaceAuthorizationViewSchema.array(),
    handle: async () =>
      (await options.workspaces.listAuthorizations()).map(toWorkspaceAuthorizationView),
  });
  register({
    channel: IPC_CHANNELS.workspaceAuthorizationRevoke,
    input: workspaceAuthorizationRevokeRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.workspaces.revokeAuthorization(payload.authorizationId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "workspace.authorization.revoked",
        message: "Remembered workspace authorization revoked",
        context: { authorizationId: payload.authorizationId, outcome: "success" },
      });
      return { success: true as const };
    },
  });
}

async function attach(
  options: { workspaces: WorkspaceService; logger: StructuredLogger | null },
  conversationId: string,
  sourcePath: string,
  source: "picker" | "drop",
): Promise<WorkspaceGrantView> {
  const grant = await options.workspaces.attach(conversationId, sourcePath);
  options.logger?.log({
    level: "info",
    category: "audit",
    event: "workspace.grant.created",
    message: "Conversation workspace grant created",
    context: {
      conversationId,
      workspaceId: grant.id,
      source,
      mode: grant.mode,
      outcome: "success",
    },
  });
  return toWorkspaceGrantView(grant);
}

function toWorkspaceGrantView(grant: WorkspaceGrant): WorkspaceGrantView {
  return {
    id: grant.id,
    conversationId: grant.conversationId,
    displayName: grant.displayName,
    kind: grant.kind,
    mode: grant.mode,
    status: grant.status,
    createdAt: grant.createdAt.toISOString(),
    updatedAt: grant.updatedAt.toISOString(),
  };
}

function toWorkspaceAuthorizationView(
  value: Awaited<ReturnType<WorkspaceService["listAuthorizations"]>>[number],
): WorkspaceAuthorizationView {
  return {
    id: value.id,
    displayName: value.displayName,
    location: value.rootRef,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
