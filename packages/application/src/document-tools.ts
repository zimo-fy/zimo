import {
  DOCUMENT_EDITABLE_FORMATS,
  type DocumentCreateContent,
  type DocumentFormat,
  type DocumentPatchOperation,
  type DocumentSelector,
  type ToolCapabilityDefinition,
} from "@zimo/domain";

import type { DocumentArtifactService } from "./document-artifact-service";
import { documentPatchSchema } from "./document-patch-schema";
import type { RegisteredTool } from "./tool-runtime";
import {
  finiteNumber,
  integer,
  limitedString,
  onlyKeys,
  parseDocumentFormat as format,
  positiveIntegers,
  record,
  requireString as string,
  slideRows,
  stringArray,
  tableRows,
} from "./document-tool-validation";

export const DOCUMENT_TOOL_IDS = {
  inspect: "zimo.document.inspect",
  read: "zimo.document.read",
  create: "zimo.document.create",
  patch: "zimo.document.patch",
  convert: "zimo.document.convert",
} as const;

const ALL_DOCUMENT_TOOL_IDS: readonly string[] = Object.freeze([
  DOCUMENT_TOOL_IDS.inspect,
  DOCUMENT_TOOL_IDS.read,
  DOCUMENT_TOOL_IDS.create,
  DOCUMENT_TOOL_IDS.patch,
  DOCUMENT_TOOL_IDS.convert,
]);

export function createDocumentTools(documents: DocumentArtifactService): readonly RegisteredTool[] {
  const forModel = (conversationId: string) => documents.forModel(conversationId);
  return [
    tool(
      DOCUMENT_TOOL_IDS.inspect,
      "检查文档结构",
      "读取附件的格式、结构目录和短预览。",
      true,
      {
        type: "object",
        additionalProperties: false,
        properties: { documentRef: documentReferenceSchema() },
        required: ["documentRef"],
      },
      (value) => ({ documentRef: documentReference(value.documentRef) }),
      (value, context) =>
        forModel(context.workflowId).inspect(string(value.documentRef), context.signal),
    ),
    tool(
      DOCUMENT_TOOL_IDS.read,
      "读取文档片段",
      "按页、幻灯片或工作表读取附件；使用 cursor 分页，禁止猜测未读取内容。",
      true,
      {
        type: "object",
        additionalProperties: false,
        properties: {
          documentRef: documentReferenceSchema(),
          pageNumbers: integerArraySchema(),
          slideNumbers: integerArraySchema(),
          sheetName: { type: "string", minLength: 1, maxLength: 120 },
          cursor: { type: "integer", minimum: 0 },
          maxCharacters: { type: "integer", minimum: 200, maximum: 12000, default: 6000 },
        },
        required: ["documentRef"],
      },
      parseRead,
      (value, context) =>
        forModel(context.workflowId).read(
          string(value.documentRef),
          value.selector as DocumentSelector,
          context.signal,
        ),
    ),
    tool(
      DOCUMENT_TOOL_IDS.create,
      "创建本地文档",
      "在当前任务的受控工作区创建 DOCX、XLSX、PPTX 或 PDF，并作为回复附件返回。",
      false,
      createSchema(),
      parseCreate,
      (value, context) =>
        forModel(context.workflowId).create(
          value.format as DocumentFormat,
          string(value.displayName),
          value.content as DocumentCreateContent,
          context.signal,
        ),
    ),
    tool(
      DOCUMENT_TOOL_IDS.patch,
      "修改本地文档",
      "一次提交当前文档的全部修改并只生成一个最终版本；不要为每处修改分别调用。支持 DOCX 替换/追加、XLSX 单元格写入和 PDF 操作。",
      false,
      documentPatchSchema(),
      parsePatch,
      (value, context) =>
        forModel(context.workflowId).patch(
          string(value.documentRef),
          value.operations as readonly DocumentPatchOperation[],
          context.signal,
        ),
    ),
    tool(
      DOCUMENT_TOOL_IDS.convert,
      "转换本地文档",
      "将附件内容重建为 DOCX、XLSX、PPTX 或 PDF；返回结构转换结果，复杂原格式可能损失。",
      false,
      {
        type: "object",
        additionalProperties: false,
        properties: {
          documentRef: documentReferenceSchema(),
          targetFormat: formatSchema(),
          displayName: { type: "string", minLength: 1, maxLength: 160 },
        },
        required: ["documentRef", "targetFormat", "displayName"],
      },
      (value) => ({
        documentRef: documentReference(value.documentRef),
        targetFormat: format(value.targetFormat),
        displayName: limitedString(value.displayName, 160),
      }),
      (value, context) =>
        forModel(context.workflowId).convert(
          string(value.documentRef),
          value.targetFormat as DocumentFormat,
          string(value.displayName),
          context.signal,
        ),
    ),
  ];
}

