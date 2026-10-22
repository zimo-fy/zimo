import type { BrowserAutomationGateway, BrowserKey, ToolCapabilityDefinition } from "@zimo/domain";

import { BROWSER_TOOL_IDS } from "./browser-tool-ids";
import type { BrowserRunLease } from "./browser-run-lease";
import type { RegisteredTool } from "./tool-runtime";

const TARGET_ID_MAX = 160;
const SNAPSHOT_ID_MAX = 120;
const REF_MAX = 80;

export function createBrowserTools(
  browser: BrowserAutomationGateway,
  lease?: BrowserRunLease,
): readonly RegisteredTool[] {
  const tools = [
    tool(
      BROWSER_TOOL_IDS.tabs,
      "获取浏览器标签页",
      "列出 Zimo 独立浏览器 Profile 当前打开的网页标签页；若为空，可用 browser_open 创建标签页。",
      emptySchema,
      true,
      (_input, context) => browser.listTabs(context.signal),
    ),
    tool(
      BROWSER_TOOL_IDS.open,
      "新建浏览器标签页",
      "在 Zimo 独立浏览器中新建标签页并打开公开 HTTP 或 HTTPS 地址；返回真实 targetId，随后读取网页结构确认页面状态。",
      {
        type: "object",
        additionalProperties: false,
        properties: { url: { type: "string", minLength: 1, maxLength: 2_048 } },
        required: ["url"],
      },
      false,
      (input, context) => browser.open(input.url as string, context.signal),
    ),
    tool(
      BROWSER_TOOL_IDS.focus,
      "切换浏览器标签页",
      "将指定网页标签页切换到前台。",
      targetSchema,
      false,
      (input, context) => browser.focus(input.targetId as string, context.signal).then(ok),
    ),
    tool(
      BROWSER_TOOL_IDS.snapshot,
      "读取网页结构",
      "读取网页可访问性结构并返回可供后续点击或输入使用的元素 ref。页面变化后应重新读取。",
      targetSchema,
      true,
      (input, context) => browser.snapshot(input.targetId as string, context.signal),
    ),
    tool(
      BROWSER_TOOL_IDS.screenshot,
      "截取网页画面",
      "截取指定标签页并保存到当前会话 Workspace。返回文件名，不返回图片 Base64。",
      targetSchema,
      true,
      (input, context) =>
        browser.screenshot(
          context.artifactConversationId ?? context.workflowId,
          input.targetId as string,
          context.signal,
        ),
    ),
    tool(
      BROWSER_TOOL_IDS.navigate,
      "打开网页地址",
      "在指定标签页导航到公开 HTTP 或 HTTPS 地址。",
      {
        ...targetSchema,
        properties: {
          ...targetSchema.properties,
          url: { type: "string", minLength: 1, maxLength: 2_048 },
        },
        required: ["targetId", "url"],
      },
      false,
      (input, context) =>
        browser.navigate(input.targetId as string, input.url as string, context.signal).then(ok),
    ),
    tool(
      BROWSER_TOOL_IDS.click,
      "点击网页元素",
      "点击最近一次网页结构快照中的元素；快照失效时需要重新读取网页结构。",
      interactionSchema(false),
      false,
      (input, context) =>
        browser
          .click(
            input.targetId as string,
            input.snapshotId as string,
            input.ref as string,
            context.signal,
          )
          .then(ok),
    ),
    tool(
      BROWSER_TOOL_IDS.type,
      "输入网页文本",
      "向最近一次网页结构快照中的普通文本输入元素写入文本。密码字段必须由用户手动填写。",
      interactionSchema(true),
      false,
      (input, context) =>
        browser
          .type(
            input.targetId as string,
            input.snapshotId as string,
            input.ref as string,
            input.text as string,
            context.signal,
          )
          .then(ok),
    ),
    createPressTool(browser),
    tool(
      BROWSER_TOOL_IDS.scroll,
      "滚动网页",
      "滚动页面或最近一次网页结构快照中的可滚动元素。页面变化后应重新读取网页结构。",
      scrollSchema,
      false,
      (input, context) =>
        browser
          .scroll(
            input.targetId as string,
            input.snapshotId as string,
            input.ref as string | undefined,
            (input.deltaX as number | undefined) ?? 0,
            input.deltaY as number,
            context.signal,
          )
          .then(ok),
    ),
    tool(
      BROWSER_TOOL_IDS.wait,
      "等待网页更新",
      "等待有限时间后返回新的网页结构快照，用于页面加载或动作后的短暂更新；不得连续无界等待。",
      waitSchema,
      true,
      (input, context) =>
        browser.wait(input.targetId as string, input.timeoutMs as number, context.signal),
    ),
  ];
  return lease
    ? tools.map((registered) => ({
        ...registered,
        execute: async (input, context) => {
          lease.claim(context.runId);
          return registered.execute(input, context);
        },
      }))
    : tools;
}

const targetSchema = {
  type: "object",
  additionalProperties: false,
  properties: { targetId: { type: "string", minLength: 1, maxLength: TARGET_ID_MAX } },
  required: ["targetId"],
} as const;

const emptySchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
  required: [],
} as const;

const scrollSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    targetId: { type: "string", minLength: 1, maxLength: TARGET_ID_MAX },
    snapshotId: { type: "string", minLength: 1, maxLength: SNAPSHOT_ID_MAX },
    ref: { type: "string", minLength: 1, maxLength: REF_MAX },
    deltaX: { type: "integer", minimum: -1_000, maximum: 1_000 },
    deltaY: { type: "integer", minimum: -1_000, maximum: 1_000 },
  },
  required: ["targetId", "snapshotId", "deltaY"],
} as const;

const waitSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    targetId: { type: "string", minLength: 1, maxLength: TARGET_ID_MAX },
    timeoutMs: { type: "integer", minimum: 100, maximum: 5_000 },
  },
  required: ["targetId", "timeoutMs"],
} as const;

function createPressTool(browser: BrowserAutomationGateway): RegisteredTool {
  const schema = {
    ...interactionSchema(false),
    properties: {
      ...(interactionSchema(false).properties as Readonly<Record<string, unknown>>),
      key: { type: "string", enum: ["Enter", "Escape", "Tab", "ArrowUp", "ArrowDown", "Space"] },
    },
    required: ["targetId", "key"],
  };
  const registered = tool(
    BROWSER_TOOL_IDS.press,
    "按下网页按键",
    "Enter、Tab、方向键和空格必须同时提供 targetId、最新 snapshotId、元素 ref、key 四个字段；仅 Escape 是页面级按键，只需 targetId 和 key。按键不负责输入文字。",
    schema,
    false,
    (input, context) =>
      browser
        .press(
          input.targetId as string,
          input.snapshotId as string | undefined,
          input.ref as string | undefined,
          input.key as BrowserKey,
          context.signal,
        )
        .then(ok),
  );
  return {
    ...registered,
    parse: (input) => {
      const parsed = registered.parse(input);
      if (parsed.key !== "Escape" && (!parsed.snapshotId || !parsed.ref)) {
        throw new Error("focused key requires snapshotId and ref");
      }
      return parsed;
    },
  };
}

function interactionSchema(withText: boolean): Readonly<Record<string, unknown>> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      targetId: { type: "string", minLength: 1, maxLength: TARGET_ID_MAX },
      snapshotId: { type: "string", minLength: 1, maxLength: SNAPSHOT_ID_MAX },
      ref: { type: "string", minLength: 1, maxLength: REF_MAX },
      ...(withText ? { text: { type: "string", maxLength: 20_000 } } : {}),
    },
    required: withText
      ? ["targetId", "snapshotId", "ref", "text"]
      : ["targetId", "snapshotId", "ref"],
  };
}

function tool(
  id: string,
  title: string,
  description: string,
  inputSchema: Readonly<Record<string, unknown>>,
  readOnly: boolean,
  execute: RegisteredTool["execute"],
): RegisteredTool {
  const definition: ToolCapabilityDefinition = {
    id,
    title,
    description,
    source: "builtin",
    permissions: [
      {
        id: readOnly ? "browser:observe" : "browser:interact",
        title: readOnly ? "读取独立浏览器" : "操作独立浏览器",
        description: "访问当前登录账号的 Zimo 独立浏览器 Profile。",
        risk: readOnly ? "low" : "high",
      },
    ],
    inputSchema,
    annotations: {
      readOnly,
      destructive: false,
      idempotent: readOnly,
      openWorld: true,
    },
    confirmation: "per_run",
    timeoutMs: 30_000,
  };
  return {
    definition,
    parse: (input) => parseInput(inputSchema, input),
    execute,
  };
}

function parseInput(
  schema: Readonly<Record<string, unknown>>,
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const properties = schema.properties as Readonly<Record<string, unknown>> | undefined;
  const allowed = new Set(Object.keys(properties ?? {}));
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error("unknown field");
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const definition = properties?.[key] as
      | {
          type?: string;
          maxLength?: number;
          minimum?: number;
          maximum?: number;
          enum?: readonly string[];
        }
      | undefined;
    if (definition?.type === "integer") {
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        (definition.minimum !== undefined && value < definition.minimum) ||
        (definition.maximum !== undefined && value > definition.maximum)
      ) {
        throw new Error("invalid integer field");
      }
      result[key] = value;
      continue;
    }
    if (
      typeof value !== "string" ||
      (definition?.maxLength !== undefined && value.length > definition.maxLength) ||
      (definition?.enum && !definition.enum.includes(value))
    ) {
      throw new Error("invalid string field");
    }
    if (key !== "text" && value.trim().length === 0) throw new Error("empty field");
    result[key] = key === "text" ? value : value.trim();
  }
  const required = (schema.required as readonly string[] | undefined) ?? [];
  if (required.some((key) => result[key] === undefined)) throw new Error("missing field");
  return result;
}

function ok(): Readonly<{ success: true }> {
  return { success: true };
}
