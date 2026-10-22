import { z } from "zod";

import type { IpcResult } from "./index";

export const workspaceGrantViewSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    displayName: z.string().min(1).max(180),
    kind: z.enum(["managed", "external"]),
    mode: z.enum(["ask", "auto_approve"]),
    status: z.enum(["active", "unavailable"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type WorkspaceGrantView = z.infer<typeof workspaceGrantViewSchema>;

export const workspaceAuthorizationViewSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(180),
    location: z.string().min(1).max(4_096),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type WorkspaceAuthorizationView = z.infer<typeof workspaceAuthorizationViewSchema>;

const request = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();
const conversation = z.object({ conversationId: z.uuid() }).strict();
const workspace = z.object({ conversationId: z.uuid(), workspaceId: z.uuid() }).strict();

export const workspaceListRequestSchema = request(conversation);
export const workspaceSelectRequestSchema = request(conversation);
export const workspaceAttachDroppedRequestSchema = request(
  z.object({ conversationId: z.uuid(), sourcePath: z.string().min(1).max(4_096) }).strict(),
);
export const workspaceRemoveRequestSchema = request(workspace);
export const workspaceChangeModeRequestSchema = request(
  z.object({ conversationId: z.uuid(), mode: z.enum(["ask", "auto_approve"]) }).strict(),
);
export const workspaceAuthorizationListRequestSchema = request(z.object({}).strict());
export const workspaceAuthorizationRevokeRequestSchema = request(
  z.object({ authorizationId: z.uuid() }).strict(),
);

export interface WorkspacesDesktopApi {
  list(requestId: string, conversationId: string): Promise<IpcResult<WorkspaceGrantView[]>>;
  select(requestId: string, conversationId: string): Promise<IpcResult<WorkspaceGrantView | null>>;
  attachDropped(
    requestId: string,
    conversationId: string,
    file: unknown,
  ): Promise<IpcResult<WorkspaceGrantView>>;
  remove(
    requestId: string,
    conversationId: string,
    workspaceId: string,
  ): Promise<IpcResult<{ success: true }>>;
  changeMode(
    requestId: string,
    conversationId: string,
    mode: "ask" | "auto_approve",
  ): Promise<IpcResult<{ success: true }>>;
  listAuthorizations(requestId: string): Promise<IpcResult<WorkspaceAuthorizationView[]>>;
  revokeAuthorization(
    requestId: string,
    authorizationId: string,
  ): Promise<IpcResult<{ success: true }>>;
}
