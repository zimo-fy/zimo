import { z } from "zod";

import type { IpcResult } from "./index";

const ipcRequest = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const mcpToolViewSchema = z
  .object({
    id: z.string().min(1).max(240),
    name: z.string().min(1).max(128),
    title: z.string().min(1).max(160).optional(),
    description: z.string().max(2_000).optional(),
    readOnly: z.boolean().optional(),
    destructive: z.boolean().optional(),
    enabled: z.literal(true),
  })
  .strict();
export type McpToolView = z.infer<typeof mcpToolViewSchema>;

export const mcpConnectionViewSchema = z
  .object({
    serverId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    name: z.string().min(1).max(80),
    endpoint: z.url().max(2_048),
    source: z.enum(["custom", "catalog"]),
    authentication: z.enum(["none", "bearer", "oauth", "header_token", "api_key", "query_token"]),
    serverName: z.string().min(1).max(160),
    serverVersion: z.string().min(1).max(100).optional(),
    tools: z.array(mcpToolViewSchema).max(500),
    connectedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type McpConnectionView = z.infer<typeof mcpConnectionViewSchema>;

export const connectMcpInputSchema = z
  .object({
    serverId: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    name: z.string().trim().min(1).max(80),
    endpoint: z.url().max(2_048),
    source: z.enum(["custom", "catalog"]),
    authentication: z.enum(["none", "bearer", "oauth", "header_token", "api_key", "query_token"]),
    credential: z.string().trim().min(1).max(4_096).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const manuallyAuthenticated = ["bearer", "header_token", "api_key", "query_token"].includes(
      value.authentication,
    );
    if (manuallyAuthenticated && !value.credential) {
      context.addIssue({ code: "custom", path: ["credential"], message: "访问凭据不能为空" });
    }
    if (!manuallyAuthenticated && value.credential) {
      context.addIssue({
        code: "custom",
        path: ["credential"],
        message: "当前认证方式不接收手动凭据",
      });
    }
    if (
      value.authentication === "header_token" &&
      (value.source !== "catalog" || value.serverId !== "tencent-meeting")
    ) {
      context.addIssue({
        code: "custom",
        path: ["authentication"],
        message: "Header Token 仅支持内置腾讯会议服务",
      });
    }
    if (["api_key", "query_token"].includes(value.authentication) && value.source !== "catalog") {
      context.addIssue({
        code: "custom",
        path: ["authentication"],
        message: "固定 API Key 认证仅支持内置目录服务",
      });
    }
  });
export type ConnectMcpInput = z.infer<typeof connectMcpInputSchema>;

export const mcpProbeViewSchema = z
  .object({
    serverName: z.string().min(1).max(160),
    serverVersion: z.string().min(1).max(100).optional(),
    toolCount: z.number().int().nonnegative().max(500),
  })
  .strict();
export type McpProbeView = z.infer<typeof mcpProbeViewSchema>;

export const mcpServerIdInputSchema = z
  .object({ serverId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/) })
  .strict();
export const connectMcpRequestSchema = ipcRequest(connectMcpInputSchema);
export const mcpServerRequestSchema = ipcRequest(mcpServerIdInputSchema);

export interface McpDesktopApi {
  list(requestId: string): Promise<IpcResult<readonly McpConnectionView[]>>;
  probe(requestId: string, input: ConnectMcpInput): Promise<IpcResult<McpProbeView>>;
  connect(requestId: string, input: ConnectMcpInput): Promise<IpcResult<McpConnectionView>>;
  refresh(requestId: string, serverId: string): Promise<IpcResult<McpConnectionView>>;
  disconnect(requestId: string, serverId: string): Promise<IpcResult<{ success: true }>>;
}

// Compatibility aliases are retained until callers migrate to the registry names.
export const githubMcpToolViewSchema = mcpToolViewSchema;
export const githubMcpConnectionViewSchema = mcpConnectionViewSchema;
export const connectGithubMcpInputSchema = connectMcpInputSchema;
export const connectGithubMcpRequestSchema = connectMcpRequestSchema;
export type GithubMcpToolView = McpToolView;
export type GithubMcpConnectionView = McpConnectionView;
export type GithubMcpDesktopApi = McpDesktopApi;