export function resolveDocumentToolIds(_text: string, _hasAttachments: boolean): readonly string[] {
  return ALL_DOCUMENT_TOOL_IDS;
}

export function isDocumentFollowup(text: string): boolean {
  return /(文档|附件|文件|DOCX|Word|XLSX|Excel|PPTX|PPT|PDF|继续.{0,4}(调整|修改|优化)|再.{0,4}(调整|修改|优化))/i.test(
    text,
  );
}

function tool(
  id: string,
  title: string,
  description: string,
  readOnly: boolean,
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
        id: readOnly ? "document:read" : "document:write",
        title: readOnly ? "读取当前任务附件" : "在当前任务文档工作区写入新版本",
        description: readOnly
          ? "只能读取当前任务已绑定的文档。"
          : "只能创建新资产或 revision，不覆盖用户原文件。",
        risk: readOnly ? "low" : "medium",
      },
    ],
    inputSchema,
    annotations: { readOnly, destructive: false, idempotent: readOnly, openWorld: false },
    confirmation: "per_run",
    timeoutMs: 30_000,
  };
  return { definition, parse, execute };
}

function parseRead(value: Readonly<Record<string, unknown>>) {
  onlyKeys(value, [
    "documentRef",
    "pageNumbers",
    "slideNumbers",
    "sheetName",
    "cursor",
    "maxCharacters",
  ]);
  const selector: DocumentSelector = {
    ...(value.pageNumbers === undefined
      ? {}
      : { pageNumbers: positiveIntegers(value.pageNumbers) }),
    ...(value.slideNumbers === undefined
      ? {}
      : { slideNumbers: positiveIntegers(value.slideNumbers) }),
    ...(value.sheetName === undefined ? {} : { sheetName: limitedString(value.sheetName, 120) }),
    ...(value.cursor === undefined ? {} : { cursor: integer(value.cursor, 0, 1_000_000) }),
    ...(value.maxCharacters === undefined
      ? {}
      : { maxCharacters: integer(value.maxCharacters, 200, 12_000) }),
  };
  return { documentRef: documentReference(value.documentRef), selector };
}

function parseCreate(value: Readonly<Record<string, unknown>>) {
  onlyKeys(value, ["format", "displayName", "title", "paragraphs", "rows", "slides"]);
  const title = limitedString(value.title, 200);
  const content: DocumentCreateContent = {
    title,
    ...(value.paragraphs === undefined
      ? {}
      : { paragraphs: stringArray(value.paragraphs, 200, 20_000) }),
    ...(value.rows === undefined ? {} : { rows: tableRows(value.rows) }),
    ...(value.slides === undefined ? {} : { slides: slideRows(value.slides) }),
  };
  return {
    format: format(value.format),
    displayName: limitedString(value.displayName, 160),
    content,
  };
}

function parsePatch(value: Readonly<Record<string, unknown>>) {
  onlyKeys(value, ["documentRef", "operations"]);
  if (
    !Array.isArray(value.operations) ||
    value.operations.length < 1 ||
    value.operations.length > 100
  ) {
    throw new Error("Invalid operations");
  }
  return {
    documentRef: documentReference(value.documentRef),
    operations: value.operations.map(parsePatchOperation),
  };
}

