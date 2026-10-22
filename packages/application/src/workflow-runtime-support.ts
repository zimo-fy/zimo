import { AppError, type KnowledgeCitation, type PrototypeDefinition } from "@zimo/domain";
import type { SerializedAppError } from "@zimo/contracts";

export function uniquePrototypes(values: readonly PrototypeDefinition[]): PrototypeDefinition[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

export function normalizeWorkflowCitations(
  values: readonly KnowledgeCitation[],
): KnowledgeCitation[] {
  const unique = values.filter(
    (value, index) =>
      values.findIndex((candidate) => candidate.chunkId === value.chunkId) === index,
  );
  return unique.slice(0, 8).map((value, index) => ({ ...value, index: index + 1 }));
}

export function requireWorkflowText(value: string): string {
  const text = value.trim();
  if (!text || text.length > 100_000) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      category: "user",
      userMessage: "测试输入不能为空，且不能超过 100000 个字符。",
    });
  }
  return text;
}

export function workflowRuntimeError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "configuration", userMessage });
}

export function serializeWorkflowRuntimeError(error: unknown): SerializedAppError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      category: error.category,
      message: error.userMessage,
      retryable: error.retryable,
    };
  }
  return {
    code: "WORKFLOW_RUN_FAILED",
    category: "internal",
    message: "工作流运行失败，请检查节点配置后重试。",
    retryable: false,
  };
}

export function isWorkflowAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function workflowAbortError(): Error {
  return new DOMException("Aborted", "AbortError");
}
