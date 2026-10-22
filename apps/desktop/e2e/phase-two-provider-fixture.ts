import type { IncomingMessage, ServerResponse } from "node:http";
import { LocalDocumentContentAdapter } from "@zimo/knowledge-local/document-content-adapter";

export function createPhaseTwoProviderHandler(
  onGenerationMessages: (messages: Array<{ role?: string; content?: string }>) => void,
) {
  return (request: IncomingMessage, response: ServerResponse) => {
    let body = "";
    request.on("data", (value) => (body += String(value)));
    request.on("end", () => {
      if (request.headers.authorization !== "Bearer sk-phase-two-e2e-canary") {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "unauthorized" } }));
        return;
      }
      const input = JSON.parse(body) as {
        stream?: boolean;
        messages?: Array<{ role?: string; content?: string }>;
        tools?: Array<{ function?: { name?: string; description?: string } }>;
      };
      if (!input.stream) {
        onGenerationMessages(input.messages ?? []);
        response.setHeader("content-type", "application/json");
        const prompt =
          input.messages?.findLast((message) => message.role === "user")?.content ?? "";
        const hasToolResult = input.messages?.some((message) => message.role === "tool");
        const toolResultCount =
          input.messages?.filter((message) => message.role === "tool").length ?? 0;
        const inspectTool = input.tools?.find((item) =>
          item.function?.description?.includes("检查文档结构"),
        )?.function?.name;
        const readTool = input.tools?.find((item) =>
          item.function?.description?.includes("读取文档片段"),
        )?.function?.name;
        const createTool = input.tools?.find((item) =>
          item.function?.description?.includes("创建本地文档"),
        )?.function?.name;
        const patchTool = input.tools?.find((item) =>
          item.function?.description?.includes("修改本地文档"),
        )?.function?.name;
        if (prompt.includes("退款政策") && toolResultCount === 0 && inspectTool) {
          response.end(singleToolCallResponse(inspectTool, { documentRef: "doc_1" }, "inspect"));
          return;
        }
        if (prompt.includes("退款政策") && toolResultCount === 1 && readTool) {
          response.end(
            singleToolCallResponse(
              readTool,
              { documentRef: "doc_1", maxCharacters: 6_000 },
              "read",
            ),
          );
          return;
        }
        if (prompt.includes("创建四个测试文档") && !hasToolResult && createTool) {
          response.end(toolCallResponse(createTool));
          return;
        }
        if (prompt.includes("修改错别字") && toolResultCount === 0 && inspectTool) {
          response.end(singleToolCallResponse(inspectTool, { documentRef: "doc_1" }, "inspect"));
          return;
        }
        if (prompt.includes("修改错别字") && toolResultCount === 1 && readTool) {
          response.end(singleToolCallResponse(readTool, { documentRef: "doc_1" }, "read"));
          return;
        }
        if (prompt.includes("修改错别字") && toolResultCount === 2 && patchTool) {
          response.end(
            singleToolCallResponse(
              patchTool,
              {
                documentRef: "doc_1",
                operations: [
                  {
                    type: "replace_text",
                    search: "OpenClaw 技术共亠文档",
                    replacement: "OpenClaw 技术分享文档",
                  },
                  { type: "replace_text", search: "模型推理屁", replacement: "模型推理层" },
                ],
              },
              "patch",
            ),
          );
          return;
        }
        if (prompt.includes("slow")) {
          const timer = setTimeout(() => response.end(basicCompletionResponse()), 5_000);
          response.once("close", () => clearTimeout(timer));
          return;
        }
        response.end(basicCompletionResponse());
        return;
      }
      const titleRequest = input.messages?.some((message) =>
        message.content?.startsWith("ZIMO_TASK_TITLE:"),
      );
      const compactionRequest = input.messages?.some((message) =>
        message.content?.includes("你正在执行一次上下文检查点压缩"),
      );
      if (!titleRequest) onGenerationMessages(input.messages ?? []);
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (titleRequest) {
        response.write(streamChunk("退款政策咨询"));
        response.end("data: [DONE]\n\n");
        return;
      }
      if (compactionRequest) {
        response.write(
          streamChunk("## 当前任务\n继续测试\n## 本会话仍有效的用户要求\n- 继续使用简体中文回复"),
        );
        response.end("data: [DONE]\n\n");
        return;
      }
      const prompt =
        [...(input.messages ?? [])].reverse().find((message) => message.role === "user")?.content ??
        "";
      const toolResultCount =
        input.messages?.filter((message) => message.role === "tool").length ?? 0;
      const inspectTool = findTool(input.tools, "检查文档结构");
      const readTool = findTool(input.tools, "读取文档片段");
      const createTool = findTool(input.tools, "创建本地文档");
      const patchTool = findTool(input.tools, "修改本地文档");
      const memoryTool = findTool(input.tools, "保存用户记忆");
      if (prompt.includes("记住我叫大力") && toolResultCount === 0 && memoryTool) {
        endStreamWithToolCalls(response, [
          toolCall(
            memoryTool,
            { kind: "preference", content: "请称呼我为大力" },
            "memory-save-call",
          ),
        ]);
        return;
      }
      if (prompt.includes("退款政策") && toolResultCount === 0 && inspectTool) {
        endStreamWithToolCalls(response, [
          toolCall(inspectTool, { documentRef: "doc_1" }, "document-inspect-call"),
        ]);
        return;
      }
      if (prompt.includes("退款政策") && toolResultCount === 1 && readTool) {
        endStreamWithToolCalls(response, [
          toolCall(readTool, { documentRef: "doc_1", maxCharacters: 6_000 }, "document-read-call"),
        ]);
        return;
      }
      if (prompt.includes("创建四个测试文档") && toolResultCount === 0 && createTool) {
        endStreamWithToolCalls(
          response,
          createDocumentInputs().map((value, index) =>
            toolCall(createTool, value, `document-call-${index}`),
          ),
        );
        return;
      }
      if (prompt.includes("修改错别字") && toolResultCount === 0 && inspectTool) {
        endStreamWithToolCalls(response, [
          toolCall(inspectTool, { documentRef: "doc_1" }, "document-inspect-call"),
        ]);
        return;
      }
      if (prompt.includes("修改错别字") && toolResultCount === 1 && readTool) {
        endStreamWithToolCalls(response, [
          toolCall(readTool, { documentRef: "doc_1" }, "document-read-call"),
        ]);
        return;
      }
      if (prompt.includes("修改错别字") && toolResultCount === 2 && patchTool) {
        endStreamWithToolCalls(response, [
          toolCall(
            patchTool,
            {
              documentRef: "doc_1",
              operations: [
                {
                  type: "replace_text",
                  search: "OpenClaw 技术共亠文档",
                  replacement: "OpenClaw 技术分享文档",
                },
                { type: "replace_text", search: "模型推理屁", replacement: "模型推理层" },
              ],
            },
            "document-patch-call",
          ),
        ]);
        return;
      }
      if (prompt.includes("slow")) {
        response.flushHeaders();
        response.write(streamChunk("开始"));
        const timer = setTimeout(() => {
          response.write(streamChunk("结束"));
          response.end("data: [DONE]\n\n");
        }, 5_000);
        response.once("close", () => clearTimeout(timer));
        return;
      }
      response.write(streamChunk("你好，"));
      response.write(streamChunk("**Zimo**"));
      response.end("data: [DONE]\n\n");
    });
  };
}

