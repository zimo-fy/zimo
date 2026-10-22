# 模型供应商失败诊断缺失

## 症状与影响

文档 Tool 首轮调用成功后，会话约 60 秒后显示“模型服务返回错误，请检查地址和模型名称”。普通日志只有 `conversation.run.failed` 和 `outcome=failure`，无法区分地址/模型配置、HTTP 4xx/5xx、上游网关超时或网络异常。

## 证据与复现

- 真实 Run `d9e3a010-12e4-455c-b574-da9b6ee8a123` 在 `zimo.document.inspect` 17ms 成功后约 60.2 秒失败；
- 开发态 payload 显示 Tool 首轮成功返回 `mcp_0_inspect`，失败发生在包含 Tool 结果的后续模型请求；
- 同一路径此前至少两次呈现接近 60 秒的相同失败；
- Zimo 模型请求超时已设为 360 秒，因此现有证据更符合上游返回错误，但旧日志未保存 HTTP 状态，不能继续严格归因。

## 根因

LangChain Adapter 已把第三方错误映射为带安全 `status` 的 `AppError`，但映射前没有诊断出口；Application 发出的 `run.failed` 只包含稳定错误码与用户文案，Main 的终态日志又只记录运行 ID 和 outcome。底层请求阶段、耗时和 HTTP 状态因此在普通日志边界丢失。

## 修复

`LangChainOpenAICompatibleGateway` 增加可选失败诊断回调，并在以下请求边界调用：

- `connection_test`：模型连接测试；
- `stream`：无 Tool 的流式回答；
- `classify`：意图分类；
- `tool_initial`：首次携带 Tool 定义的模型请求；
- `tool_followup`：携带 Tool message 的后续模型请求。

Main 将诊断写为 `model.provider.request.failed`，字段仅包含固定阶段、耗时、HTTP 状态及经过字符白名单限制的错误名称/错误码。诊断异常被隔离，不得覆盖原始模型错误。

## 回归覆盖

Adapter 集成测试使用本地 OpenAI-compatible 服务返回带敏感正文的 HTTP 504，验证：

- AppError 仍映射为 `MODEL_PROVIDER_ERROR`；
- 诊断标识为 `tool_followup` 并包含 `status=504`；
- 诊断序列化结果不包含 API Key、用户正文、Tool 输出或供应商响应正文中的 canary。

## 剩余风险

该日志用于定位错误，不改变上游超时或重试策略。真实环境重新触发后才能确认当前服务实际返回的状态码；若状态为空，则继续按网络/TLS/连接终止方向检查。

## 2026-10-08 补充：无 HTTP 状态的 Tool 后续轮失败

Boss 直聘浏览器任务最新一轮在浏览器导航和两次等待成功后，`tool_followup` 于 1668ms 内报 `Error`，无 HTTP 状态和代码；之前多轮模型请求成功，原日志无法区分连接重置、DNS/TLS、网关断流或请求体积因素。此次仅增强安全诊断，不改变错误映射或重试：固定枚举传输原因、最多三层白名单 cause 名称/代码，以及失败轮应用层请求规模。普通日志仍不记录原始错误消息、URL、消息/工具正文或凭据；实际原因需用户重试后按新事件判断。
