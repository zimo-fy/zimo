# 流式 Tool Calling

## 目标

会话只要拥有 Workspace、文档、Skill 或 MCP Tool，就会进入模型 Tool Loop。该链路必须与普通文本会话一样按 chunk 返回内容；气泡上方的 `思考中 {n}s` 在首个文本 chunk 到达后继续保留，正文不再用“正在思考…”占位。

## 实现边界

- `ModelGateway.streamWithTools()` 是 Tool Calling 的唯一模型端口，不保留非流式 fallback；
- LangChain Adapter 使用 `bindTools(...).stream()`，把 `AIMessageChunk` 映射为产品自有的 `text`、`usage`、`tool_calls` 和 `completed` 事件；
- 文本 chunk 立即进入会话 `message.delta`，沿用 250ms/4KB 持久化和取消逻辑；
- `tool_call_chunks` 只在 Adapter 内聚合。流结束且 JSON 参数完整后，才形成稳定 Tool Call 并进入 Schema、权限、审批、超时和审计链路；
- Tool 执行结果作为 `ToolMessage` 加入下一轮上下文，下一轮仍使用相同流式协议；
- Workflow Agent 使用同一 Tool Loop，但节点内部聚合文本后再作为节点输出，不把框架 chunk 暴露给 Renderer。

## 失败行为

- Provider 不支持流式 Tool Calling、断流或返回非法参数时，本轮失败，不静默切换到非流式请求；
- LangChain 报告 `invalid_tool_calls` 时返回 `MODEL_TOOL_CALL_INVALID`，工具不会执行；
- 取消复用当前 `AbortSignal`，已收到的文本按既有部分回答规则保留；
- Provider 的响应正文、Tool 参数和输出不进入普通日志。

## 兼容性

OpenAI-compatible Endpoint 必须在 SSE 中正确返回 `delta.tool_calls`。只接受 `stream: true`、但在末尾一次性吐出完整内容的服务不会破坏正确性，不过首字延迟仍取决于服务端。自动测试使用本地假 SSE 服务覆盖文本 chunk 和跨 chunk 的 Tool JSON 参数；真实托管 Endpoint 仍需人工 smoke。

## 验收

1. 新建任务只发送“你好”，回复首个文本 chunk 到达后立即出现在气泡正文，思考耗时标题保持更新；
2. 触发 Workspace/MCP Tool，工具调用前说明、工具执行和最终回答保持顺序；
3. 工具参数拆成多个 SSE chunk 时只执行一次，参数完整且通过 Schema；
4. 运行中停止后不再执行尚未完成的 Tool Call；
5. 开发态 `llm-payloads.jsonl` 的 Tool Round 标记 `request.stream: true`。
