# ADR 0010：受控 Tool 与 MCP 信任边界

- 状态：Accepted
- 日期：2026-09-04

## 背景

Workflow 已能运行本地知识检索、instruction Skill 和 Agent。下一阶段需要引入 Tool/MCP，但模型输出、导入知识、MCP Server 的能力声明和返回内容都属于不可信输入，不能直接转化成本地或外部副作用。

MCP 工具定义包含名称、描述、`inputSchema`、可选 `outputSchema` 以及 `readOnlyHint`、`destructiveHint`、`idempotentHint`、`openWorldHint` 等注解。规范同时明确这些注解只是提示，客户端不能据此作安全决策。Zimo 因此不能把远端 Server 的自我声明当作权限授权。

## 决策

1. 所有可执行能力进入 Main/Application 持有的可信注册表；Renderer 和模型不能注册或直接执行能力。
2. 能力 ID 使用稳定命名空间。内置能力使用 `zimo.*`；未来 MCP 能力使用本地生成的 Server ID 与远端工具名组合，不能仅依赖 Server 自报名称去重。
3. 注册项必须声明来源、权限、JSON Schema、只读/破坏性/幂等/开放世界属性、确认策略和硬超时。远端 MCP 注解先作为不可信元数据读取，再由 Zimo 策略映射为本地声明。
4. Workflow 保存工具 ID；每次运行前向用户展示能力和权限摘要。V0 对所有 Tool 使用 `per_run` 确认，不提供“永久允许”。Application 校验确认集合，不能只依赖按钮状态。
5. 参数先通过 IPC Schema，再通过注册能力自己的严格 Schema；拒绝未知字段。Tool 输出限制为 100000 字符，并作为不可信数据隔离，不能授予新权限。
6. 每次调用使用独立 AbortSignal 和工具级硬超时。用户停止 Workflow、窗口关闭或超时都会请求取消；取消是协作式的，终态仍由 Zimo 本地状态机裁决。
7. 审计记录 run/workflow/node/tool ID、权限 ID、参数键名、是否确认、耗时、结果和错误码，不记录参数值、知识正文、Tool 输出或凭据。
8. 第一项能力仅开放内置 `zimo.knowledge.search`：读取一个已启用的本地知识库索引，不联网、不写文件、无任意路径参数。

## MCP 后续接入门槛

- 首批只考虑显式配置并启用的 Streamable HTTP Server；`stdio` 会启动本地进程，需独立沙箱与命令 allowlist 评审后再开放。
- HTTP 只允许 HTTPS，凭据进入 SecretStore；禁止 URL userinfo，重定向、私网访问和 OAuth 回调需单独策略。
- `tools/list` 结果形成待审批快照；新增工具、Schema、权限或危险属性变化后暂停执行并要求重新确认。
- Server 返回的工具名、描述、Schema、注解、日志、进度和结果全部按不可信数据处理；能力列表限制数量和单项大小。
- `tools/call`、进度和取消必须关联同一个本地 run/tool-call ID；不开放 sampling、elicitation、roots、resources、prompts 或服务端反向请求，直至分别评审。

## 结果

Tool 能力可以逐项开放并审计，不需要把通用 MCP 客户端、进程启动或网络权限暴露给 Renderer。代价是首次接入步骤更严格，且远端 Server 更新后可能需要重新批准。

## 首个实施增量（2026-09-07）

- 首个 Server 固定为 GitHub 官方 `https://api.githubcopilot.com/mcp/readonly`，Renderer 不能提交任意 URL 或 Header；
- Main 使用官方 TypeScript Client 的 Streamable HTTP transport，额外固定 Readonly、Lockdown 和三项只读工具白名单，并拒绝 redirect；
- PAT 只经具名 IPC 瞬时进入 Main 并保存到 SecretStore；SQLite 只保存 secret ref 和经过限制的工具 Schema 快照；
- `get_me` 作为无用户参数的连接身份探针，是本增量唯一允许的固定 `tools/call`；其审计不记录返回正文或凭据；
- 所有发现工具标记为 `discovery_only`，不进入 Workflow 可信注册表。远端工具执行仍需后续独立审批、run/call ID、取消和输出隔离实现。

