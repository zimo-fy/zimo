import type {
  PlannedAction,
  ToolCapabilityDefinition,
  WorkspaceTextPatchOperation,
} from "@zimo/domain";

import type { RegisteredTool } from "./tool-runtime";
import {
  onlyWorkspaceToolKeys,
  workspaceToolChecksum,
  optionalWorkspaceToolString,
  optionalWorkspaceToolUuid,
  workspaceToolString,
} from "./workspace-tool-input";
import type { WorkspaceService } from "./workspace-service";
import { WORKSPACE_TOOL_IDS } from "./workspace-tool-ids";

export function createWorkspaceMutationTools(
  workspaces: WorkspaceService,
): readonly RegisteredTool[] {
  return [
    createTool(workspaces),
    createDirectoryTool(workspaces),
    patchTool(workspaces),
    deleteTool(workspaces),
  ];
}

function createDirectoryTool(workspaces: WorkspaceService): RegisteredTool {
  return mutationTool({
    definition: definition(
      WORKSPACE_TOOL_IDS.mkdir,
      "创建工作目录子目录",
      "在已授权目录中创建一个子目录；父目录必须已存在，不递归创建，也不覆盖已有目标。未授权绝对目录须先获得写入授权。",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          workspaceId: { type: "string", format: "uuid" },
          absolutePath: { type: "string", minLength: 1, maxLength: 4096 },
          path: { type: "string", minLength: 1, maxLength: 1000 },
        },
      },
      false,
    ),
    parse: parseAddress,
    planAction: (value, context) =>
      planAction(workspaces, context.workflowId, value, "file_write", "创建目录"),
    execute: (value, context) =>
      value.workspaceId
        ? workspaces.createDirectory(
            context.workflowId,
            value.workspaceId as string,
            { path: value.path as string },
            context.signal,
          )
        : workspaces.createAbsoluteDirectory(
            context.workflowId,
            value.absolutePath as string,
            context.signal,
          ),
  });
}

function createTool(workspaces: WorkspaceService): RegisteredTool {
  return mutationTool({
    definition: definition(
      WORKSPACE_TOOL_IDS.create,
      "创建工作目录文件",
      "在已授权目录中创建普通文本文件；未授权绝对目录会先请求用户授权并记住该目录。不会覆盖已有文件。",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          workspaceId: { type: "string", format: "uuid" },
          absolutePath: { type: "string", minLength: 1, maxLength: 4096 },
          path: { type: "string", minLength: 1, maxLength: 1000 },
          content: { type: "string", maxLength: 500000 },
        },
        required: ["content"],
      },
      false,
    ),
    parse: (value) => ({
      ...parseAddress(value),
      content: workspaceToolString(value.content, 500_000, true),
    }),
    planAction: (value, context) =>
      planAction(workspaces, context.workflowId, value, "file_write", "创建"),
    execute: (value, context) =>
      value.workspaceId
        ? workspaces.createFile(
            context.workflowId,
            value.workspaceId as string,
            { path: value.path as string, content: value.content as string },
            context.signal,
          )
        : workspaces.createAbsoluteFile(
            context.workflowId,
            value.absolutePath as string,
            value.content as string,
            context.signal,
          ),
  });
}

function patchTool(workspaces: WorkspaceService): RegisteredTool {
  return mutationTool({
    definition: definition(
      WORKSPACE_TOOL_IDS.patch,
      "修改工作目录文件",
      "按精确文本替换修改普通文本文件。未授权绝对目录会先请求用户授权并记住该目录；必须提交最新 checksum。",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          workspaceId: { type: "string", format: "uuid" },
          absolutePath: { type: "string", minLength: 1, maxLength: 4096 },
          path: { type: "string", minLength: 1, maxLength: 1000 },
          expectedChecksum: { type: "string", pattern: "^[a-f0-9]{64}$" },
          operations: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                search: { type: "string", minLength: 1, maxLength: 100000 },
                replacement: { type: "string", maxLength: 100000 },
                replaceAll: { type: "boolean", default: false },
              },
              required: ["search", "replacement"],
            },
          },
        },
        required: ["expectedChecksum", "operations"],
      },
      false,
    ),
    parse: (value) => ({
      ...parseAddress(value),
      expectedChecksum: workspaceToolChecksum(value.expectedChecksum),
      operations: parseOperations(value.operations),
    }),
    planAction: (value, context) =>
      planAction(workspaces, context.workflowId, value, "file_write", "修改"),
    execute: (value, context) =>
      value.workspaceId
        ? workspaces.patchFile(
            context.workflowId,
            value.workspaceId as string,
            {
              path: value.path as string,
              expectedChecksum: value.expectedChecksum as string,
              operations: value.operations as unknown as WorkspaceTextPatchOperation[],
            },
            context.signal,
          )
        : workspaces.patchAbsoluteFile(
            context.workflowId,
            value.absolutePath as string,
            {
              expectedChecksum: value.expectedChecksum as string,
              operations: value.operations as unknown as WorkspaceTextPatchOperation[],
            },
            context.signal,
          ),
  });
}

