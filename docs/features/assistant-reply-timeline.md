# 助手回复思考时间与工具步骤

状态：已实现  
日期：2026-09-21

## 目标

助手回复在气泡上方展示本轮墙钟耗时，并列出实际执行过的工具步骤。不展示深度思考/reasoning 正文，也不把 Router、标题生成或 Workflow 节点内部调用画进时间线。

## 耗时

秒数由消息 `createdAt` 与结束时刻相减，不单独落库。进行中按当前时间刷新为 `思考中 {n}s`；完成显示 `已完成 {n}s`；停止或失败显示 `已停止 {n}s`。结束时刻取消息 `updatedAt`。

## 工具步骤

每条工具调用对应一条 `AssistantStep`，以 `toolCallId` 为 id：

- 有 `PlannedAction` 时使用其 `kind`、安全 `summary` 和相对路径；
- 工作目录读/列/搜从已解析参数生成 `读取 notes.md` 这类标题，绝对路径只保留最后一段，不出现 `C:\`；
- 无计划动作的 MCP/其它工具只显示工具标题，`kind` 为 `tool`；
- 运行中显示 `title`；完成后同一记录再显示 `resultTitle`（如 `已读取 notes.md`）；
- 拒绝、失败、取消只更新该条状态，不追加原始参数或工具输出。
- 进行中步骤始终展开；完成、停止或失败后默认折叠，点击耗时标题可展开。
- 思考中且尚无回复正文、附件或资料引用时不渲染空气泡；出现回复内容后再显示气泡。

步骤写入 `messages.steps_json`（`{ schemaVersion: 1, steps }`），不改 `updatedAt`。流式快照事件为 `message.steps.updated`。同一消息最多 100 步。用户停止时，尚未结束的 running 步骤标为 `cancelled`。

## 不包含

- 模型 reasoning /「深度思考」正文（当前能力也不承诺供应商思考链）；
- 工具原始 JSON、输出、绝对路径、完整命令；
- Router 分类、首轮标题、Workflow 节点内部 Tool Loop。

## 验证

- 工作目录读取生成 `读取 {相对路径}` / `已读取 {相对路径}`，Windows 绝对路径只保留文件名；
- `message.steps.updated` 写到对应助手消息；刷新会话时保留已看到的更完整步骤；
- 完成态默认只显示耗时标题，工具行折叠；点击后展开已完成工具行；进行中不显示 `resultTitle`；
- 进行中无正文时不出现空气泡，有正文后才显示回复气泡；
- 停止时 leftover running 步骤变为 cancelled。
