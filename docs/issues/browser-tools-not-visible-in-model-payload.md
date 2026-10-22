# 浏览器工具未出现在模型请求

## 现象与影响

用户发送需要浏览器操作的指令后，在开发态 `llm-payloads.jsonl` 中没有看到浏览器 Tool。模型因此只能按普通对话回答，无法启动或操作 Zimo 独立浏览器。

## 证据与根因

- 受影响运行的 `conversation_response` 与 `conversation_tool_round` 使用同一 `runId`；前者按现有日志协议不包含 Tool Schema，后者才是实际 `bindTools()` 请求。
- 对应会话在 SQLite 中保存的 `browser_enabled` 为 `0`，因此 Application 按显式会话能力边界没有把七个浏览器 Tool 加入本轮 `toolIds`。
- 另有可观测性缺陷：通用别名生成器会把 `zimo.browser.tabs` 等内建 Tool 命名为 `mcp_N_tabs`，即使启用后也难以从 payload 判断其来源。

根因不是模型忽略 Tool，也不是 CDP Adapter 未注册。浏览器能力首版要求用户先在当前会话的“+”菜单中启用；自然语言指令不会自动扩权。

## 修复

- 保持显式会话绑定，不增加关键词匹配或自动授权。
- 七个内建浏览器 Tool 改用稳定模型函数名：`browser_tabs`、`browser_focus`、`browser_snapshot`、`browser_screenshot`、`browser_navigate`、`browser_click`、`browser_type`。
- 开发诊断说明明确：先按 `conversationId + runId` 找 `conversation_tool_round`，再检查其中的 `request.tools`。

## 回归覆盖

- Model Tool Loop 单测断言七个浏览器 ID 全部映射成稳定的 `browser_*` 名称。
- 既有浏览器 Tool 测试继续验证严格 Schema 和无动作审批规划器。

## 剩余风险

- 当前会话未显式启用浏览器时，模型仍不会获得浏览器工具；这是产品权限边界，不是故障。
- 第一条 `conversation_response` 仍不复制 Tool Schema，避免同一运行重复记录大体积 Schema；诊断必须查看 `conversation_tool_round`。
