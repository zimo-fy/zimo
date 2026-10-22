# ADR 0021：会话完整记录与模型 Surface 分离

## 状态

已接受。

## 背景

普通会话当前把全部已完成消息直接发送给模型。长任务接近模型上下文上限后，继续发送会失败；直接删除、覆盖或把摘要写成普通消息又会破坏用户可见历史和恢复能力。供应商原生 compaction 不是当前 OpenAI-compatible Chat Completions 契约的一部分，也不能成为唯一实现。

## 决策

`messages` 继续作为完整事实来源，压缩不修改或删除原始消息。Application 从它派生模型可见 Surface：最新有效检查点摘要作为合成 user 历史，其后拼接尚未覆盖的完成消息；当前 Agent、Skill、知识、文档、Workspace 和语言策略仍按每轮最新状态重新编译，不能被旧摘要替代。

检查点通过独立的 `conversation_context_compactions` 表版本化保存。记录明确覆盖消息边界、保留原文起点、触发类型、运行状态和估算 token。只有最新 `completed` 记录参与 Surface；`running/failed` 只用于恢复、显示和诊断。重复压缩以旧摘要和后续新增原文生成新摘要，已覆盖原文不再次发送给摘要模型。

登录托管模型声明 1,200,000 tokens 最大上下文。首版在 Application 使用保守字符估算并计入动态系统上下文、工具 Schema 和 120,000 tokens 输出预留：80% 为软水位，90% 为硬水位。软水位压缩失败可以沿用上一份有效 Surface；硬水位失败关闭本轮请求。模型未声明上限时不自动压缩。

压缩调用复用 `ModelGateway`，不开放 Tool，继承当前运行的取消信号，限制摘要大小。压缩生命周期进入严格会话流事件和详情 DTO；普通日志只记录安全元数据，不记录摘要正文。

## 边界

- 首版只在普通 Conversation 模型请求前压缩；Workflow Agent 节点和单轮 Tool Loop 的动态 transcript 暂不自动压缩。
- 字符估算不是供应商 tokenizer；真实服务上限较小时仍可能由 Provider 先拒绝。
- 检查点不是用户长期记忆，不跨会话召回，也不替代未来独立的偏好、目标和未解决问题存储。
- 不调用供应商原生 compaction endpoint，不把供应商 opaque item 写入领域模型。

## 后果

用户可以继续查看和恢复完整会话，模型则使用有界、可重建的 Surface。摘要可能产生信息损失，因此界面允许用户展开检查点，原始消息保留用于后续重新生成和迁移。未来接入精确 tokenizer、供应商原生 compaction 或 Tool transcript 压缩时，必须保持完整事实来源与派生 Surface 的分离。