## 首个受控远程调用增量（2026-09-07）

- 只把远端 `search_repositories` 映射为本地固定能力 `mcp.github.search_repositories`；远端名称或注解不能自行进入可信注册表；
- 本地 Schema 只接受 1–256 字符 `query` 与 1–10 的 `limit`，调用远端时固定 `page: 1` 和 `minimal_output: true`；
- Workflow 继续使用 `per_run` 明确确认，并为该能力固定声明 `github:repositories:read`、只读、非破坏性、幂等、开放网络和 15 秒硬超时；
- 每次调用从 SecretStore 读取凭据并创建独立 Streamable HTTP 会话；Workflow/窗口取消和超时通过 AbortSignal 传播；
- MCP 错误正文不进入用户错误或日志，返回仅接受有界 JSON/文本，先限制为 90000 字符，再进入统一 Tool 100000 字符上限和不可信上下文隔离；
- Renderer 仍没有直接 `tools/call` IPC；`get_file_contents`、模型自主选工具及其他 MCP 能力继续保持未开放。

## 通用 Registry 与模型 Tool Calling 增量（2026-09-08）

本节取代上述“固定 GitHub/单工具映射”作为当前运行策略；旧实现说明保留为演进记录。

- 允许用户显式配置多个公开可解析的 HTTPS Streamable HTTP Server；仍禁止 stdio、私网地址、userinfo、自定义端口和 redirect；
- 连接固定执行 `initialize` 和分页 `tools/list`，最多接受 500 个 Tool，并把服务端实际暴露的全部工具形成版本化快照；不再使用 GitHub 三工具请求白名单；
- GitHub 官方 `/mcp/x/all/readonly` 作为内置全 Toolset 只读预设，不为尚无稳定官方 MCP 端点和认证流程的产品伪造预设；
- Agent/Workflow 绑定 Server 即授权当前快照中的全部 Tool。该策略用于先验证完整目录交给模型的效果，不代表最终最小权限方案；
- 模型只收到已绑定 Server 的 Tool。每轮使用短别名适配模型函数名限制；模型返回的名字必须反查到本轮暴露集合，否则按越权请求拒绝；
- Tool 参数保持有界 JSON、基础 Schema 检查和 MCP Server 最终校验；执行统一经过 20 秒超时、取消、100000 字符输出上限和脱敏审计；
- 工具结果作为 Tool message 返回模型。测试期不再限制单次运行的 Tool Calling 轮数或累计调用次数，循环在模型返回不含 `tool_calls` 的最终回答时结束；用户取消、模型调用失败和单次 Tool 超时仍会终止运行。该策略可能增加重复远程写入、模型费用和长时间占用风险，正式发布前必须补基于异步任务状态、总时长和风险级别的运行预算；
- 同一个 Conversation 或 Workflow Agent Tool Loop 以可信 `runId + serverId` 复用一个已经初始化的 Streamable HTTP Session，不跨运行或应用重启复用；循环通过 `finally` 在成功、失败和取消时关闭 Session。传输失败的 Session 立即淘汰，后续调用重新建立连接；凭据和 Session 仅存在于 Main 内存；
- 远端 annotations 仍不可信。未声明只读的能力按高风险展示；当前 Server 绑定视为运行授权，不再逐工具弹窗；
- Renderer 只有 Registry 管理 IPC，没有任意 `tools/call` IPC。模型调用和 MCP 执行都留在 Main/Application；
- 正式发布前必须补 Toolset/单 Tool 授权、语义 Top-K、OAuth 与 DNS rebinding 防护。本增量明确接受“整个 Server 授权范围较宽、全量工具增加上下文”的测试期代价。

## 双入口与标准 OAuth 增量（2026-09-08）

