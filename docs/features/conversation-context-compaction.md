# 会话上下文检查点压缩

## 目标

普通会话在模型可见上下文接近上限前生成检查点摘要，使长任务可以继续执行，同时保留用户可见的完整原始消息。首版使用 Zimo 自己发起的模型摘要请求，不依赖模型供应商的原生 compaction API。

## 产品行为

- 登录托管模型声明最大上下文为 1,200,000 tokens；实际预算始终取应用配置和模型能力中的较小值。
- 在预计请求达到最大上下文的 80% 时执行正常压缩；达到 90% 时必须先压缩再继续本轮回答。
- token 预算包含 System Prompt、Agent、Skill、知识、文档、Workspace、工具说明、历史消息和输出预留，不能只统计聊天气泡。
- 压缩仅替换模型可见视图，不删除或改写 `messages` 原始记录。
- 模型可见历史由“最新有效摘要 + 摘要之后的已完成原始消息”组成；重复压缩会整合旧摘要和后续新增历史。
- 最近消息保留原文，压缩边界只能落在一条完整消息之后；未来持久化 Tool transcript 时还必须保持 Tool Call/Result 成对。
- 用户可以在会话中看到压缩开始、完成和失败。完成记录可展开查看摘要、覆盖范围、压缩前后估算 token 和触发原因。
- 压缩失败时保留旧 Surface；软阈值允许继续，硬阈值停止本轮模型请求并提示重试，不能伪装成功。
- 摘要中的用户要求仅服务当前会话交接；跨会话记忆由普通会话的独立模型工具写入，不再解析压缩摘要保存。

## 数据与职责

```text
messages（完整事实来源，不变）
                 ↓
ContextCompactionService（预算、边界、摘要）
                 ↓
conversation_compactions（版本化检查点）
                 ↓
compileConversationMessages（最新摘要 + 最近原文）
                 ↓
ModelGateway
```

- Domain 定义检查点实体与 Repository port。
- Application 负责预算、选择可压缩前缀、调用模型生成摘要和组装 Surface。
- SQLite Adapter 只负责检查点持久化，不解释摘要内容。
- Main 继续通过现有会话流转发严格 Schema 事件，不增加通用模型或数据库 IPC。
- Renderer 只展示 DTO 和流事件，不接触原始数据库或隐藏 Prompt。

## 检查点状态

每条记录包含：

- `status`: `running | completed | failed`；
- `trigger`: `threshold | overflow_recovery | manual`，首版自动路径使用 `threshold`；
- 覆盖消息的起止 ID 和结束 position；
- 摘要正文；
- 压缩前、压缩后估算 token；
- 保留原文开始 position；
- 同一会话单调递增的 `version`；
- 安全错误码和时间戳。

只有最新一条 `completed` 记录参与模型 Surface。`running/failed` 用于用户反馈和诊断，不影响上一次有效摘要。

## Token 预算

首版不引入新的 tokenizer 依赖，使用保守估算器：ASCII 字符按约 4 字符/token，非 ASCII 字符按约 1 字符/token，并为每条消息加入协议开销。工具 Schema 按序列化字符数计入预算。模型返回的真实 usage 继续保存用于观测，但不作为下一轮唯一依据。

默认参数：

| 参数             |                                                                值 |
| ---------------- | ----------------------------------------------------------------: |
| 最大上下文       |                                                  1,200,000 tokens |
| 软触发比例       |                                                               80% |
| 硬触发比例       |                                                               90% |
| 输出预留         |                                                    120,000 tokens |
| 最近原文保留目标 |                                                至少 12 条完成消息 |
| 摘要最大输出     | 受 Model Gateway 当前能力约束，首版通过有界 Prompt 和结果长度校验 |

如果模型未声明 `maxContextTokens`，自动压缩关闭，避免把未经确认的容量当成事实。

上述 12 条是自动压缩和正式版手动压缩的默认保留数；开发服务器的手动压缩另行采用 2 条，详见[手动会话压缩与用户记忆](manual-compaction-and-user-memory.md)。

## 压缩 Prompt

压缩请求要求输出固定 Markdown 栏目，必须保留用户纠正、未完成事项、精确路径、标识符、错误和数字；区分事实、暂定方案和待验证推测；不得把未执行操作写成已完成；不得输出秘密；如果存在旧摘要则合并仍有效信息并删除失效内容。压缩请求不得开放 Tool。

## 执行步骤

1. 增加 Domain 检查点模型和 Repository port。
2. 增加顺序 migration、SQLite Repository、空库与升级测试。
3. 增加 token 估算、Surface 选择和压缩 Prompt 的纯函数测试。
4. 实现 `ContextCompactionService`，支持取消、失败关闭和摘要结果校验。
5. 在普通会话模型请求前计算完整预算，必要时压缩并重新编译模型消息。
6. 增加严格流事件和会话详情 DTO，显示压缩状态及历史检查点。
7. 增加 Renderer 检查点卡片、进行中状态、失败提示和展开摘要。
8. 补充安全日志、架构/数据/流文档和 `PROGRESS.md`。
9. 运行 format、lint、typecheck、unit、integration、build，并按可用环境执行聊天 E2E。

## 首版非目标

- 不实现用户长期记忆、偏好抽取或跨会话检索；
- 不压缩 Workflow Runtime 内部节点历史；
- 不调用供应商原生 compaction endpoint；
- 不删除原始消息，不自动向量化消息；
- 原首版不提供手动压缩按钮和摘要编辑；手动压缩已由[后续增量](manual-compaction-and-user-memory.md)提供；
- 不承诺近似 token 估算与供应商 tokenizer 完全一致。

## 失败与安全

- 摘要属于用户正文，不能进入普通日志；开发态敏感 payload capture 仍按既有规则处理。
- 普通日志只允许会话/运行/检查点 ID、触发类型、估算 token、状态、耗时和安全错误码。
- 压缩继承当前运行的 `AbortSignal` 和模型网关错误映射。
- 摘要为空、超出上限、没有推进覆盖边界或数据库写入失败都视为失败。
- 硬阈值压缩失败返回稳定错误，原始消息和上一条有效摘要保持可用。

## 验收

- 未到阈值时请求内容与现有行为一致。
- 达到阈值后先出现“正在整理较早的会话内容”，再发送使用新 Surface 的正常回答请求。
- 第二次压缩输入包含上一次摘要和新增原文，不重新发送已被覆盖的原始历史。
- 重启后完整聊天记录仍可见，模型只使用最新有效摘要和其后的原文。
- 压缩失败不写入 completed 检查点；硬阈值不继续发送超限请求。
- 普通日志、IPC 和 Renderer 不出现 API Key、Header 或未授权的内部路径。
