import type { PlannedAction, ToolCapabilityDefinition } from "@zimo/domain";

import type { RegisteredTool } from "./tool-runtime";
import {
  onlyWorkspaceToolKeys,
  optionalWorkspaceToolString,
  workspaceToolInteger,
  workspaceToolString,
  workspaceToolUuid,
} from "./workspace-tool-input";
import type { WorkspaceService } from "./workspace-service";
import { WORKSPACE_TOOL_IDS } from "./workspace-tool-ids";

const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;
const MAX_COMMAND_TIMEOUT_MS = 360_000;

export function createWorkspaceCommandTool(workspaces: WorkspaceService): RegisteredTool {
  const definition: ToolCapabilityDefinition = {
    id: WORKSPACE_TOOL_IDS.runCommand,
    title: "运行终端命令",
    description:
      "在用户选择的项目目录中运行 Shell 命令，可使用管道、重定向和命令组合；只有没有用户项目目录时才使用默认 Zimo Workspace。每次执行都会请求用户批准；进程以当前操作系统用户权限运行，尚未进入 OS 沙箱。",
    source: "builtin",
    permissions: [
      {
        id: "workspace:command:execute",
        title: "在宿主机运行终端命令",
        description: "命令拥有当前操作系统用户权限，每次执行前必须由用户单独批准。",
        risk: "high",
      },
    ],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        command: { type: "string", minLength: 1, maxLength: 20_000 },
        cwd: { type: "string", maxLength: 1_000, default: "" },
        timeoutMs: {
          type: "integer",
          minimum: 1_000,
          maximum: MAX_COMMAND_TIMEOUT_MS,
          default: DEFAULT_COMMAND_TIMEOUT_MS,
        },
      },
      required: ["workspaceId", "command"],
    },
    annotations: { readOnly: false, destructive: true, idempotent: false, openWorld: true },
    confirmation: "per_run",
    // Leave a small cleanup window after the command-specific timeout.
    timeoutMs: MAX_COMMAND_TIMEOUT_MS + 5_000,
  };
  return {
    definition,
    parse: (input) => {
      onlyWorkspaceToolKeys(input, ["workspaceId", "command", "cwd", "timeoutMs"]);
      const command = workspaceToolString(input.command, 20_000);
      if (command.includes("\0")) throw new Error("invalid command");
      return {
        workspaceId: workspaceToolUuid(input.workspaceId),
        command,
        cwd: optionalWorkspaceToolString(input.cwd, 1_000) ?? "",
        timeoutMs: workspaceToolInteger(
          input.timeoutMs,
          1_000,
          MAX_COMMAND_TIMEOUT_MS,
          DEFAULT_COMMAND_TIMEOUT_MS,
        ),
      };
    },
    planAction: (value, context): Promise<PlannedAction> =>
      workspaces.planCommand(
        context.workflowId,
        value.workspaceId as string,
        value.cwd as string,
        value.command as string,
      ),
    execute: (value, context) =>
      workspaces.runCommand(
        context.workflowId,
        value.workspaceId as string,
        {
          cwd: value.cwd as string,
          command: value.command as string,
          timeoutMs: value.timeoutMs as number,
        },
        context.signal,
      ),
  };
}