function basicCompletionResponse(): string {
  return JSON.stringify({
    id: "chatcmpl-e2e",
    object: "chat.completion",
    created: 1,
    model: "fake-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "你好，**Zimo**" },
        finish_reason: "stop",
      },
    ],
  });
}

function singleToolCallResponse(
  name: string,
  argumentsValue: Readonly<Record<string, unknown>>,
  id: string,
): string {
  return JSON.stringify({
    id: `chatcmpl-document-${id}`,
    object: "chat.completion",
    created: 1,
    model: "fake-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: `document-${id}-call`,
              type: "function",
              function: { name, arguments: JSON.stringify(argumentsValue) },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

function toolCallResponse(name: string): string {
  const values = createDocumentInputs();
  return JSON.stringify({
    id: "chatcmpl-document-tools",
    object: "chat.completion",
    created: 1,
    model: "fake-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: values.map((value, index) => ({
            id: `document-call-${index}`,
            type: "function",
            function: { name, arguments: JSON.stringify(value) },
          })),
        },
        finish_reason: "tool_calls",
      },
    ],
  });
}

function createDocumentInputs(): Readonly<Record<string, unknown>>[] {
  return [
    {
      format: "docx",
      displayName: "测试报告.docx",
      title: "测试报告",
      paragraphs: ["中文 DOCX 内容"],
    },
    {
      format: "xlsx",
      displayName: "测试数据.xlsx",
      title: "数据",
      rows: [
        ["项目", "金额"],
        ["研发", 100],
      ],
    },
    {
      format: "pptx",
      displayName: "测试演示.pptx",
      title: "测试演示",
      slides: [{ title: "首页", body: "中文演示内容" }],
    },
    {
      format: "pdf",
      displayName: "测试文档.pdf",
      title: "中文 PDF",
      paragraphs: ["由 Chromium 生成的中文内容"],
    },
  ];
}

export async function minimalDocx(): Promise<Buffer> {
  const bytes = await new LocalDocumentContentAdapter().create(
    "docx",
    { title: "会议材料", paragraphs: ["附件中的季度会议安排与改进建议。"] },
    new AbortController().signal,
  );
  return Buffer.from(bytes);
}

export async function typoDocx(): Promise<Buffer> {
  const bytes = await new LocalDocumentContentAdapter().create(
    "docx",
    { title: "OpenClaw 技术共亠文档", paragraphs: ["模型推理屁"] },
    new AbortController().signal,
  );
  return Buffer.from(bytes);
}

function streamChunk(content: string): string {
  return `data: ${JSON.stringify({
    id: "chatcmpl-e2e",
    object: "chat.completion.chunk",
    created: 1,
    model: "fake-model",
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  })}\n\n`;
}

function findTool(
  tools: Array<{ function?: { name?: string; description?: string } }> | undefined,
  description: string,
): string | undefined {
  return tools?.find((item) => item.function?.description?.includes(description))?.function?.name;
}

function toolCall(
  name: string,
  argumentsValue: Readonly<Record<string, unknown>>,
  id: string,
): Readonly<{ id: string; name: string; argumentsValue: Readonly<Record<string, unknown>> }> {
  return { id, name, argumentsValue };
}

function endStreamWithToolCalls(
  response: ServerResponse,
  calls: readonly ReturnType<typeof toolCall>[],
): void {
  response.write(
    `data: ${JSON.stringify({
      id: "chatcmpl-e2e-tools",
      object: "chat.completion.chunk",
      created: 1,
      model: "fake-model",
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: calls.map((call, index) => ({
              index,
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: JSON.stringify(call.argumentsValue) },
            })),
          },
          finish_reason: null,
        },
      ],
    })}\n\n`,
  );
  response.write(
    `data: ${JSON.stringify({
      id: "chatcmpl-e2e-tools",
      object: "chat.completion.chunk",
      created: 1,
      model: "fake-model",
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
    })}\n\n`,
  );
  response.end("data: [DONE]\n\n");
}
