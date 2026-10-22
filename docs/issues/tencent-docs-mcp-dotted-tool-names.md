# 腾讯文档 MCP 点号工具名被拒绝

- 状态：已修复
- 日期：2026-09-14
- 影响范围：公网 HTTPS MCP `tools/list` 发现、腾讯文档连接测试与保存

## 现象与影响

用户使用固定目录中的腾讯文档 endpoint 和 Token 测试连接时，界面提示“`MCP 服务返回的数据无法安全处理。`”。连接无法保存，腾讯文档能力也无法绑定到会话、Agent 或 Workflow。

## 证据与根因

腾讯文档使用 `doc.ai_format_pure_text`、`smartcanvas.*`、`smartsheet.*` 等带点号的命名空间工具名。MCP 工具命名规范允许 ASCII 字母、数字、下划线、连字符和点号，长度为 1–128 字符。

Zimo 的 Gateway 与 Application Registry 原先都使用 `^[A-Za-z0-9_-]{1,128}$`，在 `tools/list` 成功后把带点号的合法名称误判为无效响应，并统一映射为 `MCP_RESPONSE_INVALID`。原有诊断只覆盖 `tools/call` 返回体，没有记录发现阶段具体拒绝原因。

## 修复

- 在 Domain 统一 MCP 工具名规则为 `^[A-Za-z0-9._-]{1,128}$`，Gateway 与 Registry 复用同一判定；
- 保留模型侧的安全别名映射，远端原始工具名只用于受控 Registry 和标准 `tools/call`；
- 提取发现响应归一化模块，为工具数量、名称、Schema 和完整目录体积保留既有上限；
- 增加 `mcp.discovery.response.rejected` 安全日志，只记录固定原因、工具序号、观测长度和上限，不记录工具正文、Schema、Token 或响应体。

## 回归覆盖

- Gateway 接受 `doc.ai_format_pure_text` 与 `smartcanvas.list_blocks`；
- Application Registry 能保存带点号的工具快照；
- 非法工具名仍被拒绝，并产生不含远端正文的发现诊断；
- 既有 Schema 字符上限和 Tool 返回体归一化测试继续保留。

## 剩余风险

腾讯文档真实工具目录仍可能触发单 Tool Schema 50000 字符、单 Server 500 个 Tool或完整目录 1900000 字符上限。此类拒绝现在会在普通日志中给出固定原因和大小元数据；真实 Token 连接仍需人工复测。
