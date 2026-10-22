# MCP 传输失败缺少安全诊断

- 状态：已修复
- 日期：2026-09-14
- 影响范围：公网 HTTPS MCP 的连接、工具发现和工具调用

## 现象与影响

MCP 连接测试可以成功，但会话内连续执行工具时偶发提示“无法连接 MCP 服务”。普通日志只有统一的 `MCP_CONNECTION_FAILED`，无法判断失败发生在连接、`tools/list` 还是 `tools/call`，也无法区分 HTTP 限流、服务端错误或网络重置。

腾讯文档 PPT 创建流程提供了复现证据：`create_slide` 成功，多个 `slide_progress` 返回 `in_progress`，随后某次进度查询失败；失败后重新刷新工具快照仍成功。这证明基础地址和凭据可用，但原有日志不足以确认单次传输失败的底层类别。

## 根因

Streamable HTTP Gateway 将未分类的 MCP SDK、HTTP 和网络异常统一映射为 `MCP_CONNECTION_FAILED`。这是正确的用户侧脱敏行为，但缺少只记录安全元数据的内部诊断事件。

## 修复

- 新增 `mcp.transport.request.failed`，区分 `connect`、`tools_list` 和 `tools_call`；
- 仅记录可信 Server ID、Tool 名称、阶段耗时、受限错误类型/错误码和 HTTP 状态码；
- 不记录异常消息、堆栈、cause、endpoint、query、Header、Token、Tool 参数、状态文本或响应正文；
- 用户取消不记录为传输失败，日志回调失败不改变原始错误。

## 回归覆盖

- 模拟 `tools/call` 返回 HTTP 429，断言日志包含阶段和状态码；
- 模拟 `tools/list` 网络重置，断言日志阶段为 `tools_list`；
- 使用 canary 验证异常正文、凭据、参数和 HTTP 状态文本不进入诊断。

## 剩余风险

该诊断只能识别 SDK 提供的错误类型、错误码和 HTTP 状态，不能记录或分析远端响应正文。若厂商以 HTTP 200 返回自定义业务错误，需要通过经过安全归一化的 MCP Tool 结果另行处理。
