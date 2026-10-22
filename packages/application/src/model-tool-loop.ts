import {
  AppError,
  mergeTokenUsage,
  type ModelConnection,
  type ModelGateway,
  type ModelGatewayMessage,
  type ModelGatewayToolCall,
  type ModelGatewayToolDefinition,
  type ModelGatewayToolMessage,
  type TokenUsage,
  type AssistantStep,
} from "@zimo/domain";

import { DOCUMENT_TOOL_IDS } from "./document-tools";
import { BROWSER_TOOL_IDS, browserModelToolName } from "./browser-tool-ids";
import type { ControlledToolService, ToolActionAuthorizer } from "./tool-runtime";
import { WEB_ACCESS_TOOL_IDS } from "./web-access-tools";
import { USER_MEMORY_TOOL_ID } from "./user-memory-tool";
import {
  CAPABILITY_SEARCH_MAX_CALLS,
  CAPABILITY_SEARCH_TOOL_ID,
  type CapabilitySearchRequest,
  type CapabilitySearchResult,
} from "./capability-discovery-service";

export const ASK_USER_QUESTION_TOOL_ID = "zimo.interaction.ask_user_question";
const QUESTION_TOOL_SCHEMA: Readonly<Record<string, unknown>> = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1, maxLength: 40 },
          header: { type: "string", minLength: 1, maxLength: 40 },
          question: { type: "string", minLength: 1, maxLength: 500 },
          options: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string", minLength: 1, maxLength: 80 },
                description: { type: "string", maxLength: 200 },
              },
              required: ["label"],
            },
          },
          multiSelect: { type: "boolean" },
        },
        required: ["id", "header", "question", "options"],
      },
    },
  },
  required: ["questions"],
};
const CAPABILITY_SEARCH_SCHEMA: Readonly<Record<string, unknown>> = {
  type: "object",
  additionalProperties: false,
  properties: {
    query: { type: "string", minLength: 1, maxLength: 500 },
    kinds: {
      type: "array",
      maxItems: 5,
      items: { type: "string", enum: ["skill", "agent", "mcp", "knowledge", "workflow"] },
    },
    requiredActions: {
      type: "array",
      maxItems: 10,
      items: { type: "string", maxLength: 80 },
    },
    packageIds: {
      type: "array",
      maxItems: 5,
      items: {
        type: "string",
        minLength: 3,
        maxLength: 80,
        pattern: "^[a-z0-9][a-z0-9._-]{2,79}$",
      },
      description: "已知目标 Skill 时使用稳定 packageId 精确加载，可一次加载多个平台能力。",
    },
  },
  required: ["query"],
};

export interface ModelToolRoundCapture {
  round: number;
  messages: readonly ModelGatewayToolMessage[];
  tools: readonly ModelGatewayToolDefinition[];
  toolCalls: readonly ModelGatewayToolCall[];
}

