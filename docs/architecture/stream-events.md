# 统一流式事件

## 领域无关事件

Renderer 不消费 OpenAI 或 LangChain 原始 chunk。Application 层输出以下判别联合：

```ts
type AgentStreamEvent =
  | { type: "agent.started"; agentId: string; agentName: string; skillIds: string[] }
  | { type: "message.started"; messageId: string }
  | { type: "message.delta"; messageId: string; text: string }
  | { type: "message.completed"; messageId: string }
  | { type: "route.completed"; route: IntentRoute }
  | { type: "usage.updated"; usage: TokenUsage; messageId?: string }
  | { type: "message.steps.updated"; messageId: string; steps: AssistantStep[] }
  | { type: "context.compaction.started"; compaction: ContextCompactionView }
  | { type: "context.compaction.completed"; compaction: ContextCompactionView }
  | { type: "context.compaction.failed"; compactionId: string; trigger: string; errorCode: string }
  | { type: "run.cancelled" }
  | { type: "run.completed" }
  | { type: "run.failed"; error: SerializedAppError };

interface AgentStreamEnvelope {
  runId: string;
  sequence: number;
  emittedAt: string;
  event: AgentStreamEvent;
}

interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
}
```

`IntentRoute` 的 `shouldExecute` 在 V0.1 必须是字面量 `false`。

## 顺序与终态

典型成功序列：

```text
route.completed
message.started
message.delta (0..n)
usage.updated (0..n)
message.completed
run.completed
```

`route.completed` 暂时为兼容事件：显式 Agent/Workflow 反映既有会话绑定，普通聊天固定为 chat，不再等待前置 LLM Router。Renderer 不展示该事件。assistant 消息在 `send` 接受时已经创建，`message.started` 表示模型流真正开始。

需要压缩时，`context.compaction.started` 出现在正常模型回答请求之前；成功后发送 `context.compaction.completed`，失败发送 `context.compaction.failed`。软水位失败允许继续使用上一份有效 Surface，硬水位失败随后以 `run.failed` 结束。摘要正文只存在于严格会话 DTO/事件和 SQLite，不进入普通日志。

检查点完成不会导入长期记忆；跨会话记忆由普通会话的独立结构化工具写入。压缩事件仅报告检查点状态，不携带记忆正文。

每个 run 恰有一个终态：`run.completed | run.cancelled | run.failed`。终态之后的上游 chunk 被丢弃并记录 debug 元数据。`message.completed` 只在正常完成时出现；取消/失败通过终态和持久化的 message status 表达。

## 背压与持久化

- Model Adapter 产出的细碎 token 可在 Application 合并为最多 16ms 或 1KB 一批的 delta；不改变文本顺序。
- Main 不保存无限队列；窗口销毁或持续不可用时中止 run。
- assistant 正文按 250ms 或 4KB 阈值持久化，任一先到即 flush；终态强制 flush。
- Renderer 以 `runId + sequence` 去重，并将正文追加到 `messageId`；收到未知 message 时重新读取会话。
- usage 是最终一致的可选数据；提供商不返回时字段保持 undefined，不伪造为 0。聊天页把 `usage.updated` 写到对应助手消息（有 `messageId` 时按 ID，否则写到当前 `streaming` / `pending` 助手），并在 `message.completed` 用 envelope `emittedAt` 更新完成时间。已停止/失败也会显示用量页脚。同一轮发送会合并主回复/Tool 轮、Router 分类和首轮标题；分类超时后仍在后台完成的 usage 会补记到同一条消息。用户停止后立刻发 `run.cancelled` 并停止文本增量，但当前模型 HTTP 再读最多 15s 以收取最后一块 usage，随后仍可用带 `messageId` 的 `usage.updated` 补记。
- 工具步骤是最终一致的可选数据。Application 在计划动作或解析参数后发送 `message.steps.updated`，写入同一条助手消息的 `steps_json`，不改 `updatedAt`。事件只含安全标题、可选相对路径和状态，不含工具参数、输出、绝对路径或 reasoning。最多 100 步。用户停止时 leftover `running` 步骤变为 `cancelled`。Renderer 按 `messageId` 覆盖步骤列表。

## 取消与竞态

`cancel` 返回 accepted 只表示已触发运行取消。Application 立即停止文本增量并发送 `run.cancelled`；当前模型流的 HTTP 在短窗口内继续读取，只为收取 usage，不再发出 `message.delta`。若完成事件先于取消到达，则 cancel 返回 false，原完成状态不回滚。

数据库更新使用状态条件，例如只允许 `streaming -> cancelled`，保证取消、失败和完成竞争时只接受一个终态。

