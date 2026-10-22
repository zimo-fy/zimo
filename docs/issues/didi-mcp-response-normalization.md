# 滴滴 MCP 价格预估响应无法归一化

- 状态：已修复，等待真实服务复测
- 日期：2026-09-11

## 症状与影响

滴滴 MCP 可以完成连接、`tools/list` 和 `maps_textsearch`，但模型调用 `taxi_estimate` 后，会话以 `MCP_RESPONSE_INVALID` 失败并提示“MCP 服务返回的数据无法安全处理”。用户无法获得车型和价格预估，也不能继续后续受控确认流程。

## 已确认的证据

- 连接测试发现 13 个工具，说明 endpoint、Query `key` 和工具发现链路正常；
- 同一轮两次 `maps_textsearch` 均成功；
- `taxi_estimate` 的六个坐标和地点参数均按服务要求以字符串发送；
- 失败发生在 `tools/call` 返回之后、本地 `structuredContent/content` 安全归一化阶段；
- 普通日志此前只记录统一错误码，无法区分深度、集合规模、文本长度、总输出大小或内容类型。

## 根因

真实复测记录到 `reason=array_too_large`、`source=structured_content`、`observed=2626`、`limit=500`。滴滴 `taxi_estimate` 返回的结构化结果包含 2626 项数组，整体仍可作为有界 JSON 处理，但被通用 MCP 归一化器的单数组数量限制拒绝。

## 修复

MCP Tool 返回体归一化职责已提取到独立模块。按当前产品决策，Tool 结果移除 12 层嵌套和数组/对象 500 项限制，只保留 JSON 序列化结果 90000 字符总上限。归一化改为序列化后解析并使用迭代式 JSON 类型检查，避免应用层递归遍历；非文本内容块和无法表示为 JSON 的值仍被拒绝。

真实复测进一步确认完整 `structuredContent` 为 118542 字符。Zimo 因此在 Main Gateway 增加 `taxi_estimate` 专用投影，只保留滴滴官方流程要求的 `traceId`、车型名称、车型分类标识和价格。若必要字段缺失则使用服务端文本通道，避免将大规模内部明细传入模型；其他 MCP Tool 不受影响。

安全校验拒绝响应时，`mcp.tool.response.rejected` 普通日志事件只记录：

- 可信 `serverId` 和已发现的 `toolName`；
- 固定枚举 `reason`；
- 响应来源是 `structured_content` 还是 `content`；
- 是否存在结构化结果、内容块数量及内容块类型；
- 触发限制的总字符数/类型和对应 `limit`。

事件不记录响应字段名、字段值、车型、价格、地址、订单号、`traceId`、内容正文、凭据或带 Query 的 URL。诊断回调自身失败不会改变原工具调用的终态。

## 回归覆盖

- 2626 项结构化数组在总字符数未超限时可以正常通过；
- 超过 12 层的结构化 JSON 在总字符数未超限时可以正常通过；
- 超长结果统一记录 `output_too_large`，并包含 Server/Tool 关联信息；
- 非文本内容块记录 `content_type_unsupported`，断言块数据不进入诊断。
- 滴滴价格预估会删除 2626 项内部明细并保留后续下单所需字段；结构不符合官方契约时降级文本通道；

## 剩余工作

使用真实滴滴 `taxi_estimate` 再执行一次，确认精简结果可进入后续模型轮次并保留 `traceId` 与车型标识。另需独立处理“顺风车”并非当前公开网约车 Tool 能力的问题。
