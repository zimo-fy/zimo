# 模型工具调用能力始终被禁用

> 历史问题：自 2026-09-09 登录托管模型上线后，`deepseek-v4-flash` 固定启用 Tool Calling，设置页不再提供能力编辑入口。以下内容保留为旧版修复记录。

状态：已修复  
日期：2026-09-08

## 症状与影响

用户已重新安装并绑定脚本型 Skill，但发送消息时收到“所选模型未启用 Tool Calling 能力”。同一问题也会阻止 MCP Tool 和 Workflow Agent Tool Calling。

## 证据与根因

模型的 SQLite 能力字段会被运行时正确读取，Conversation/Workflow 也按 `model.capabilities.toolCalling` 做执行前检查。问题位于 Renderer 模型设置表单：保存 payload 把 `toolCalling` 固定写成 `false`，且页面没有对应配置项。于是所有通过该页面新增的模型都被标记为不支持；编辑模型还会把其他已有能力一起重置为 `false`。

## 修复

- 模型表单增加“启用工具调用”复选项，新模型默认开启；
- 编辑已有模型时显示并保留数据库中的当前值；
- 保存时只更新用户选择的 Tool Calling 状态，并保留 vision、reasoning、structured output、prompt caching 和上下文上限等已有声明；
- 模型卡显示“工具调用：已启用/未启用”；
- Conversation 和 Workflow 的错误文案直接引导到模型设置。

没有删除运行前能力校验，也不会对明确关闭或实际不支持 Tools / Function Calling 的端点强行发送工具请求。

## 回归覆盖

纯函数测试覆盖新模型默认开启，以及编辑时保留其他能力。既有 LangChain Adapter 集成测试继续覆盖工具定义发送和 Tool Call 响应映射。

## 用户迁移

修复前已经保存的模型仍保留 `toolCalling=false`，避免在未确认接口兼容性的情况下静默扩权。用户需要在“设置 → 模型提供商 → 编辑”中开启一次“工具调用”。如果厂商端点不支持标准 OpenAI-compatible Tools / Function Calling，调用时仍会返回厂商兼容性错误。
