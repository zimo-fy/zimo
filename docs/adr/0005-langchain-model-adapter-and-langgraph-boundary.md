# ADR-0005：LangChain Model Adapter 与 LangGraph 边界

- 状态：Accepted
- 日期：2026-09-02

## 背景

产品要求使用 LangChainJS，并为未来 LangGraphJS 状态化 Agent/Workflow 留出空间；同时产品模型和 IPC 不能绑定框架或厂商事件。

## 决策

Phase 2 使用 LangChainJS 实现 `ModelGateway` 的 OpenAI-compatible Adapter。Adapter 把 LangChain chunks 转为内部 `ModelStreamEvent`，Application 再产生稳定 `AgentStreamEvent`。Provider capabilities 显式保存/探测，不从名称假设。

LangGraphJS 在 V0.1 不进入聊天主链，也不用于 Phase 3 的 Workflow 原型。未来真实 Agent/Workflow 运行时通过独立 `AgentRuntime` / `WorkflowRuntime` 端口接入；图状态不能直接成为产品数据库模型。

## 依据

LangChain 提供模型流式迭代和 Zod 结构化输出；这些是 Adapter 实现能力，不是跨层契约。

- [LangChain models](https://docs.langchain.com/oss/javascript/langchain/models)
- [LangChain streaming](https://docs.langchain.com/oss/javascript/langchain/streaming)

## 结果

可以使用 LangChain 的 provider 生态并隔离升级影响。需要针对不同 OpenAI-compatible 服务建立 contract fixtures；不能声称所有兼容端点都支持 tools、usage 或 structured output。

## Phase 2 验证结果

实现使用 `@langchain/openai` `1.5.11` 与 `@langchain/core` `1.2.9`。`ChatOpenAI` 仅存在于 `@zimo/model-langchain` Adapter，使用自定义 `configuration.baseURL`，并将 `AIMessageChunk` 转为产品自有的 text/usage/completed 事件。

为兼容不支持 `stream_options` 的第三方端点，V0.1 设置 `streamUsage:false`；usage 为可选最终一致数据，不做伪造。fake OpenAI-compatible HTTP/SSE contract、鉴权错误映射、AbortSignal 取消和完整 Electron 对话路径均已验证。LangGraph 仍未进入运行时。

## 2026-09-20 Tool Calling 流式增量

Tool Calling 与普通回复统一使用流式模型端口。Adapter 通过 LangChain `bindTools(...).stream()` 接收 `AIMessageChunk`：文本立即映射为内部增量，Tool Call chunk 在 Adapter 内按 LangChain 语义合并，完整参数形成产品 `ModelGatewayToolCall` 后才允许 Application 执行。非流式 `invokeWithTools` 已移除，也不提供运行时 fallback。

该决策降低默认 Workspace 导致的首字等待，并保持 Domain/Application 不依赖 LangChain 类型。代价是 OpenAI-compatible Provider 必须正确实现 SSE Tool Calling；真实托管服务需作为发布 smoke，非法或不完整 Tool Call 失败关闭。
