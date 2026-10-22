# 能力删除与引用级联

## 用户行为

Agent、Skill、知识库、Workflow 和 MCP Server 可以直接删除、卸载或断开，不再要求用户先逐个进入会话、Agent 或 Workflow 手工解除引用。

删除操作仍只作用于用户明确选择的目标，不批量删除引用方。SQLite 在目标删除的同一事务中处理关联状态：

- 会话自动清除被删 Agent、Skill、知识库、Workflow 或 MCP Server 对应的能力绑定；
- Agent 自动移除被删 Skill 和知识库，其他配置保持不变；
- 引用被删 Agent、Skill 或知识库节点的 Workflow 保留原编排但自动禁用，方便用户后续编辑修复；
- 断开 MCP Server 时自动删除 Agent/Workflow 的 Server 绑定，并从会话 Tool ID 快照中移除该 Server 的工具；
- AgentRun 历史记录保留原 Agent ID 作为审计快照，不再用外键阻止 Agent 删除；
- 知识库原文件、分块和向量仍按原有删除流程清理，Skill 安装包和工作目录仍按卸载流程清理。

## 一致性与失败方式

引用清理由 `0019_capability_deletion_cascade.sql` 的 `BEFORE DELETE` 触发器完成，与目标数据库删除处于同一事务。任何 JSON 引用损坏、外键冲突或数据库写入失败都会回滚数据库删除，不返回伪成功。

远端人才库 Agent 的卸载仍先调用远端删除接口；远端调用失败时不触发本地删除。远端成功但本地事务失败时保留本地记录并返回错误，用户可重试清理。

## 验证

SQLite 集成测试覆盖五类目标同时被会话引用，以及 Skill/知识库被 Agent 引用、Agent/Skill/知识库被 Workflow 引用、MCP 被 Agent/Workflow 引用和 AgentRun 历史存在的情况。删除后不得留下活动绑定，关联 Workflow 必须禁用，AgentRun 必须保留。
