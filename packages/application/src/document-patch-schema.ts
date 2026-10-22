export function documentPatchSchema(): Readonly<Record<string, unknown>> {
  const operationSchema = {
    type: "object",
    additionalProperties: false,
    description: "单个修改操作；同一文档本轮的全部修改必须放入 operations 数组。",
    properties: {
      type: {
        type: "string",
        enum: [
          "replace_text",
          "append_text",
          "set_cells",
          "watermark",
          "reorder_pages",
          "add_page_numbers",
          "fill_form",
          "overlay_text",
        ],
        description: "修改操作类型。",
      },
      search: {
        type: "string",
        minLength: 1,
        maxLength: 10_000,
        description: "replace_text 必填：需要精确查找的原文。",
      },
      replacement: {
        type: "string",
        maxLength: 20_000,
        description: "replace_text 必填：替换后的文字；允许为空字符串。",
      },
      text: {
        type: "string",
        maxLength: 40_000,
        description: "append_text、watermark 或 overlay_text 使用的文本。",
      },
      sheetName: {
        type: "string",
        minLength: 1,
        maxLength: 120,
        description: "set_cells 必填：工作表名称。",
      },
      startCell: {
        type: "string",
        pattern: "^[A-Za-z]{1,3}[1-9][0-9]{0,6}$",
        description: "set_cells 必填：写入区域左上角单元格，例如 A1。",
      },
      rows: {
        type: "array",
        maxItems: 5_000,
        description: "set_cells 必填：从 startCell 开始写入的二维数据。",
        items: {
          type: "array",
          maxItems: 200,
          items: { type: ["string", "number", "boolean"] },
        },
      },
      pageNumbers: {
        type: "array",
        maxItems: 100,
        description: "reorder_pages 必填：按目标顺序提供从 1 开始的页码。",
        items: { type: "integer", minimum: 1 },
      },
      fields: {
        type: "object",
        maxProperties: 100,
        description: "fill_form 必填：PDF 表单字段名到字符串值的映射。",
        additionalProperties: { type: "string", maxLength: 10_000 },
      },
      pageNumber: {
        type: "integer",
        minimum: 1,
        maximum: 100_000,
        description: "overlay_text 必填：从 1 开始的目标页码。",
      },
      x: {
        type: "number",
        minimum: -100_000,
        maximum: 100_000,
        description: "overlay_text 必填：文本横坐标。",
      },
      y: {
        type: "number",
        minimum: -100_000,
        maximum: 100_000,
        description: "overlay_text 必填：文本纵坐标。",
      },
    },
    required: ["type"],
  } as const;
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      documentRef: {
        type: "string",
        pattern: "^doc_[1-9][0-9]{0,3}$",
        description: "当前任务附件上下文中列出的短引用，例如 doc_1。",
      },
      operations: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        description:
          "一次提交该文档需要执行的全部修改；系统按顺序应用并且只生成一个最终版本。不要为每个错别字分别调用工具，也不要使用 find/replace 字段。",
        items: operationSchema,
      },
    },
    required: ["documentRef", "operations"],
  };
}