## 错误行为

- 旧 Router 不再参与普通聊天；兼容 route 构造失败属于 Application 错误；
- 模型在首 token 前失败：assistant 状态为 failed，发送 `run.failed`；
- 模型在部分输出后失败：保留正文，状态为 failed，允许重新生成；
- 持久化失败：停止上游，尽力 flush，返回 category=storage 的 `run.failed`；
- Renderer 重连：不重放内存流，通过 `conversations.get` 恢复已持久化文本和状态。

## 适配器映射

LangChain `AIMessageChunk` 只在 `model-langchain` Adapter 内存在。普通回复由 Adapter 转为内部 `ModelStreamEvent`；绑定 Tool 的回复由 `streamWithTools()` 转为 `text`、`usage`、`tool_calls` 和 `completed`。Application 把文本与 usage 转成 `AgentStreamEvent`，并在完整 `tool_calls` 经过 Schema、权限和审批后执行工具，同时发出不含参数/输出的 `message.steps.updated`。分片的工具名、ID 和 JSON 参数不进入 IPC，也不得在流未完成时执行。因此 LangChain 升级或 OpenAI-compatible 字段差异不会传入 Renderer。

Tool Calling 不保留非流式 fallback。Provider 缺少流式 Tool Call 支持或返回无法聚合的参数时，本轮以稳定模型错误结束；不能用第二次非流式请求补偿，以免重复计费或重复副作用。

LangChain 的流式能力参考其[官方 Streaming 文档](https://docs.langchain.com/oss/javascript/langchain/streaming)；Zimo 不承诺暴露其所有 stream mode。

## 契约测试

- 每一种事件均能通过 Zod Schema，未知 type 被拒绝；
- sequence 单调且终态唯一；
- 空 chunk、Unicode 分片和多段 content 可正确拼接；
- 取消不会产生 completed；完成后取消不改变状态；
- provider error 被映射且不泄露 response header/body 中的敏感字段；
- 普通聊天不发起 Router 模型请求；显式 Agent/Workflow 和固定 chat route 均保持事件顺序。

## Phase 9 审批事件（9C 已实现）

普通会话的人工问答另用 `question.requested`（含当前问题 ID、会话/运行 ID、题号/总数、单个有界题目与选项、过期时间）和 `question.resolved`（仅问题 ID）。模型一次提交多题时，Application 按 `resolved(当前题) → requested(下一题)` 逐题推进；全部回答后才恢复同一 Tool Call。它不属于动作审批；回答通过具名 IPC 送回等待中的 Tool Call。详见[会话内结构化提问](../features/conversation-user-questions.md)。

Phase 9C 让同一个 run 在 Tool Call 与执行之间安全暂停，`AgentStreamEvent` 已增加：

```ts
type ApprovalRequestedEvent = {
  type: "approval.requested";
  approvalId: string;
  actionDigest: string;
  actionKind: "file_write" | "file_delete" | "command" | "network" | "external_app";
  risk: "low" | "medium" | "high";
  summary: string;
  workspaceId?: string;
  relativeTarget?: string;
  command?: string; // 仅命令审批；最多 20,000 字符，完整展示后才能允许
  expiresAt: string;
};

type ApprovalResolvedEvent = {
  type: "approval.resolved";
  approvalId: string;
  decision: "allowed_once" | "denied" | "expired" | "cancelled";
};
```

`summary` 与 `relativeTarget` 必须由 Main/Application 从规范化动作生成并限制长度，不能直接透传绝对路径、完整命令输出或环境变量。命令审批额外携带经过 Tool Schema 校验的完整 `command`，只存在于当前运行内存与审批事件，用于让用户在允许前看清实际命令；它不写入审批表、普通日志或审计事件。首版只允许 `allowed_once`，不提供“本会话始终允许”事件。

状态序列：

```text
message.started
approval.requested
  -> approval.resolved(allowed_once) -> tool execution -> 后续 message.delta
  -> approval.resolved(denied)       -> 结构化拒绝结果返回模型继续或结束
  -> approval.resolved(expired)      -> run.failed / 模型安全收口
run.completed | run.cancelled | run.failed
```

等待审批不是终态。等待期间不得占用未受控 OS 进程；取消、窗口销毁、目录解绑、应用退出和恢复启动都会使审批失效。恢复后只能展示已失效事实，不得凭 SQLite 记录自动执行旧动作。`runId + approvalId + actionDigest` 绑定且只能消费一次；重复、过期、跨窗口或摘要不匹配的 resolve 必须拒绝并记录安全审计。
