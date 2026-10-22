# Workflow Runtime V0

## 范围

本增量在已持久化的 Workflow Editor 上增加安全测试运行。交互参考 FastGPT 的调试心智：测试输入、逐节点状态、耗时、跳过原因、错误和最终输出；实现仍使用 Zimo 自有领域模型、IPC 契约和界面。

当前可执行节点：

- 开始：接收本次测试输入；
- 知识检索：以当前文本为查询，调用本地混合检索，使用节点配置的 Top K（当前最多 8 条）；
- Skill：读取已安装且已启用的 instruction Skill，只向后续 Agent 注入文本指令；
- Tool：仅调用可信注册表中的能力，要求本次运行确认、严格参数校验、超时和审计；
- Agent：解析已启用 Agent、模型、绑定 Skill 和知识库，通过现有模型网关生成文本；
- 结束：汇总可达结束节点的文本作为最终输出。

## 执行模型

Application 从唯一开始节点计算可达子图并执行拓扑排序。当前版本串行运行 DAG，以得到稳定、容易审计的结果；多条前驱的文本、知识上下文、Skill 指令和引用会确定性合并。未从开始节点连通的节点不执行，并产生 `node.skipped` 调试事件。

Renderer 调用具名 `workflow.run`，Main 返回 run ID，并通过独立 `workflow.stream` 推送：

- `run.started`；
- `node.started`、`node.completed`、`node.skipped`、`node.failed`；
- `run.completed`、`run.failed` 或 `run.cancelled`。

编辑器测试面板显示步骤、耗时和最终输出；画布节点和连线同步显示运行中、成功、跳过或失败状态。测试前先保存当前定义，运行时始终读取 Main 中的已保存快照。

Agent 节点在调用 Model Gateway 前生成模型请求诊断。普通 `zimo.log` 的 `model.request.prepared` 只记录 `workflowId`、`runId`、`nodeId`、模型、Agent、Skill、知识库和消息长度；开发态启用敏感 payload capture 后，最终 System/User messages 会写入与会话共用的 `llm-payloads.jsonl`。两类日志都不包含 API Key、认证 Header、SecretStore 值或 Provider URL。

## 安全边界

- Renderer 不获得模型密钥、数据库、文件、网络或命令执行能力；
- 知识正文继续作为不可信参考数据隔离，不能申请权限或覆盖 System 指令；
- Skill 只允许现有 instruction v1 内容，不执行脚本或依赖；
- 条件表达式和人工确认在预检阶段拒绝，不在 Renderer 或 Main 中解释；
- 当前注册内置 `zimo.knowledge.search` 和已连接 HTTPS MCP Server 的完整工具快照；显式 Tool 节点继续走固定参数映射，绑定 MCP 的 Agent 节点可以由模型生成参数并调用；Shell、stdio/私网 MCP、Plugin、任意代码节点和动态模板表达式均未注册；
- 一个 run 使用独立 AbortController，可由测试面板取消，窗口关闭时统一终止。

## 当前限制

- 节点按拓扑顺序串行执行，尚未并发调度；
- 只保留本次测试的内存事件，不持久化运行历史；
- Agent 内部模型文本先聚合为节点输出，尚未在测试面板逐 token 展示；
- 模型诊断覆盖 Agent 节点；纯开始、知识、Skill、Tool、结束节点不会产生 LLM payload；
- 条件分支、循环、人工确认、断点重跑和单节点调试尚未开放。