- MCP 管理界面分为官方服务目录与自定义 Server 两个入口；二者最终都形成相同的 `McpConnection`、工具快照和 Agent/Workflow 绑定，不按厂商复制运行时；
- 连接来源记录为 `catalog` 或 `custom`。来源只决定配置体验，不提升信任等级，也不能跳过参数、运行轮次、超时、取消和审计；
- 认证增加标准 `oauth`：由官方 MCP Client 完成 Protected Resource/Authorization Server discovery、动态客户端注册、PKCE 和 Token 刷新；Main 使用系统浏览器，Renderer 不加载远程授权页；
- 回调使用一次性的 `127.0.0.1` 随机端口，最长等待 5 分钟，并校验随机 `state`。OAuth access/refresh token、动态客户端信息与 discovery state 作为 opaque secret 存入 SecretStore；SQLite 只保存 secret ref；
- 本增量不设置厂商域名 allowlist，以便测试不同官方 Server；但继续要求公网 HTTPS MCP endpoint，拒绝 userinfo、自定义端口、私网解析和 MCP redirect。这些是协议边界，不作为厂商白名单处理；
- 只有符合标准 MCP OAuth 且支持 loopback redirect/动态注册的服务可直接使用该入口。腾讯会议现有公开 Token/stdio 代理、固定 OAuth client secret 或厂商自定义 Header 等模式需后续专用 Adapter 或服务端 Gateway；
- 此增量没有放开 stdio、Shell、任意进程、Renderer 外链或写入型本地能力。Server 级全工具授权仍是测试期策略，Toolset/单 Tool 授权和语义 Top-K 仍为发布前任务。

## 会话逐项授权增量（2026-09-08）

- 会话可保存具体 MCP Tool 的稳定 ID；选择动作是该会话的持续授权，切换会话或重启后恢复；
- 普通聊天只向模型暴露会话逐项选择的 Tool 与所选 Agent 的 Server 工具集合，模型返回名称必须属于该轮别名映射；
- 选择 Workflow 后，会话 Tool 只叠加给 Workflow Agent 节点；确定性 Tool 节点仍来自已保存 Workflow 定义；
- Main/Application 在保存和执行时都重新验证 Tool 是否仍在当前 MCP Registry，不信任 Renderer 保存的名称；断开 Server 时由数据库事务自动清理会话及 Agent/Workflow 绑定；
- Renderer 仍只有能力选择 IPC，不存在直接 `tools/call` IPC。该增量不等于完成 Agent/Workflow Toolset 策略或语义 Top-K。

## 会话 Server 级选择增量（2026-09-10）

- 会话能力菜单按 MCP Server 展示，不再要求用户理解或逐项勾选远端工具名；选择一个 Server 即授权其当前工具快照，模型根据工具描述和参数 Schema 自主选择具体 Tool；
- 为保持 `0016` 持久化和 IPC 契约兼容，Renderer 将 Server 当前快照原子展开为稳定 Tool ID 集合，Main/Application 继续逐项校验，模型仍不能调用本轮集合之外的 Tool；
- Server 工具目录刷新后，已有会话不会自动扩权。用户需取消并重新选择该 Server，新增 Tool 才会进入会话授权；
- 测试期每个会话最多可直接绑定 300 个 MCP Tool，以允许腾讯文档等大型 Server 完整展开工具快照。该上限只用于验证全量工具交给模型的实际效果；语义 Top-K、正式 Toolset 和独立 Server ID 持久化仍属于后续权限模型演进。

## 固定凭据目录增量（2026-09-10）

- MCP 页面首批固定展示企查查和腾讯会议，凭据先测试、后保存；测试只执行发现，不写 Repository 或 SecretStore；
- 企查查使用 Bearer。腾讯会议使用固定官方 HTTPS 地址，由 Main 注入 `X-Tencent-Meeting-Token` 和固定 Skill 版本 Header，不安装 stdio/Python 代理；
- 目录地址、认证放置方式和 Header 名称属于可信应用配置，Renderer 只能提交目录 ID 和有界凭据，不能自定义秘密 Header；
- 腾讯会议与其他 MCP Server 一致，保存服务端 `tools/list` 返回的完整工具快照，不设置厂商或工具名称白名单；选择 Server 即视为授权当前快照，创建、修改、取消等远程写操作可由模型选择并进入统一参数校验、超时取消、输出限制和审计链路；
- 当前测试期不逐工具弹出确认。用户应仅连接可信 Server、使用最小权限凭据；正式发布前仍需补充 Toolset/单 Tool 授权及高风险操作确认策略。

