# 会话按需能力发现

## 用户行为

普通会话不再显示“继续普通对话”、识别置信度或 Router 超时。模型先使用当前会话已有能力；不足时调用 `search_capabilities` 搜索用户本地已安装的 Skill、Agent、MCP、知识库和 Workflow。

已安装、已启用且通过 Application 校验的能力不需要再次授权。可直接加入当前任务的 MCP Tool、受审核 Skill Tool 和知识库检索会在同一个模型 Tool Loop 的下一轮出现。工具如果涉及写文件、命令、脚本或外部副作用，仍执行自身既有审批和审计规则。

本地无匹配时，系统查询现有 Skill Store 和 Agent 人才库并把候选作为建议返回。模型只能说明如何安装、连接或配置，不能自动安装或连接服务。

## 执行链路

1. Application 解析当前会话显式绑定的 Agent、Skill、知识库、Workflow 和 MCP Tool；
2. 模型请求包含当前已加载 Tool、`search_capabilities` 及适用的结构化问答工具；
3. 当前能力足够时，模型直接调用并完成任务；
4. 当前能力不足时，模型提交有界查询、能力类型和可选动作词；
   已知目标 Skill 时可提交最多五个稳定 `packageIds`，Application 优先按 package ID 精确加载，避免同类能力模糊误匹配；
5. Application 搜索启用的本地 Prototype 和可信 Tool Registry，最多返回五项；
6. Skill Runtime 只为命中的已安装 Skill 注册受审核工具；知识库候选返回稳定 ID 并加载通用只读检索工具；MCP 只加载当前 Registry 仍存在的 Tool；
7. Tool Loop 在下一轮重建暴露工具集合，旧别名顺序保持稳定；
8. 一次运行最多搜索两次，取消会同时终止本地处理和市场网络请求；
9. 未找到本地候选时才查询 Skill/Agent 目录，目录失败安全降级为人工解决建议。

## 当前范围

- 已实现：Skill 指令、受审核 Skill Tool、已连接 MCP Tool、启用知识库、Agent/Workflow 元数据发现、Skill/Agent 市场建议；
- Agent 和 Workflow 命中后仍需通过会话现有选择入口启动，不在当前模型 Tool Loop 内递归运行；
- 搜索使用名称、描述、分类、标签、能力和权限字段的有界词项匹配；尚未使用 Embedding 或重排模型；
- 只支持声明 Tool Calling 的会话模型；不支持 Tool Calling 的模型继续普通文本回答，不额外调用分类模型；
- 动态加载只对当前 run 生效，不静默修改 SQLite 中的会话能力绑定。
- 已加载 Skill 的受控文本资源可通过随 Skill 注册的只读资源 Tool 读取；资源访问受安装清单、checksum、相对路径和大小限制约束，不使用会话 Workspace。

## 安全与隐私

- Renderer 没有新增 IPC，也不能直接搜索或执行 Tool；
- 搜索结果不包含知识库正文、MCP 输出、凭据、绝对路径或市场下载地址；
- instruction Skill 最多向搜索结果放入 12000 字符，仍视为用户安装的不可信 Prompt；
- Application 再次确认动态 Tool ID 当前存在于可信注册表，模型编造的 ID 不会进入暴露集合；
- 普通日志不得记录搜索查询、Skill 指令或候选描述；助手步骤只显示“查找可用能力”和候选数量。

详细信任决策见 [ADR 0023](../adr/0023-on-demand-capability-discovery.md)。
