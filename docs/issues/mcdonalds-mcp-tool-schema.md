# 麦当劳 MCP 工具目录无法安全处理

- 状态：已修复，等待真实服务复测
- 日期：2026-09-11

## 症状与影响

用户按麦当劳中国官方文档填写 MCP Token 后，连接测试提示“MCP 服务返回的数据无法安全处理”，无法保存工具目录。

## 证据与根因

- 官方服务使用 `https://mcp.mcd.cn`、Streamable HTTP 和 `Authorization: Bearer <MCP Token>`；Zimo 目录与 Header 注入均与该要求一致；
- 失败消息来自 `tools/list` 本地工具 Schema 归一化，而不是凭据拒绝路径；
- `tools/call` 返回体此前已经取消深度和集合数量限制，但 `tools/list` 仍保留最大 12 层、单数组或对象最大 500 项，导致复杂官方 JSON Schema 存在兼容性缺口；
- 旧发现路径没有记录具体 Tool 或触发维度，因此无法从现有普通日志恢复是哪一个麦当劳 Tool 首先越界。

## 修复

所有 MCP Server 的工具参数 Schema 取消 12 层深度和单数组/对象 500 项限制。归一化改为有界 JSON 序列化后解析，不再递归复制 Schema。仍保留单 Tool Schema 50000 字符、单 Server 500 个 Tool 和完整快照 1900000 字符上限。

凭据、Schema 正文及用户数据不会写入普通日志；公网 HTTPS、固定目录认证、超时和 Tool 调用结果限制不变。

## 回归覆盖

- 超过 12 层但总大小合规的 Tool Schema 可以发现；
- 包含 501 个属性但总大小合规的 Tool Schema 可以发现；
- 超过 50000 字符的单 Tool Schema 继续被拒绝；
- 既有完整工具发现、Header 注入和 Tool 调用归一化测试继续通过。

## 剩余工作

使用真实麦当劳 MCP Token 重新执行“测试连接 → 保存”，确认官方完整工具目录可以落入 Registry。若仍失败，需要为工具发现增加不含 Schema 正文的拒绝原因诊断。
