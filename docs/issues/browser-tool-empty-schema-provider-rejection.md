# 浏览器 Tool 空参数 Schema 导致模型请求被拒绝

## 现象与影响

普通会话可以正常调用模型；为会话启用浏览器能力后，同样的模型配置立即失败并显示“模型服务返回错误，请检查地址和模型名称”。浏览器窗口不会启动，模型也不会返回 Tool Call。

## 证据

- 失败运行已持久化 `browser_enabled=1`。
- 普通日志在 `operation=tool_initial` 阶段记录 HTTP `400`、`invalid_request_error`，耗时约 200ms。
- 同一模型、Provider 和普通 Tool 会话可以成功；失败发生在 CDP Adapter、Tool 执行和审计之前。
- 七个新增浏览器定义中，只有无参数的 `zimo.browser.tabs` 使用 `{}` 作为 `inputSchema`；其余均为完整 object JSON Schema。

## 根因

OpenAI-compatible function calling 要求函数 `parameters` 是合法的 object JSON Schema。空对象 `{}` 虽能通过 Zimo 内部宽泛类型，却缺少 `type`、`properties` 和对象边界。当前中转网关严格校验整个 `tools` 数组，因此一个非法定义会让首轮请求整体返回 400。

## 修复

`browser_tabs` 改用严格的无参数 Schema：

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {},
  "required": []
}
```

不改变浏览器权限、审批、参数或执行行为。

## 回归覆盖

- 浏览器 Tool 注册测试断言全部七个 Tool 的根 Schema 均为 object、拒绝未知字段且具有 `properties`。
- Model Tool Loop 测试继续断言七个稳定 `browser_*` 函数名。

## 剩余风险

当前敏感 payload 捕获只在模型流返回后写入 `conversation_tool_round`；Provider 在请求建立阶段拒绝时不会生成该条 round 记录，只能通过普通日志中的安全 HTTP 状态和错误码诊断。后续可将发送前 Tool 摘要独立记录，但不得记录密钥或用户正文。
