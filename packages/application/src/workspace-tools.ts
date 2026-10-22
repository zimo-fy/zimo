import type { ToolCapabilityDefinition } from "@zimo/domain";

import type { RegisteredTool } from "./tool-runtime";
import type { WorkspaceService } from "./workspace-service";
import { WORKSPACE_TOOL_IDS } from "./workspace-tool-ids";
import { createWorkspaceCommandTool } from "./workspace-command-tool";
import { createWorkspaceMutationTools } from "./workspace-mutation-tools";
import {
  onlyWorkspaceToolKeys as onlyKeys,
  optionalWorkspaceToolString as optionalString,
  workspaceToolInteger as integer,
  optionalWorkspaceToolUuid as optionalUuid,
  workspaceToolString as string,
} from "./workspace-tool-input";

export function createWorkspaceTools(workspaces: WorkspaceService): readonly RegisteredTool[] {
  return [
    ...createWorkspaceReadOnlyTools(workspaces),
    ...createWorkspaceMutationTools(workspaces),
    ...(workspaces.hasCommandExecution() ? [createWorkspaceCommandTool(workspaces)] : []),
  ];
}

export function createWorkspaceReadOnlyTools(
  workspaces: WorkspaceService,
): readonly RegisteredTool[] {
  return [
    tool(
      WORKSPACE_TOOL_IDS.list,
      "列出工作目录",
      "分页列出已授权工作目录，或列出用户要求分析的其他本机绝对目录。Zimo 内部与敏感路径始终拒绝。",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          workspaceId: { type: "string", format: "uuid" },
          absolutePath: { type: "string", minLength: 1, maxLength: 4096 },
          path: { type: "string", maxLength: 1000, default: "" },
          cursor: { type: "integer", minimum: 0, default: 0 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
        },
      },
      (value) => readAddress(value, true),
      (value, context) =>
        value.workspaceId
          ? workspaces.listEntries(
              context.workflowId,
              value.workspaceId as string,
              {
                path: value.path as string,
                cursor: value.cursor as number,
                limit: value.limit as number,
              },
              context.signal,
            )
          : workspaces.listAbsolute(
              context.workflowId,
              value.absolutePath as string,
              { cursor: value.cursor as number, limit: value.limit as number },
              context.signal,
            ),
    ),
    tool(
      WORKSPACE_TOOL_IDS.search,
      "搜索工作目录",
      "按文件名 glob 或文本内容搜索已授权工作目录或指定的本机绝对目录；结果有数量和读取体积限制。",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          workspaceId: { type: "string", format: "uuid" },
          absolutePath: { type: "string", minLength: 1, maxLength: 4096 },
          query: { type: "string", minLength: 1, maxLength: 500 },
          pattern: { type: "string", minLength: 1, maxLength: 200 },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        },
      },
      (value) => {
        onlyKeys(value, ["workspaceId", "absolutePath", "query", "pattern", "limit"]);
        const workspaceId = optionalUuid(value.workspaceId);
        const absolutePath = optionalString(value.absolutePath, 4_096);
        requireOneAddress(workspaceId, absolutePath);
        const query = optionalString(value.query, 500);
        const pattern = optionalString(value.pattern, 200);
        if (!query && !pattern) throw new Error("query or pattern required");
        return {
          ...(workspaceId ? { workspaceId } : { absolutePath }),
          ...(query ? { query } : {}),
          ...(pattern ? { pattern } : {}),
          limit: integer(value.limit, 1, 50, 20),
        };
      },
      (value, context) =>
        value.workspaceId
          ? workspaces.search(
              context.workflowId,
              value.workspaceId as string,
              {
                ...(value.query ? { query: value.query as string } : {}),
                ...(value.pattern ? { pattern: value.pattern as string } : {}),
                limit: value.limit as number,
              },
              context.signal,
            )
          : workspaces.searchAbsolute(
              context.workflowId,
              value.absolutePath as string,
              {
                ...(value.query ? { query: value.query as string } : {}),
                ...(value.pattern ? { pattern: value.pattern as string } : {}),
                limit: value.limit as number,
              },
              context.signal,
            ),
    ),
    tool(
      WORKSPACE_TOOL_IDS.read,
      "读取工作目录文件",
      "分页读取已授权工作目录或用户要求分析的其他本机绝对路径；禁止 Zimo 内部数据、凭据文件和二进制。",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          workspaceId: { type: "string", format: "uuid" },
          absolutePath: { type: "string", minLength: 1, maxLength: 4096 },
          path: { type: "string", minLength: 1, maxLength: 1000 },
          cursor: { type: "integer", minimum: 0, default: 0 },
          maxCharacters: { type: "integer", minimum: 200, maximum: 12000, default: 6000 },
        },
      },
      (value) => {
        const workspaceId = optionalUuid(value.workspaceId);
        const absolutePath = optionalString(value.absolutePath, 4_096);
        requireOneAddress(workspaceId, absolutePath);
        const path = workspaceId ? string(value.path, 1_000) : undefined;
        if (!workspaceId && value.path !== undefined)
          throw new Error("relative path without workspace");
        return {
          ...(workspaceId ? { workspaceId, path } : { absolutePath }),
          cursor: integer(value.cursor, 0, 10_000_000, 0),
          maxCharacters: integer(value.maxCharacters, 200, 12_000, 6_000),
        };
      },
      (value, context) =>
        value.workspaceId
          ? workspaces.read(
              context.workflowId,
              value.workspaceId as string,
              {
                path: value.path as string,
                cursor: value.cursor as number,
                maxCharacters: value.maxCharacters as number,
              },
              context.signal,
            )
          : workspaces.readAbsolute(
              context.workflowId,
              value.absolutePath as string,
              {
                cursor: value.cursor as number,
                maxCharacters: value.maxCharacters as number,
              },
              context.signal,
            ),
    ),
  ];
}

function readAddress(value: Readonly<Record<string, unknown>>, allowEmptyPath: boolean) {
  const workspaceId = optionalUuid(value.workspaceId);
  const absolutePath = optionalString(value.absolutePath, 4_096);
  requireOneAddress(workspaceId, absolutePath);
  if (!workspaceId && value.path !== undefined) throw new Error("relative path without workspace");
  return {
    ...(workspaceId
      ? { workspaceId, path: string(value.path, 1_000, allowEmptyPath) }
      : { absolutePath }),
    cursor: integer(value.cursor, 0, 1_000_000, 0),
    limit: integer(value.limit, 1, 200, 100),
  };
}

function requireOneAddress(
  workspaceId: string | undefined,
  absolutePath: string | undefined,
): void {
  if (Boolean(workspaceId) === Boolean(absolutePath)) throw new Error("one address required");
}

function tool(
  id: string,
  title: string,
  description: string,
  inputSchema: Readonly<Record<string, unknown>>,
  parse: RegisteredTool["parse"],
  execute: RegisteredTool["execute"],
): RegisteredTool {
  const definition: ToolCapabilityDefinition = {
    id,
    title,
    description,
    source: "builtin",
    permissions: [
      {
        id: "workspace:read",
        title: "读取本机普通文件",
        description: "可读取工作目录及其他本机普通文本文件，但始终排除 Zimo 内部和敏感路径。",
        risk: "low",
      },
    ],
    inputSchema,
    annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
    confirmation: "per_run",
    timeoutMs: 30_000,
  };
  return {
    definition,
    parse: (input) => {
      onlyKeys(input, Object.keys((inputSchema.properties ?? {}) as object));
      return parse(input);
    },
    execute,
  };
}
