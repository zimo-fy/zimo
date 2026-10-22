import type {
  Clock,
  KnowledgeChunk,
  ModelConnection,
  ToolAuditSink,
  ToolCapabilityDefinition,
  ToolExecutionContext,
  PlannedAction,
  AssistantStep,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import { reportAssistantToolStep } from "./assistant-step-labels";
import { BROWSER_TOOL_IDS } from "./browser-tool-ids";

export interface RegisteredTool {
  definition: ToolCapabilityDefinition;
  parse(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
  planAction?(
    input: Readonly<Record<string, unknown>>,
    context: ToolExecutionContext,
  ): PlannedAction | Promise<PlannedAction>;
  execute(
    input: Readonly<Record<string, unknown>>,
    context: ToolExecutionContext & { signal: AbortSignal; modelConnection?: ModelConnection },
  ): Promise<unknown>;
}

export type ToolActionAuthorizer = (input: {
  toolId: string;
  input: Readonly<Record<string, unknown>>;
  action: PlannedAction;
  context: ToolExecutionContext;
  signal: AbortSignal;
}) => Promise<{ allowed: boolean; errorCode?: string; message?: string }>;

export interface ToolRunLifecycle {
  closeRun(runId: string): Promise<void>;
}

export interface ReadOnlyKnowledgeSearch {
  search(
    knowledgeBaseId: string,
    query: string,
    limit: number,
  ): Promise<
    readonly {
      documentName: string;
      text: string;
      score: number;
      matchType: "keyword" | "semantic" | "hybrid";
      metadata: KnowledgeChunk["metadata"];
    }[]
  >;
}

export class ControlledToolService {
  private readonly registry: Map<string, RegisteredTool>;

  constructor(
    tools: readonly RegisteredTool[],
    private readonly audit: ToolAuditSink,
    private readonly clock: Clock,
    private readonly runLifecycle?: ToolRunLifecycle,
  ) {
    this.registry = new Map(tools.map((tool) => [tool.definition.id, tool]));
    if (this.registry.size !== tools.length) {
      throw new Error("Tool capability IDs must be unique");
    }
  }

  replaceMcpServer(serverId: string, tools: readonly RegisteredTool[]): void {
    const prefix = `mcp.${serverId}.`;
    for (const id of this.registry.keys()) {
      if (id.startsWith(prefix)) this.registry.delete(id);
    }
    for (const tool of tools) {
      if (!tool.definition.id.startsWith(prefix) || this.registry.has(tool.definition.id)) {
        throw new Error("Invalid or duplicate MCP capability ID");
      }
      this.registry.set(tool.definition.id, tool);
    }
  }

  replaceSkill(skillId: string, tools: readonly RegisteredTool[]): void {
    const prefix = `skill.${skillId}.`;
    for (const id of this.registry.keys()) {
      if (id.startsWith(prefix)) this.registry.delete(id);
    }
    for (const tool of tools) {
      if (!tool.definition.id.startsWith(prefix) || this.registry.has(tool.definition.id)) {
        throw new Error("Invalid or duplicate Skill capability ID");
      }
      this.registry.set(tool.definition.id, tool);
    }
  }

  list(): readonly ToolCapabilityDefinition[] {
    return [...this.registry.values()].map((tool) => tool.definition);
  }

  async closeRun(runId: string): Promise<void> {
    await this.runLifecycle?.closeRun(runId);
  }

  assertConfirmed(toolIds: readonly string[], confirmedToolIds: readonly string[]): void {
    const confirmed = new Set(confirmedToolIds);
    for (const toolId of new Set(toolIds)) {
      const tool = this.registry.get(toolId);
      if (!tool) {
        throw toolError("TOOL_NOT_REGISTERED", `工具“${toolId}”未在可信注册表中。`);
      }
      if (!confirmed.has(toolId)) {
        throw new AppError({
          code: "TOOL_CONFIRMATION_REQUIRED",
          category: "user",
          userMessage: `运行前需要确认工具“${tool.definition.title}”及其权限。`,
          safeDetails: { toolId },
        });
      }
    }
  }

  async execute(
    request: {
      toolId: string;
      input: Readonly<Record<string, unknown>>;
      confirmedToolIds: readonly string[];
      context: ToolExecutionContext;
      modelConnection?: ModelConnection;
      authorizeAction?: ToolActionAuthorizer;
      onStep?(step: AssistantStep): void | Promise<void>;
    },
    parentSignal: AbortSignal,
  ): Promise<unknown> {
    const tool = this.registry.get(request.toolId);
    if (!tool) {
      throw toolError("TOOL_NOT_REGISTERED", `工具“${request.toolId}”未在可信注册表中。`);
    }
    const startedAt = this.clock.now();
    const confirmed = request.confirmedToolIds.includes(request.toolId);
    let outcome: "success" | "failure" | "cancelled" | "timed_out" = "failure";
    let errorCode: string | undefined;
    let plannedAction: PlannedAction | undefined;
    let parsedInput: Readonly<Record<string, unknown>> | undefined;
    const reportStep = (status: AssistantStep["status"]) =>
      reportAssistantToolStep({
        ...(request.onStep ? { onStep: request.onStep } : {}),
        id: request.context.toolCallId,
        toolId: request.toolId,
        toolTitle: tool.definition.title,
        ...(parsedInput ? { parsedInput } : {}),
        ...(plannedAction ? { plannedAction } : {}),
        status,
      });
    try {
      if (!confirmed) {
        throw new AppError({
          code: "TOOL_CONFIRMATION_REQUIRED",
          category: "user",
          userMessage: `运行前需要确认工具“${tool.definition.title}”及其权限。`,
        });
      }
      let input: Readonly<Record<string, unknown>>;
      try {
        input = tool.parse(request.input);
      } catch (error) {
        throw new AppError({
          code: "TOOL_ARGUMENTS_INVALID",
          category: "user",
          userMessage: `“${tool.definition.title}”的参数不符合 Schema。`,
          cause: error,
        });
      }
      parsedInput = input;
      if (tool.planAction) {
        if (!request.authorizeAction) {
          throw toolError("ACTION_APPROVAL_UNAVAILABLE", "当前运行无法安全审批该操作。");
        }
        plannedAction = await tool.planAction(input, request.context);
        await reportStep("running");
        const authorization = await request.authorizeAction({
          toolId: request.toolId,
          input,
          action: plannedAction,
          context: request.context,
          signal: parentSignal,
        });
        if (!authorization.allowed) {
          errorCode = authorization.errorCode ?? "ACTION_DENIED_BY_USER";
          await reportStep("denied");
          return {
            ok: false,
            errorCode,
            message: authorization.message ?? "操作未获批准。",
          };
        }
      } else {
        await reportStep("running");
      }
      if (!tool.definition.annotations.readOnly && this.audit.begin) {
        await this.audit.begin({
          ...request.context,
          toolId: request.toolId,
          permissionIds: tool.definition.permissions.map((permission) => permission.id),
          inputKeys: Object.keys(request.input).sort(),
          confirmed,
          ...(plannedAction ? { action: plannedAction } : {}),
          createdAt: startedAt,
        });
      }
      const output = await executeWithToolTimeout(
        (signal) =>
          tool.execute(input, {
            ...request.context,
            signal,
            ...(request.modelConnection ? { modelConnection: request.modelConnection } : {}),
          }),
        parentSignal,
        tool.definition.timeoutMs,
      );
      let serialized: string | undefined;
      try {
        serialized = JSON.stringify(output);
      } catch (error) {
        throw new AppError({
          code: "TOOL_OUTPUT_INVALID",
          category: "internal",
          userMessage: "工具返回了无法安全序列化的结果。",
          cause: error,
        });
      }
      if (serialized === undefined) {
        throw toolError("TOOL_OUTPUT_INVALID", "工具没有返回可用结果。");
      }
      const maxOutputCharacters =
        request.toolId === BROWSER_TOOL_IDS.snapshot || request.toolId === BROWSER_TOOL_IDS.wait
          ? 350_000
          : 100_000;
      if (serialized.length > maxOutputCharacters) {
        throw toolError(
          "TOOL_OUTPUT_TOO_LARGE",
          `工具返回内容超过 ${maxOutputCharacters} 字符限制。`,
        );
      }
      outcome = "success";
      await reportStep("completed");
      return output;
    } catch (error) {
      errorCode =
        isAbort(error) || parentSignal.aborted
          ? "TOOL_CANCELLED"
          : error instanceof AppError
            ? error.code
            : "TOOL_EXECUTION_FAILED";
      outcome =
        errorCode === "TOOL_TIMEOUT"
          ? "timed_out"
          : isAbort(error) || parentSignal.aborted
            ? "cancelled"
            : "failure";
      await reportStep(outcome === "cancelled" || outcome === "timed_out" ? "cancelled" : "failed");
      throw error;
    } finally {
      await this.audit
        .record({
          ...request.context,
          toolId: request.toolId,
          permissionIds: tool.definition.permissions.map((permission) => permission.id),
          inputKeys: Object.keys(request.input).sort(),
          confirmed,
          ...(plannedAction ? { action: plannedAction } : {}),
          outcome,
          durationMs: Math.max(0, this.clock.now().getTime() - startedAt.getTime()),
          ...(errorCode ? { errorCode } : {}),
          createdAt: startedAt,
        })
        .catch(() => undefined);
    }
  }
}

export function createBuiltinReadOnlyTools(
  knowledge: ReadOnlyKnowledgeSearch,
): readonly RegisteredTool[] {
  return [
    {
      definition: {
        id: "zimo.knowledge.search",
        title: "本地知识库检索",
        description: "只读检索一个已启用的本地知识库，不访问网络或修改文件。",
        source: "builtin",
        permissions: [
          {
            id: "knowledge:read",
            title: "读取本地知识库索引",
            description: "可检索用户已经导入并启用的知识库文本索引。",
            risk: "low",
          },
        ],
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            knowledgeBaseId: { type: "string", format: "uuid" },
            query: { type: "string", minLength: 1, maxLength: 10_000 },
            limit: { type: "integer", minimum: 1, maximum: 8, default: 5 },
          },
          required: ["knowledgeBaseId", "query"],
        },
        annotations: {
          readOnly: true,
          destructive: false,
          idempotent: true,
          openWorld: false,
        },
        confirmation: "per_run",
        timeoutMs: 10_000,
      },
      parse: parseKnowledgeSearchToolInput,
      execute: async (value, context) => {
        if (context.signal.aborted) throw abortError();
        const parsed = parseKnowledgeSearchToolInput(value);
        const hits = await knowledge.search(parsed.knowledgeBaseId, parsed.query, parsed.limit);
        if (context.signal.aborted) throw abortError();
        return {
          matches: hits.map((hit) => ({
            documentName: hit.documentName,
            text: hit.text,
            score: hit.score,
            matchType: hit.matchType,
            metadata: hit.metadata,
          })),
        };
      },
    },
  ];
}

