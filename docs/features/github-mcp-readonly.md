# GitHub MCP 只读连接

> 历史实现说明：本文记录 2026-09-07 的 GitHub 单例只读增量。当前实现已由[通用 MCP Registry 与 Agent Tool Calling](generic-mcp-registry.md)取代；GitHub 目录现在使用官方 `https://api.githubcopilot.com/mcp/` 与标准 OAuth，并保存服务端完整 `tools/list`，下文不再描述当前行为。

## 已实现范围

Zimo 通过官方 MCP TypeScript Client 连接 GitHub 官方远程服务：

- 传输：Streamable HTTP；
- 固定端点：`https://api.githubcopilot.com/mcp/readonly`；
- 鉴权：用户提供 GitHub Personal Access Token，真实值只保存到操作系统 SecretStore；
- 连接验证：执行 MCP `initialize`、`tools/list`，再以固定只读 `get_me` 调用确认 Token 对应账号；
- 能力发现：只保留本地白名单中的 `get_me`、`search_repositories` 和 `get_file_contents`；
- 受控执行：只将 `search_repositories` 映射为 Workflow 能力 `mcp.github.search_repositories`；
- 生命周期：查看状态、首次连接、刷新工具快照、断开并删除凭据；
- 超时：整个发现流程硬限制 20 秒，窗口关闭或应用退出时主动取消。

官方服务配置依据：[GitHub Remote MCP Server](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md)。客户端握手和 Streamable HTTP 生命周期依据：[MCP TypeScript Client Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md)。

## 执行流程

1. Renderer 通过具名 IPC 瞬时提交 Token；不允许提交 URL、Header 或工具名；
2. Application 确认 SecretStore 可用，然后要求 Adapter 连接固定 GitHub 端点；
3. Adapter 同时发送 `X-MCP-Tools` 白名单、`X-MCP-Readonly: true` 和 `X-MCP-Lockdown: true`，并拒绝 HTTP redirect；
4. 远端工具列表限制为最多 100 项；名称、说明和 JSON Schema 经过长度、数量、深度与序列化大小校验；
5. Application 再与本地白名单求交集，为每项生成 `github:<tool-name>` 稳定 ID；
6. 真实连接验证成功后才创建新的 secret ref 并写入 SQLite；数据库失败会补偿删除新 Token；
7. 页面只收到账号、服务版本和工具摘要，不收到 Token、secret ref 或完整参数 Schema。

## 安全状态

发现的工具统一标记为：

- `readOnly: true`：由 Zimo 本地固定策略赋值，不信任远端注解；
- `openWorld: true`：工具可能访问 GitHub 网络数据；
- `approvalStatus: discovery_only`：远端快照本身永远不能直接执行；其中 `search_repositories` 由另一份本地固定能力定义映射到 Workflow，其余条目仍只用于展示。

`get_me` 不接受用户参数，只用于连接时确认 Token 身份。`search_repositories` 是唯一进入受控 Tool 注册表的远端能力；它使用本地固定参数 Schema、逐次确认和 15 秒硬超时，而不是信任远端注解。连接和工具调用审计均不记录账号返回正文、查询值、Token 或 Authorization Header。

Workflow Tool 节点把上游文本作为 GitHub 查询，返回数量由节点的“最大返回仓库数”控制。调用固定发送 `minimal_output: true`、`page: 1`，结果在进入统一 Tool 输出上限前先限制为 90000 字符，并以“不可信数据”上下文传递给后续 Agent。

## 本地存储

`0012_github_mcp_connection.sql` 创建单例表 `github_mcp_connections`，保存固定 server ID、固定端点、账号登录名、secret ref、服务版本、版本化工具 Schema 快照和时间。Token 不进入 SQLite。

断开连接先删除数据库快照，再尽力删除 SecretStore 中的 Token。刷新失败保留最后一次成功连接和快照，避免用失败状态覆盖可解释的本地事实。

## 手动验证

1. 在 GitHub 创建 Fine-grained PAT，只选择确实需要读取的仓库和最小只读权限；
2. 打开 Zimo 的 MCP 页面，粘贴 Token 并点击“连接并发现工具”；
3. 确认页面显示 `@账号`、官方只读端点，并将 `search_repositories` 标记为已映射受控 Tool；
4. 点击“刷新快照”验证可重连；
5. 在 Workflow 中添加 Tool 节点，选择“GitHub 仓库搜索”，连接到开始和结束节点；
6. 输入 `topic:mcp stars:>1000`，点击“确认权限并运行”，确认输出包含仓库搜索结果；
7. 点击“断开”，确认状态恢复未连接；再次运行 Workflow 应返回未连接错误。

自动测试不连接真实 GitHub 账号；真实 Token 和外部网络只用于用户主动的手动 smoke。

## 尚未开放

- `get_file_contents`、其他 GitHub 工具、会话或 Agent 调用；
- 任意工具名调用、模型自主选工具、后台调用或永久授权；
- 写入型 GitHub 工具；
- 用户自定义 MCP URL、Header、OAuth、代理或私网服务；
- stdio MCP、resources、prompts、sampling、elicitation 和 roots。
