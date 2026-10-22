# LLM 请求诊断日志

- 状态：Resolved
- 日期：2026-09-07
- 影响范围：Conversation、Workflow Agent、Agent + Skill Runtime、Main 日志

## 问题

Agent 通过会话发送消息时，现有日志只有运行终态，无法判断 Agent `skillIds` 绑定的 Skill 是否真正编译进最终模型请求。直接记录完整请求虽然便于排查，却会把用户消息、System Prompt、Skill 指令和知识正文持久化到普通日志，违反项目隐私边界。

## 原因

`ConversationService` 在 Application 内解析 Agent 和 Skill、拼装知识上下文与历史消息后直接调用 Model Gateway；Main 只观察到流式事件，没有请求发送前的安全诊断边界。

## 修复

- 在最终消息构造完成、Model Gateway 调用前生成只读诊断摘要；
- 通过可选 `inspectModelRequest` 回调交给 Main 写入 `model.request.prepared`；
- 记录 provider/model/Agent ID、实际 Skill ID/package/version/指令字符数、知识库 ID、上下文长度和消息角色/长度；
- 固定 `requestContentLogged: false`，不传递任何正文给 Logger；
- 将消息创建和请求摘要提取到独立模块，保持超大 Application/Main 入口只减不增。

## 回归保护

Application 测试断言已安装 Skill 的身份和版本出现在诊断摘要中，同时断言序列化摘要不包含用户消息或 Skill 指令。Electron E2E 断言日志存在该事件，且仍不包含 API Key、用户消息和知识正文。

## Workflow 接入（2026-09-07）

Workflow Agent 节点现已在最终消息构造完成、调用 Model Gateway 之前复用同一诊断策略。普通日志以 `workflowId/runId/nodeId` 标识来源，记录实际模型、Agent、Skill、知识库和消息长度；开发态完整 payload 写入与会话相同的 `llm-payloads.jsonl`。Workflow 的开始、知识、Skill、Tool 和结束节点本身不调用 LLM，因此不会单独产生 payload。

Router 分类仍是独立模型调用路径，当前未写入完整 payload；后续接入时应继续使用相同安全字段规范。

## 开发态完整 Payload（2026-09-07）

为定位编译后的 Agent/Skill Prompt，根目录和 Desktop 包的 `pnpm run dev` 脚本默认注入 `ZIMO_LOG_LLM_PAYLOADS=1`。它仅在带 `ELECTRON_RENDERER_URL` 的开发进程生效，将会话和 Workflow Agent 节点进入 Model Gateway 的完整 messages 写入独立 `llm-payloads.jsonl`，不改变普通 `zimo.log` 的正文禁记规则。

独立文件不包含连接对象、API Key、Header、SecretStore 值或 Provider URL；权限为 `0600`，10MB 滚动并最多保留 2 个历史文件。测试覆盖默认关闭、生产环境拒绝开启、正文完整保留、凭据字段缺失和文件权限。该文件本身属于敏感用户数据，排障结束后需手动删除。

## Tool Calling 轮次（2026-09-10）

会话和 Workflow Agent 的每一轮模型工具调用都会追加独立记录：`request.tools` 保存本轮实际暴露的 Tool 定义，`response.toolCalls` 保存模型选择结果，`round` 标识轮次。记录发生在模型返回后、Tool 执行前；后续轮次的 messages 包含已执行 Tool 的结果，以便还原完整决策链路。

该增量只进入显式开启的敏感日志，不进入普通 `zimo.log`。Tool Call 参数值与后续 Tool 输出均属于敏感内容；MCP Token、Header、SecretStore 值和模型 API Key 仍不进入记录。
