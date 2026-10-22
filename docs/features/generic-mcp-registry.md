# 通用 MCP Registry 与 Agent Tool Calling

## 已实现范围

Zimo 底层可以连接多个公开 HTTPS Streamable HTTP MCP Server。当前产品页面提供 17 个受信公网服务目录，其中包含 10 个国内服务增量；既有自定义 Server 和标准 OAuth 契约继续兼容，但自定义入口暂不在主界面展示。此前实现过两类通用入口：

- **官方服务授权**：服务定义来自 Zimo 连接器目录，认证使用标准 MCP OAuth 2.1。点击连接后由 Main 打开系统浏览器，用户在服务商页面登录或扫码，授权回调完成后自动发现工具；
- **自定义 MCP 服务**：用户填写名称、稳定 Server ID 和 HTTPS endpoint，可选无认证、Bearer Token 或标准 MCP OAuth。

两类入口进入同一个 Registry 和运行时，不为每个厂商复制一套工具调用逻辑。连接时由 Main 进程使用官方 MCP Client 完成 `initialize`，确认服务端声明 Tool 能力后分页调用 `tools/list`，并把服务端当前暴露的完整工具目录保存为本地快照。GitHub 使用官方通用远程 endpoint，不在 Zimo 中过滤其工具目录。

Registry 不按 Server ID 或 Tool 名称过滤目录。企查查、腾讯会议及后续服务都保存 `tools/list` 的完整结果；端点自身是否只读由服务商能力和用户凭据决定。

Agent/Workflow 保留测试期“Server 级授权”：绑定后该 Server 快照里的全部 Tool 都可进入运行时。会话同样按已连接 Server 选择，由模型在其当前工具快照中决定具体调用。远端 Tool 名称映射为 `mcp.<server-id>.<tool-name>` 的本地稳定 ID；凭据只进入 SecretStore，SQLite 和 Renderer 只接收连接元数据与工具摘要。MCP 管理列表仅显示 Server 连接信息与工具数量，不逐项展开远端工具详情。

## 运行流程

1. MCP 页面选择内置服务并输入已申请凭据；Main 使用固定目录地址和认证方式，将目录专用 API Key 注入固定 Header 或临时请求 Query，同时校验公开 HTTPS 地址并拒绝 userinfo、自定义端口、私网/回环解析和 redirect；SQLite 始终保存不含凭据的基础 endpoint；
2. OAuth 连接根据 MCP `401` challenge 发现 Protected Resource 与 Authorization Server 元数据，使用动态客户端注册、PKCE S256 和随机 `state`；Main 在 `127.0.0.1` 随机端口建立一次性回调并打开系统浏览器，等待时间上限 5 分钟；
3. 回调校验成功后由 SDK 兑换 Token 并重新连接；access/refresh token、动态 client registration 和 discovery state 作为 opaque JSON 只保存到 SecretStore；
4. Adapter 调用 `initialize` 和分页 `tools/list`，限制最多 500 个 Tool、Schema 深度和单项大小；
5. `0013` 保存多 Server Registry，`0015` 增加 `catalog/custom` 来源和 OAuth 认证类型；SQLite 只保存 secret ref；
6. Agent 编辑页或 Workflow 编辑器绑定一个或多个 Server；绑定 Server 即授权当前快照中的全部工具；
7. 会话 Agent 或 Workflow Agent 节点运行时，将所有已绑定 Tool 转成模型 `tools` 定义；为满足模型函数名限制，线上短别名只在单次调用中使用，本地授权仍以稳定 Tool ID 判断；
8. 模型返回 `tool_calls` 后，Application 拒绝本轮未暴露的名字，检查参数为有界 JSON 并按基础 JSON Schema 字段校验；
9. 调用进入 `ControlledToolService`，执行 20 秒超时、取消传播、100000 字符输出限制和脱敏审计，再通过 MCP `tools/call` 执行；OAuth Token 刷新或轮换后同步更新 SecretStore；
10. MCP 结果作为 Tool message 返回模型，模型可继续选择工具，直到返回不含 `tool_calls` 的最终回答；用户取消、模型失败和单次 Tool 超时仍会终止运行。
11. 同一个 Conversation 或 Workflow Agent Tool Loop 按 `runId + serverId` 复用已经初始化的 Streamable HTTP Session；运行结束、失败或取消时统一关闭。连接/调用失败的 Session 会立即淘汰，下一次调用重新连接。

普通对话无需绑定 Agent，也可以直接选择 MCP Server；此时仅把所选 Server 当前快照里的工具暴露给模型。Workflow 的显式 Tool 节点仍适合确定性调用；选择 Workflow 的会话会把所选 MCP Server 工具叠加给 Workflow Agent 节点。

## 安全与限制

- 服务端名称、描述、Schema、annotations 和输出全部是不可信输入；annotations 只用于 UI 风险提示，不构成安全证明；
- 本测试增量按用户选择将 Agent/Workflow 的 Server 绑定视为该运行的授权，因此不会逐个 Tool 弹确认；未绑定的 Server永远不能被模型调用；
- 未声明只读的 Tool 按高风险展示并保留完整审计。连接测试前应优先使用只读端点和最小权限凭据；
- 当前测试期允许已绑定 Server 快照中的远程写 Tool，不逐项弹出确认；这不移除参数校验、运行时授权、超时取消、输出限制或审计；
- OAuth 当前只支持符合 MCP Authorization 规范、允许 loopback redirect 且支持动态客户端注册的 Server；要求固定 `client_id/client_secret`、厂商私有 Header、设备码或 CLI 登录的服务仍需专用连接器/Gateway；
- 腾讯会议当前公开 MCP 采用 Token/代理方案，不能仅凭云端域名假定支持标准 MCP OAuth。后续应通过腾讯会议官方 Gateway 或受控 Header Adapter 接入，不伪造可用预设；
- 当前不支持 stdio、SSE 旧传输、私网 MCP、resources、prompts、sampling、elicitation 或 roots；
- Agent/Workflow/会话的 Server 绑定仍会把该 Server 当前快照的全部 Tool 发给模型；尚未实现正式 Toolset 和语义 Top-K。工具很多时会增加 token 和误选概率；
- DNS 校验降低直接 SSRF 风险，但不能完整消除 DNS rebinding。正式开放任意第三方 Server 前仍需连接固定解析/代理层。

## 手动验证

1. 打开 MCP 页面，选择一个目录服务并进入独立编辑页；
2. Bearer、固定 Header 或 Query Key 服务填写凭据后测试并保存；OAuth 服务在系统浏览器授权后自动保存；免认证服务可直接测试并保存；
3. 确认列表显示 Server 名称和完整 `tools/list` 数量，但不展开工具详情；
4. 创建或编辑 Agent，勾选 GitHub MCP，并确认所选模型的 Tool Calling 能力已启用；
5. 在会话选择该 Agent，输入“搜索 star 超过 1000 的 MCP 仓库并总结前三个”；
6. 检查回答以及 `zimo.log` 中不含参数值的 `tool.execution.completed` 审计；开发运行还可在 `llm-payloads.jsonl` 的 `conversation_tool_round` 记录中核对本轮 `request.tools` 与模型返回的 `response.toolCalls`；
7. 在 Workflow 编辑器绑定 MCP，将同一 Agent 放入开始和结束节点之间，运行相同自然语言输入；
8. 刷新 MCP 快照后再次运行；直接解绑 Server 时，Agent、Workflow 和会话中的对应绑定会自动清理。

自动测试使用 fake Gateway 和本地 fake OpenAI-compatible Server，不连接真实账号。
