import type { ToolCapabilityDefinition, UserMemoryKind } from "@zimo/domain";
import { AppError } from "@zimo/domain";

import type { RegisteredTool } from "./tool-runtime";
import type { UserMemoryService } from "./user-memory-service";

export const USER_MEMORY_TOOL_ID = "zimo.memory.save";

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["preference", "goal", "open_issue"] },
    content: { type: "string", minLength: 1, maxLength: 500 },
  },
  required: ["kind", "content"],
} as const;

export function createUserMemoryTool(memories: UserMemoryService): RegisteredTool {
  const definition: ToolCapabilityDefinition = {
    id: USER_MEMORY_TOOL_ID,
    title: "保存用户记忆",
    description:
      "用户在当前对话中透露了值得在未来会话使用的个人偏好、持续目标或未解决问题时，保存为当前账号的长期记忆。称呼可作为偏好保存，例如“请称呼我为大力”。不要为一次性任务调用。每次仅保存一条简短事实。",
    source: "builtin",
    permissions: [
      {
        id: "memory:write",
        title: "保存用户记忆",
        description: "向当前登录账号的本地用户记忆写入一条内容，后续普通会话可使用。",
        risk: "medium",
      },
    ],
    inputSchema: INPUT_SCHEMA,
    annotations: { readOnly: false, destructive: false, idempotent: true, openWorld: false },
    confirmation: "per_run",
    timeoutMs: 10_000,
  };
  return {
    definition,
    parse(value) {
      if (Object.keys(value).some((key) => key !== "kind" && key !== "content")) {
        throw new Error("Unknown memory argument");
      }
      const kind = value.kind;
      const content = value.content;
      if (
        (kind !== "preference" && kind !== "goal" && kind !== "open_issue") ||
        typeof content !== "string" ||
        !content.trim() ||
        content.length > 500
      ) {
        throw new Error("Invalid memory argument");
      }
      return { kind, content: content.trim() };
    },
    async execute(value, context) {
      if (!context.ownerUserId) {
        throw new AppError({
          code: "USER_MEMORY_OWNER_REQUIRED",
          category: "security",
          userMessage: "当前运行无法确认记忆所属账号，未保存。",
        });
      }
      if (context.signal.aborted) throw new DOMException("Aborted", "AbortError");
      const saved = await memories.saveFromModel({
        kind: value.kind as UserMemoryKind,
        content: value.content as string,
        expectedOwnerUserId: context.ownerUserId,
      });
      return { saved };
    },
  };
}
