# Controlled Tool V0

## 当前闭环

Workflow 节点库新增 Tool 节点。Renderer 通过只读 `tools.list` 获取可信能力摘要，不能直接执行 Tool。测试面板展示本次将调用的 Tool、权限、只读/开放世界属性和超时；用户点击“确认权限并运行”后，确认的 Tool ID 随本次 run 提交。

Application 执行顺序：

1. 仅解析从开始节点可达的 Tool；
2. 校验 Tool ID 存在于可信注册表；
3. 校验本次 run 的显式确认集合；
4. 按能力 Schema 校验参数并拒绝未知字段；
5. 建立独立 AbortSignal 与硬超时；
6. 执行只读 handler，限制输出大小；
7. 把输出标记为不可信上下文供后续 Agent 使用；
8. 以独立 `toolCallId` 写入不含参数值和输出正文的结构化审计记录。

首个能力 `zimo.knowledge.search` 需要 `knowledge:read` 权限，只接受知识库 UUID、查询文本和 1–8 的 limit。知识库必须已经存在且启用；该能力不访问网络、不读取任意路径，也不修改文件或索引。

首个远程能力 `mcp.github.search_repositories` 是历史固定映射。当前通用 Registry 会把已绑定 MCP Server 的完整工具快照动态注册，Agent/Workflow 的 Server 绑定视为测试期授权；每次调用仍使用超时、取消、输出隔离和脱敏审计。详见[通用 MCP Registry](generic-mcp-registry.md)。

## 未开放

- 模型自主选择或循环调用 Tool；
- 直接从 Renderer 调用 Tool；
- 写入、删除、Shell、任意文件，以及除 GitHub 仓库搜索之外的开放网络 Tool；
- stdio、私网 MCP、resources、prompts 和 Renderer 直接远端工具执行；
- 永久授权、后台无人值守执行和跨 Workflow 授权复用。

MCP 的信任、传输和能力快照策略见 [ADR 0010](../adr/0010-controlled-tool-and-mcp-boundary.md)。
