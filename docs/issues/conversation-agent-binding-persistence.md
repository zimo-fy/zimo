# 会话切换后 Agent/Skill 丢失

- 状态：Resolved
- 修复日期：2026-09-07
- 影响范围：聊天会话的 Agent 及其派生 Skill 展示与执行上下文

## 现象

用户在会话中选择 Agent 后，当前页面能够显示 Agent 及其绑定 Skill；切换到其他会话再返回时，已选能力消失。应用重启后也无法恢复。

## 根因

聊天页只把所选 Agent 保存在 React 内存状态中。会话领域对象、SQLite `conversations` 表、IPC 详情 DTO 均没有 Agent 绑定字段；切换会话时页面还会主动清空该状态。Skill 并非独立的会话选择，它由当前 Agent 的 `skillIds` 派生，因此会随 Agent 一同消失。

## 修复

1. `Conversation` 增加可空 `agentId`，通过 `0009_conversation_agent_binding.sql` 持久化为 `conversations.agent_id`；
2. 增加严格的 `conversations:change-agent:v1` IPC，由 Application 校验 Agent 状态及其 Skill 是否已安装、启用；
3. 打开或切换会话时，从会话详情恢复 Agent，再从 Agent 详情派生已选 Skill；
4. 发送消息时以持久化绑定为默认 Agent，Renderer 显式参数仍需与确认状态一起通过契约；
5. 被未删除会话引用的 Agent 不允许删除，避免悬空绑定。

## 当前交互语义

最初修复将“Agent 绑定”和“执行确认”分开，导致切换回来后虽然恢复了 Agent/Skill，仍重复显示确认条。2026-09-07 根据产品确认调整为“选择即授权”：`conversation.agentId` 是唯一权威状态，发送接口不再接受临时 Agent ID 或 `agentExecutionConfirmed`，切换会话和重启后可以直接继续使用。取消 Agent 选择即撤销该会话绑定。Tool/MCP 的高风险确认策略不受影响。

## 回归覆盖

- Contract：Agent 绑定请求拒绝未知字段，会话详情接受合法 `agentId`，发送请求拒绝临时 Agent 字段；
- Application：持久化 Agent 后直接从会话绑定编译其 Skill，引用中的 Agent 禁止删除；
- SQLite：关闭并重新打开数据库后仍能读取绑定；
- Electron E2E：选择 Agent 后可直接发送；切换到新会话再返回时恢复 Agent，且不出现重复确认。