function deleteTool(workspaces: WorkspaceService): RegisteredTool {
  return mutationTool({
    definition: definition(
      WORKSPACE_TOOL_IDS.delete,
      "删除工作目录文件",
      "删除读取过且 checksum 未变化的普通文件；执行前保存恢复副本并始终要求人工审批。",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          workspaceId: { type: "string", format: "uuid" },
          absolutePath: { type: "string", minLength: 1, maxLength: 4096 },
          path: { type: "string", minLength: 1, maxLength: 1000 },
          expectedChecksum: { type: "string", pattern: "^[a-f0-9]{64}$" },
        },
        required: ["expectedChecksum"],
      },
      true,
    ),
    parse: (value) => ({
      ...parseAddress(value),
      expectedChecksum: workspaceToolChecksum(value.expectedChecksum),
    }),
    planAction: (value, context) =>
      planAction(workspaces, context.workflowId, value, "file_delete", "删除"),
    execute: (value, context) =>
      value.workspaceId
        ? workspaces.deleteFile(
            context.workflowId,
            value.workspaceId as string,
            { path: value.path as string, expectedChecksum: value.expectedChecksum as string },
            context.signal,
          )
        : workspaces.deleteAbsoluteFile(
            context.workflowId,
            value.absolutePath as string,
            value.expectedChecksum as string,
            context.signal,
          ),
  });
}

function mutationTool(tool: RegisteredTool): RegisteredTool {
  const properties = Object.keys(
    (tool.definition.inputSchema.properties ?? {}) as Record<string, unknown>,
  );
  return {
    ...tool,
    parse: (input) => {
      onlyWorkspaceToolKeys(input, properties);
      return tool.parse(input);
    },
  };
}

function definition(
  id: string,
  title: string,
  description: string,
  inputSchema: Readonly<Record<string, unknown>>,
  destructive: boolean,
): ToolCapabilityDefinition {
  return {
    id,
    title,
    description,
    source: "builtin",
    permissions: [
      {
        id: destructive ? "workspace:delete" : "workspace:write",
        title: destructive ? "删除当前任务工作目录文件" : "修改当前任务工作目录",
        description: "只能操作已授权且通过安全校验的普通文本文件；首次写入其他目录必须人工授权。",
        risk: destructive ? "high" : "medium",
      },
    ],
    inputSchema,
    annotations: { readOnly: false, destructive, idempotent: false, openWorld: false },
    confirmation: "per_run",
    timeoutMs: 30_000,
  };
}

async function planAction(
  workspaces: WorkspaceService,
  conversationId: string,
  value: Readonly<Record<string, unknown>>,
  kind: "file_write" | "file_delete",
  verb: "创建" | "创建目录" | "修改" | "删除",
): Promise<PlannedAction> {
  const target = (value.path ?? value.absolutePath) as string;
  const risk = kind === "file_delete" ? "high" : pathRisk(target);
  if (value.workspaceId) {
    return workspaces.planWorkspaceMutation(
      conversationId,
      value.workspaceId as string,
      value.path as string,
      { kind, risk, verb },
    );
  }
  return workspaces.planAbsoluteMutation(conversationId, value.absolutePath as string, {
    kind,
    risk,
    verb,
  });
}

function parseAddress(value: Readonly<Record<string, unknown>>) {
  const workspaceId = optionalWorkspaceToolUuid(value.workspaceId);
  const absolutePath = optionalWorkspaceToolString(value.absolutePath, 4_096);
  if (Boolean(workspaceId) === Boolean(absolutePath)) throw new Error("one address required");
  if (workspaceId) {
    if (value.absolutePath !== undefined) throw new Error("multiple addresses");
    return { workspaceId, path: workspaceToolString(value.path, 1_000) };
  }
  if (value.path !== undefined) throw new Error("relative path without workspace");
  return { absolutePath: absolutePath! };
}

function pathRisk(path: string): "low" | "medium" | "high" {
  const lower = path.toLocaleLowerCase();
  const name = lower.split("/").at(-1) ?? "";
  if (
    [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lock",
      "bun.lockb",
      "dockerfile",
      "makefile",
    ].includes(name) ||
    lower.startsWith(".github/workflows/") ||
    lower.startsWith("scripts/") ||
    lower.includes("/scripts/") ||
    lower.startsWith(".github/actions/")
  ) {
    return "high";
  }
  if (name.startsWith(".") || /\.(config|json|ya?ml|toml)$/u.test(lower)) {
    return "medium";
  }
  return "low";
}

function parseOperations(value: unknown): readonly WorkspaceTextPatchOperation[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error("invalid operations");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("invalid operation");
    const operation = item as Record<string, unknown>;
    onlyWorkspaceToolKeys(operation, ["search", "replacement", "replaceAll"]);
    if (operation.replaceAll !== undefined && typeof operation.replaceAll !== "boolean") {
      throw new Error("invalid replaceAll");
    }
    return {
      search: workspaceToolString(operation.search, 100_000),
      replacement: workspaceToolString(operation.replacement, 100_000, true),
      replaceAll: operation.replaceAll === true,
    };
  });
}