function parseKnowledgeSearchToolInput(value: Readonly<Record<string, unknown>>): {
  knowledgeBaseId: string;
  query: string;
  limit: number;
} {
  if (Object.keys(value).some((key) => !["knowledgeBaseId", "query", "limit"].includes(key))) {
    throw new Error("Unknown tool argument");
  }
  const knowledgeBaseId = value.knowledgeBaseId;
  const query = typeof value.query === "string" ? value.query.trim() : "";
  const limit = value.limit ?? 5;
  if (
    typeof knowledgeBaseId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      knowledgeBaseId,
    ) ||
    !query ||
    query.length > 10_000 ||
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 8
  ) {
    throw new Error("Invalid knowledge search arguments");
  }
  return { knowledgeBaseId, query, limit };
}

async function executeWithToolTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parentSignal: AbortSignal,
  timeoutMs: number,
): Promise<T> {
  if (parentSignal.aborted) throw abortError();
  const controller = new AbortController();
  let rejectParentCancellation: ((reason?: unknown) => void) | undefined;
  const parentCancellation = new Promise<never>((_resolve, reject) => {
    rejectParentCancellation = reject;
  });
  const abortFromParent = () => {
    controller.abort();
    rejectParentCancellation?.(abortError());
  };
  parentSignal.addEventListener("abort", abortFromParent, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new AppError({
            code: "TOOL_TIMEOUT",
            category: "user",
            userMessage: `工具执行超过 ${timeoutMs}ms，已请求取消。`,
            retryable: true,
          });
          reject(error);
          controller.abort();
        }, timeoutMs);
      }),
      parentCancellation,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal.removeEventListener("abort", abortFromParent);
  }
}

function toolError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "configuration", userMessage });
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function abortError(): Error {
  return new DOMException("Aborted", "AbortError");
}