## 常用 HTTPS 服务目录增量（2026-09-10）

- MCP 列表与编辑职责拆分，点击目录项的编辑按钮进入独立配置页；列表不再承载凭据表单；
- 目录保留 GitHub、Sentry、Hugging Face、Context7 和 Microsoft Learn；移除 Notion、Linear、Stripe、Canva、Atlassian，并新增腾讯文档、高德地图、千图 AI、EdgeOne Pages、有活招工、盈米基金、滴滴出行、今日投资、麦当劳中国和 UAPI；
- 国内服务的固定 API Key Header 或 Query Key 由 Main 目录注入。基础 endpoint 和 secret ref 分开保存，Renderer 不能指定 Header/Query 名称，普通日志不得出现拼接凭据后的 URL；
- Main 持有独立受信目录并覆盖 Renderer 提交的名称、endpoint 和认证方式，Renderer 目录只用于展示；未知目录 ID 被拒绝；
- 标准 OAuth 服务使用现有系统浏览器、PKCE、动态客户端注册和 loopback 回调；Bearer 与免认证服务继续采用测试后保存；
- 企业微信因为没有统一固定 endpoint，且现有方案依赖动态业务域、stdio 或自行部署网关，已从当前固定目录移除；
- 此增量不开放 stdio、Shell、本地进程安装或私网 endpoint；真实厂商 OAuth 兼容性仍需逐项人工 smoke。

## MCP 工具 Schema 兼容增量（2026-09-11）

- 所有远端 MCP Server 的 `tools/list` 参数 Schema 不再设置 12 层嵌套或单数组/对象 500 项的本地限制，避免拒绝符合 MCP/JSON Schema 但结构复杂的官方服务；
- 单个 Tool Schema 仍限制为 50000 字符，单次发现仍限制 500 个 Tool，完整工具快照仍限制为 1900000 字符；工具名称、HTTPS endpoint、认证、超时和调用结果边界不变；
- Schema 先序列化为有界 JSON 再解析，取消递归遍历，避免深层 Schema 造成应用调用栈增长；凭据和 Schema 正文仍不进入普通日志。

## MCP 工具名称兼容增量（2026-09-14）

- 工具名遵循 MCP 命名规范，接受 1–128 个 ASCII 字母、数字、下划线、连字符和点号；Gateway 与 Application Registry 复用 Domain 中的同一规则；
- 远端原始名称保存在工具快照中并用于 `tools/call`。模型侧继续使用本轮唯一的安全别名，Provider 不直接接收带点号的远端名称；
- `tools/list` 的工具数量、单 Tool Schema 和完整目录体积限制保持不变。发现拒绝只记录固定原因、可信 Server ID、工具序号和大小元数据，不记录工具正文、Schema、远端响应或凭据。

## 普通会话记忆保存工具增量（2026-09-22）

- 内置 `zimo.memory.save` 仅由已登录的普通会话自动加入本轮模型工具集合；不由 Renderer、Workflow 定义或远程 MCP 注册。模型可在同一生成链路提交 `preference|goal|open_issue` 类别和最多 500 字符内容，Application 根据本轮账号快照和当前登录账号写入独立 `user_memories` 表；模型不能提交 owner ID。
- 工具参数严格拒绝未知字段，重复同类同文内容不新增、不重新启用停用项；总量仍限 100 条。副作用进入现有 Tool 开始/完成审计，仅记录参数键名、结果和 ID，不记录记忆正文。工具结果只返回是否新增。
- 首版不判断候选的长期价值、原文出处、冲突或敏感性。这是明确接受的记忆污染和隐私风险；设置页可删除/停用，后续补候选校验与用户确认。压缩摘要不再作为生产记忆写入来源。