function parsePatchOperation(value: unknown): DocumentPatchOperation {
  if (!record(value)) throw new Error("Invalid operation");
  const raw = value;
  const type = raw.type;
  let operation: DocumentPatchOperation;
  if (type === "replace_text") {
    onlyKeys(raw, ["type", "search", "replacement"]);
    operation = {
      type,
      search: limitedString(raw.search, 10_000),
      replacement: limitedString(raw.replacement, 20_000, true),
    };
  } else if (type === "append_text") {
    onlyKeys(raw, ["type", "text"]);
    operation = { type, text: limitedString(raw.text, 40_000) };
  } else if (type === "set_cells") {
    onlyKeys(raw, ["type", "sheetName", "startCell", "rows"]);
    const startCell = limitedString(raw.startCell, 12);
    if (!/^[A-Z]{1,3}[1-9][0-9]{0,6}$/i.test(startCell)) throw new Error("Invalid cell");
    operation = {
      type,
      sheetName: limitedString(raw.sheetName, 120),
      startCell,
      rows: tableRows(raw.rows),
    };
  } else if (type === "watermark") {
    onlyKeys(raw, ["type", "text"]);
    operation = { type, text: limitedString(raw.text, 200) };
  } else if (type === "reorder_pages") {
    onlyKeys(raw, ["type", "pageNumbers"]);
    operation = { type, pageNumbers: positiveIntegers(raw.pageNumbers) };
  } else if (type === "add_page_numbers") {
    onlyKeys(raw, ["type"]);
    operation = { type };
  } else if (type === "fill_form") {
    onlyKeys(raw, ["type", "fields"]);
    if (!record(raw.fields) || Object.keys(raw.fields).length > 100) {
      throw new Error("Invalid fields");
    }
    operation = {
      type,
      fields: Object.fromEntries(
        Object.entries(raw.fields).map(([key, fieldValue]) => [
          limitedString(key, 160),
          limitedString(fieldValue, 10_000, true),
        ]),
      ),
    };
  } else if (type === "overlay_text") {
    onlyKeys(raw, ["type", "pageNumber", "text", "x", "y"]);
    operation = {
      type,
      pageNumber: integer(raw.pageNumber, 1, 100_000),
      text: limitedString(raw.text, 10_000),
      x: finiteNumber(raw.x, -100_000, 100_000),
      y: finiteNumber(raw.y, -100_000, 100_000),
    };
  } else throw new Error("Invalid operation type");
  return operation;
}

function createSchema(): Readonly<Record<string, unknown>> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      format: formatSchema(),
      displayName: { type: "string", minLength: 1, maxLength: 160 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      paragraphs: { type: "array", maxItems: 200, items: { type: "string", maxLength: 20000 } },
      rows: {
        type: "array",
        maxItems: 5000,
        items: { type: "array", maxItems: 200, items: { type: ["string", "number", "boolean"] } },
      },
      slides: {
        type: "array",
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", maxLength: 200 },
            body: { type: "string", maxLength: 20000 },
          },
          required: ["title"],
        },
      },
    },
    required: ["format", "displayName", "title"],
  };
}

function documentReference(value: unknown): string {
  const reference = limitedString(value, 16);
  if (!/^doc_[1-9][0-9]{0,3}$/.test(reference)) throw new Error("Invalid document reference");
  return reference;
}

function documentReferenceSchema() {
  return {
    type: "string",
    pattern: "^doc_[1-9][0-9]{0,3}$",
    description: "当前任务附件上下文中列出的短引用，例如 doc_1。",
  } as const;
}
function formatSchema() {
  return { type: "string", enum: DOCUMENT_EDITABLE_FORMATS } as const;
}
function integerArraySchema() {
  return { type: "array", maxItems: 100, items: { type: "integer", minimum: 1 } } as const;
}