export async function runModelToolLoop(input: {
  gateway: ModelGateway;
  connection: ModelConnection;
  messages: readonly ModelGatewayMessage[];
  mcpServerIds?: readonly string[];
  toolIds?: readonly string[];
  tools: ControlledToolService;
  signal: AbortSignal;
  streamSignal?: AbortSignal;
  context: Readonly<{
    runId: string;
    workflowId: string;
    nodeId: string;
    ownerUserId?: string;
    artifactConversationId?: string;
  }>;
  createToolCallId(): string;
  captureRound?(capture: ModelToolRoundCapture): void;
  authorizeAction?: ToolActionAuthorizer;
  onStep?(step: AssistantStep): void | Promise<void>;
  onText?(text: string): void | Promise<void>;
  askUserQuestion?(argumentsValue: Readonly<Record<string, unknown>>): Promise<unknown>;
  searchCapabilities?(
    request: CapabilitySearchRequest,
    activeToolIds: readonly string[],
    signal: AbortSignal,
  ): Promise<CapabilitySearchResult>;
}): Promise<{ content: string; usage?: TokenUsage }> {
  if (!input.gateway.streamWithTools) {
    throw new AppError({
      code: "MODEL_TOOL_CALLING_UNAVAILABLE",
      category: "configuration",
      userMessage: "当前模型适配器不支持工具调用。",
    });
  }
  const activeToolIds = [...new Set(input.toolIds ?? [])];
  for (const tool of input.tools.list()) {
    if (
      (input.mcpServerIds ?? []).some((serverId) => tool.id.startsWith(`mcp.${serverId}.`)) &&
      !activeToolIds.includes(tool.id)
    ) {
      activeToolIds.push(tool.id);
    }
  }
  if (activeToolIds.length === 0 && !input.askUserQuestion && !input.searchCapabilities) {
    throw new AppError({
      code: "AGENT_MCP_TOOLS_UNAVAILABLE",
      category: "configuration",
      userMessage: "当前绑定的 MCP 或 Skill 没有可用工具，请刷新连接或重新安装 Skill。",
    });
  }
  const conversation: ModelGatewayToolMessage[] = input.messages.map((message) => ({ ...message }));
  const streamSignal = input.streamSignal ?? input.signal;
  let round = 0;
  let usage: TokenUsage | undefined;
  let content = "";
  let capabilitySearchCount = 0;
  let browserTargetRecoveryCount = 0;
  let browserRefRecoveryCount = 0;
  let browserPressArgumentRecoveryCount = 0;
  try {
    while (true) {
      round += 1;
      const registeredTools = new Map(input.tools.list().map((tool) => [tool.id, tool] as const));
      const selected = activeToolIds.flatMap((toolId) => {
        const tool = registeredTools.get(toolId);
        return tool ? [tool] : [];
      });
      const aliases = createAliases([
        ...selected.map((tool) => tool.id),
        ...(input.searchCapabilities ? [CAPABILITY_SEARCH_TOOL_ID] : []),
        ...(input.askUserQuestion ? [ASK_USER_QUESTION_TOOL_ID] : []),
      ]);
      const exposedTools = selected.map((tool) => ({
        name: aliases.byId.get(tool.id)!,
        description: `${tool.title}: ${tool.description}`.slice(0, 2_000),
        inputSchema: tool.inputSchema,
      }));
      if (input.askUserQuestion)
        exposedTools.push({
          name: "ask_user_question",
          description:
            "需要用户决定方案、补充信息时提问。支持单选、多选和自输入；此工具不是操作授权，不得代替文件或命令审批。",
          inputSchema: QUESTION_TOOL_SCHEMA,
        });
      if (input.searchCapabilities)
        exposedTools.push({
          name: "search_capabilities",
          description:
            "当前已暴露工具或知识不足以完成任务时，搜索用户本地已安装的 Skill、Agent、MCP、知识库和 Workflow；本地未命中时返回可安装建议。已安装且可执行的能力会自动加入当前任务，不要再次要求用户授权。",
          inputSchema: CAPABILITY_SEARCH_SCHEMA,
        });
      let toolCalls: readonly ModelGatewayToolCall[] = [];
      let turnUsage: TokenUsage | undefined;
      content = "";
      try {
        for await (const event of input.gateway.streamWithTools(
          input.connection,
          conversation,
          exposedTools,
          streamSignal,
        )) {
          if (event.type === "usage") turnUsage = event.usage;
          if (input.signal.aborted) continue;
          if (event.type === "text") {
            content += event.text;
            await input.onText?.(event.text);
          } else if (event.type === "tool_calls") {
            toolCalls = event.toolCalls;
          }
        }
      } catch (error) {
        usage = mergeTokenUsage(usage, turnUsage);
        if (isAbort(error) || input.signal.aborted) {
          return { content, ...(usage ? { usage } : {}) };
        }
        throw error;
      }
      input.captureRound?.({
        round,
        messages: conversation.map((message) => ({ ...message })),
        tools: exposedTools.map((tool) => ({ ...tool })),
        toolCalls: toolCalls.map((call) => ({ ...call })),
      });
      usage = mergeTokenUsage(usage, turnUsage);
      if (input.signal.aborted || toolCalls.length === 0) {
        return { content, ...(usage ? { usage } : {}) };
      }
      conversation.push({
        role: "assistant",
        content,
        toolCalls,
      });
      const groups = groupToolCalls(toolCalls, aliases.byAlias);
      const questionGroup = groups.find((group) => group.toolId === ASK_USER_QUESTION_TOOL_ID);
      let questionHandled = false;
      for (const group of groups) {
        if (input.signal.aborted) return { content, ...(usage ? { usage } : {}) };
        let output: unknown;
        if (group.toolId === CAPABILITY_SEARCH_TOOL_ID) {
          capabilitySearchCount += 1;
          if (capabilitySearchCount > CAPABILITY_SEARCH_MAX_CALLS) {
            output = {
              ok: false,
              errorCode: "CAPABILITY_SEARCH_LIMIT_EXCEEDED",
              message: "当前任务的能力搜索次数已达到上限，请根据已有结果继续处理。",
            };
          } else {
            const stepId = `capability-search-${round}`;
            await input.onStep?.({
              id: stepId,
              kind: "tool",
              title: "查找可用能力",
              status: "running",
              resultTitle: "已查找可用能力",
            });
            try {
              const result = await input.searchCapabilities!(
                group.arguments as unknown as CapabilitySearchRequest,
                activeToolIds,
                input.signal,
              );
              const registered = new Set(input.tools.list().map((tool) => tool.id));
              for (const toolId of result.loadedToolIds) {
                if (!registered.has(toolId)) continue;
                if (!activeToolIds.includes(toolId)) activeToolIds.push(toolId);
              }
              output = {
                installed: result.installed,
                installable: result.installable,
                guidance: result.guidance,
              };
              await input.onStep?.({
                id: stepId,
                kind: "tool",
                title: "查找可用能力",
                status: "completed",
                resultTitle:
                  result.installed.length > 0
                    ? `已加载 ${result.installed.length} 项能力`
                    : "未找到本地能力",
              });
            } catch (error) {
              await input.onStep?.({
                id: stepId,
                kind: "tool",
                title: "查找可用能力",
                status: input.signal.aborted ? "cancelled" : "failed",
                resultTitle: input.signal.aborted ? "已取消能力查找" : "能力查找失败",
              });
              throw error;
            }
          }
        } else if (questionGroup) {
          output =
            group === questionGroup && !questionHandled
              ? await input.askUserQuestion!(group.arguments)
              : {
                  ok: false,
                  errorCode: "QUESTION_BATCH_DEFERRED",
                  message: "请在用户回答后重新调用此工具。",
                };
        } else {
          try {
            output = await input.tools.execute(
              {
                toolId: group.toolId,
                input: group.arguments,
                confirmedToolIds: activeToolIds,
                context: {
                  ...input.context,
                  toolCallId: input.createToolCallId(),
                },
                ...(group.toolId === WEB_ACCESS_TOOL_IDS.search
                  ? { modelConnection: input.connection }
                  : {}),
                ...(input.authorizeAction ? { authorizeAction: input.authorizeAction } : {}),
                ...(input.onStep ? { onStep: input.onStep } : {}),
              },
              input.signal,
            );
          } catch (error) {
            if (
              input.signal.aborted ||
              !group.toolId.startsWith("zimo.browser.") ||
              !(error instanceof AppError)
            ) {
              throw error;
            }
            if (error.code === "BROWSER_TARGET_NOT_FOUND" && browserTargetRecoveryCount < 2) {
              browserTargetRecoveryCount += 1;
              output = {
                ok: false,
                errorCode: error.code,
                message:
                  "指定的标签页 ID 不在当前浏览器中。先调用 browser_tabs，选择返回的真实 targetId，再重新读取页面快照；不要猜测 ID。",
              };
            } else if (
              (error.code === "BROWSER_REF_NOT_FOUND" || error.code === "BROWSER_SNAPSHOT_STALE") &&
              browserRefRecoveryCount < 2
            ) {
              browserRefRecoveryCount += 1;
              output = {
                ok: false,
                errorCode: error.code,
                message:
                  "先调用 browser_snapshot 获取当前网页结构，再仅使用该结果中的 snapshotId 和元素 ref；ref 不能填写 CSS 选择器。",
              };
            } else if (
              group.toolId === BROWSER_TOOL_IDS.press &&
              error.code === "TOOL_ARGUMENTS_INVALID" &&
              group.arguments.key === "Enter" &&
              (!group.arguments.snapshotId || !group.arguments.ref) &&
              browserPressArgumentRecoveryCount < 1
            ) {
              browserPressArgumentRecoveryCount += 1;
              output = {
                ok: false,
                errorCode: error.code,
                message:
                  "Enter 未执行，输入框草稿可能仍在。不要再次输入；先调用 browser_snapshot 核对会话和草稿，再用最新 targetId、snapshotId、编辑器 ref、key=Enter 调用 browser_press。",
              };
            } else {
              throw error;
            }
          }
        }
        if (group === questionGroup) questionHandled = true;
        for (const call of group.calls) {
          conversation.push({
            role: "tool",
            name: call.name,
            toolCallId: call.id,
            content: JSON.stringify(output),
          });
        }
      }
    }
  } catch (error) {
    if (isAbort(error) || input.signal.aborted) {
      return { content, ...(usage ? { usage } : {}) };
    }
    throw error;
  } finally {
    await input.tools.closeRun(input.context.runId);
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function groupToolCalls(
  calls: readonly ModelGatewayToolCall[],
  toolIds: ReadonlyMap<string, string>,
): readonly {
  toolId: string;
  arguments: Readonly<Record<string, unknown>>;
  calls: readonly ModelGatewayToolCall[];
}[] {
  const groups: {
    toolId: string;
    arguments: Record<string, unknown>;
    calls: ModelGatewayToolCall[];
  }[] = [];
  const documentPatches = new Map<string, (typeof groups)[number]>();
  for (const call of calls) {
    const toolId = toolIds.get(call.name);
    if (!toolId) throw modelToolNotExposed();
    const documentRef = call.arguments.documentRef;
    const operations = call.arguments.operations;
    if (
      toolId === DOCUMENT_TOOL_IDS.patch &&
      typeof documentRef === "string" &&
      Array.isArray(operations)
    ) {
      const existing = documentPatches.get(documentRef);
      if (existing) {
        (existing.arguments.operations as unknown[]).push(...operations);
        existing.calls.push(call);
      } else {
        const group = {
          toolId,
          arguments: { documentRef, operations: [...operations] },
          calls: [call],
        };
        documentPatches.set(documentRef, group);
        groups.push(group);
      }
    } else {
      groups.push({ toolId, arguments: { ...call.arguments }, calls: [call] });
    }
  }
  return groups;
}

function modelToolNotExposed(): AppError {
  return new AppError({
    code: "MODEL_TOOL_NOT_EXPOSED",
    category: "security",
    userMessage: "模型请求了本轮未授权的工具。",
  });
}

function createAliases(toolIds: readonly string[]): {
  byId: ReadonlyMap<string, string>;
  byAlias: ReadonlyMap<string, string>;
} {
  const byId = new Map<string, string>();
  const byAlias = new Map<string, string>();
  toolIds.forEach((id, index) => {
    const webAlias =
      id === WEB_ACCESS_TOOL_IDS.search
        ? "web_search"
        : id === WEB_ACCESS_TOOL_IDS.fetch
          ? "web_fetch"
          : undefined;
    const browserAlias = browserModelToolName(id);
    const tail =
      id
        .split(".")
        .at(-1)
        ?.replace(/[^A-Za-z0-9_-]/g, "_") ?? "tool";
    const alias =
      id === ASK_USER_QUESTION_TOOL_ID
        ? "ask_user_question"
        : id === CAPABILITY_SEARCH_TOOL_ID
          ? "search_capabilities"
          : id === USER_MEMORY_TOOL_ID
            ? "save_user_memory"
            : (browserAlias ?? webAlias ?? `mcp_${index}_${tail}`.slice(0, 64));
    byId.set(id, alias);
    byAlias.set(alias, id);
  });
  return { byId, byAlias };
}
