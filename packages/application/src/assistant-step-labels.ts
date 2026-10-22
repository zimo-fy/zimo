import type {
  AssistantStep,
  AssistantStepKind,
  AssistantStepStatus,
  PlannedAction,
} from "@zimo/domain";

import { WORKSPACE_TOOL_IDS } from "./workspace-tool-ids";

const TITLE_LIMIT = 80;
const WINDOWS_ABSOLUTE = /^[a-zA-Z]:[\\/]/u;
const UNC_PATH = /^\\\\/u;
const UUID_VALUE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const WORKSPACE_STEP_VERBS: Readonly<Record<string, { kind: AssistantStepKind; verb: string }>> = {
  [WORKSPACE_TOOL_IDS.read]: { kind: "file_read", verb: "读取" },
  [WORKSPACE_TOOL_IDS.list]: { kind: "file_read", verb: "列出" },
  [WORKSPACE_TOOL_IDS.search]: { kind: "file_read", verb: "搜索" },
  [WORKSPACE_TOOL_IDS.create]: { kind: "file_write", verb: "创建" },
  [WORKSPACE_TOOL_IDS.patch]: { kind: "file_write", verb: "修改" },
  [WORKSPACE_TOOL_IDS.delete]: { kind: "file_delete", verb: "删除" },
  [WORKSPACE_TOOL_IDS.runCommand]: { kind: "command", verb: "执行命令" },
};

export async function reportAssistantToolStep(input: {
  onStep?: (step: AssistantStep) => void | Promise<void>;
  id: string;
  toolId: string;
  toolTitle: string;
  parsedInput?: Readonly<Record<string, unknown>>;
  plannedAction?: PlannedAction;
  status: AssistantStepStatus;
}): Promise<void> {
  if (!input.onStep || !input.parsedInput) return;
  await Promise.resolve(
    input.onStep(
      describeAssistantStep({
        id: input.id,
        toolId: input.toolId,
        toolTitle: input.toolTitle,
        parsedInput: input.parsedInput,
        ...(input.plannedAction ? { plannedAction: input.plannedAction } : {}),
        status: input.status,
      }),
    ),
  ).catch(() => undefined);
}

export function describeAssistantStep(input: {
  id: string;
  toolId: string;
  toolTitle: string;
  parsedInput: Readonly<Record<string, unknown>>;
  plannedAction?: PlannedAction;
  status: AssistantStepStatus;
}): AssistantStep {
  const mapped = WORKSPACE_STEP_VERBS[input.toolId];
  const relativeTarget =
    displayTarget(input.plannedAction?.relativeTarget) ?? targetFromInput(input.parsedInput);
  const title = clip(
    input.plannedAction?.summary ||
      (mapped && relativeTarget ? `${mapped.verb} ${relativeTarget}` : undefined) ||
      input.toolTitle,
  );
  const kind = input.plannedAction?.kind ?? mapped?.kind ?? "tool";
  const named = Boolean(input.plannedAction || mapped);
  return {
    id: input.id,
    kind,
    title,
    status: input.status,
    ...(named ? { resultTitle: clip(`已${title}`) } : { resultTitle: "已完成" }),
    ...(relativeTarget ? { relativeTarget } : {}),
  };
}

function targetFromInput(input: Readonly<Record<string, unknown>>): string | undefined {
  return displayTarget(stringField(input.path)) ?? displayTarget(stringField(input.absolutePath));
}

export function displayTarget(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || UUID_VALUE.test(trimmed)) return undefined;
  const normalized = trimmed.replaceAll("\\", "/");
  const isAbsolute =
    WINDOWS_ABSOLUTE.test(trimmed) ||
    UNC_PATH.test(trimmed) ||
    normalized.startsWith("/") ||
    normalized.includes("://");
  const source = isAbsolute
    ? (normalized.split("/").filter(Boolean).at(-1) ?? "")
    : normalized.replace(/^\/+/u, "");
  const clipped = clip(source);
  return clipped || undefined;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function clip(value: string): string {
  return value.slice(0, TITLE_LIMIT);
}
