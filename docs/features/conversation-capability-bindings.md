# 会话能力绑定

## 用户行为

聊天输入框下方的“+”菜单允许直接配置当前会话的能力：

- Agent：最多一个；
- Skill：可多选，只展示已安装、已启用且包含有效 instruction 的 Skill；
- 知识库：当前界面选择一个，存储契约最多五个；
- Workflow：最多一个；
- MCP Server：可从当前已连接 Server 中多选；选择一个 Server 即授权其当前工具快照。

选择即代表当前会话授权，保存期间菜单暂时禁用。所有选择写入 SQLite，切换会话或重启应用后恢复。Agent 自带的 Skill 会标记为“随 Agent”，不能在会话菜单中单独取消；运行时将 Agent Skill 与会话直接 Skill 去重合并。

## 执行语义

没有 Workflow 时，会话按以下方式组装请求：

1. 解析 Agent 及其 Skill、会话直接 Skill和知识库；
2. 将 instruction Skill 编译为 System Prompt；
3. 仅把 Agent 和会话所授权 Server 的当前工具快照暴露给模型，由模型按名称、说明和参数 Schema 选择具体 Tool；
4. 模型返回工具调用后，由 Application 校验本轮暴露集合、参数、超时与取消，再通过受控 Tool/MCP 运行时执行；
5. Tool result 返回模型生成最终回答。

选择 Workflow 后，发送消息会执行该 Workflow，并把最终输出保存为当前会话的助手消息。会话直接 Skill 与所选 MCP Server 的工具快照会作为本次 Workflow Agent 节点的附加能力；Workflow 自身配置的确定性 Tool 节点仍按已保存定义执行。停止生成会同时取消外层会话和内层 Workflow。

## 权限与完整性

- Renderer 只能提交严格的能力 ID 列表，没有通用 `tools/call` IPC；
- Main/Application 重新检查 Agent、Skill、知识库、Workflow 和所选 MCP Server 的工具是否仍可用；
- MCP Tool 使用稳定 ID `mcp.<server-id>.<tool-name>`，模型只能调用本轮明确暴露的工具；
- Agent、Skill、知识库、Workflow 或 MCP Server 可直接删除、卸载或断开；会话中的对应绑定由 SQLite 在同一删除事务中自动移除；
- MCP 参数值、Tool 输出、用户正文和 Skill 指令不进入普通日志；调用继续支持超时、取消和脱敏审计。

## 当前限制

- 一个会话只能绑定一个 Workflow，暂不支持串联多个 Workflow；
- 会话 UI 按 Server 选择，但为兼容现有 `0016` 数据格式，底层仍保存选择时快照中的 Tool ID；Server 刷新后如工具集合变化，需要在会话中取消并重新选择；
- 当前不做语义 Top-K 工具筛选；所选 Server 在测试期会把当前快照中的全部工具交给模型；
- 不开放 Shell、stdio MCP、私网 MCP、Skill/Plugin 代码执行、写入型本地 Tool 或 Renderer 直接执行。

## 验证范围

- 契约测试覆盖原子能力绑定的严格 Schema；
- Application 测试覆盖无 Agent 的直接 Skill Prompt 与 MCP Tool 暴露，Renderer 单元测试覆盖 Server 整体选择和取消；
- SQLite integration 覆盖所有能力字段持久化、引用查询及删除后的自动解绑；
- Electron E2E 覆盖聊天菜单选择 Skill、跨 reload 恢复及从会话运行 Workflow。
