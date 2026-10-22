# MCP 凭据目录

## 当前交互

MCP 页面合并展示经过核对的公网 HTTPS 服务目录与用户已保存的自定义服务。页面支持按名称、描述和地址搜索，也可筛选全部、已连接或未连接；已连接服务始终排在未连接服务前，同一状态内保持目录顺序。用户点击“编辑”后进入独立配置页，也可通过“新增 MCP”填写名称、公网 HTTPS endpoint 和认证方式。

Bearer、Header Token、API Key Header 和 Query Key 服务先执行“测试连接”，测试只运行 MCP `initialize` 和 `tools/list`，不会写入连接表或 SecretStore；通过后才能保存。OAuth 服务点击“连接并授权”，在系统浏览器完成授权后直接保存。免认证服务同样先测试、后保存。SQLite 只保存不含凭据的基础 endpoint、secret ref、连接元数据和工具快照。

手动新增当前只接受 Streamable HTTP 公网 HTTPS Server，认证限无需认证、Bearer Token 和标准 OAuth。用户不能配置任意 Header、Query 参数、私网地址或 stdio/CLI 命令；厂商专用 Header/Query 继续由 Main 受信目录管理。

企查查公司服务使用固定 `https://agent.qcc.com/mcp/company/stream` 和 Bearer Token。腾讯会议使用固定 `https://mcp.meeting.tencent.com/mcp/wemeet-open/v1`，Main 注入 `X-Tencent-Meeting-Token` 与当前内置 `X-Skill-Version`；Renderer 不能提交 Header 名称或覆盖目录地址。

麦当劳中国使用固定 `https://mcp.mcd.cn` 和 `Authorization: Bearer <MCP Token>`。编辑页固定 endpoint 与 Header 规则，只允许用户填写 Token 本身；SecretStore 中的既有 Token 不回显，更换 Token 后必须重新测试连接并保存。

## 当前目录

| 服务            | 固定 HTTPS endpoint                           | 认证方式           |
| --------------- | --------------------------------------------- | ------------------ |
| 企查查          | `https://agent.qcc.com/mcp/company/stream`    | Bearer             |
| 腾讯会议        | `https://mcp.meeting.tencent.com/.../v1`      | 专用 Header        |
| GitHub          | `https://api.githubcopilot.com/mcp/`          | MCP OAuth          |
| Sentry          | `https://mcp.sentry.dev/mcp`                  | MCP OAuth          |
| Hugging Face    | `https://huggingface.co/mcp`                  | Bearer             |
| Context7        | `https://mcp.context7.com/mcp`                | Bearer             |
| Microsoft Learn | `https://learn.microsoft.com/api/mcp`         | 无                 |
| 腾讯文档        | `https://docs.qq.com/openapi/mcp`             | `Authorization`    |
| 高德地图        | `https://mcp.amap.com/mcp`                    | Query `key`        |
| 千图 AI         | `https://mcp.58pic.com/mcp`                   | Bearer             |
| EdgeOne Pages   | `https://mcp-on-edge.edgeone.site/mcp-server` | 无                 |
| 有活招工        | `https://mcp-server.hopped.com.cn/b/mcp`      | 工具内微信扫码     |
| 盈米基金        | `https://stargate.yingmi.com/mcp/v2`          | Header `x-api-key` |
| 滴滴出行        | `https://mcp.didichuxing.com/mcp-servers`     | Query `key`        |
| 今日投资        | `https://data-api.investoday.net/data/mcp`    | Query `apiKey`     |
| 麦当劳中国      | `https://mcp.mcd.cn`                          | Bearer             |
| UAPI            | `https://uapis.cn/mcp`                        | Header `X-API-Key` |

国内目录依据服务商或服务团队公开接入资料维护：[腾讯文档](https://developer.cloud.tencent.com/mcp/server/11803)、[高德地图](https://lbs.amap.com/api/mcp-server/gettingstarted)、[千图 AI](https://developer.cloud.tencent.com/mcp/server/11821)、[EdgeOne Pages](https://developer.cloud.tencent.com/mcp/server/10011)、[有活招工](https://developer.cloud.tencent.com/mcp/server/11825)、[盈米基金](https://developer.cloud.tencent.com/mcp/server/11801)、[滴滴出行](https://cloud.tencent.com/developer/mcp/server/11746)、[今日投资](https://developer.cloud.tencent.com/mcp/server/11814)、[麦当劳中国](https://open.mcd.cn/mcp/doc) 和 [UAPI](https://github.com/AxT-Team/uapi-mcp)。其他保留服务继续依据 [GitHub](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/extend-copilot-chat-with-mcp)、[Sentry](https://github.com/getsentry/sentry-mcp)、[Hugging Face](https://huggingface.co/docs/hub/en/agents-mcp)、[Context7](https://context7.com/docs/resources/all-clients) 和 [Microsoft Learn](https://learn.microsoft.com/en-us/training/support/mcp) 官方资料维护。厂商变更 endpoint、授权协议或客户端准入规则时必须更新受信 Main 目录并重新验证。

企业微信、Notion、Linear、Stripe、Canva 和 Atlassian 目录项已移除。应用升级启动时会清理这些服务此前保存的连接、活动绑定和 SecretStore 凭据。

固定 Header/Query 名称只存在于 Main 受信目录。Renderer 只提交目录 ID 与有界凭据；Gateway 每次请求临时构造 Header 或带 Key 的 URL，不把完整 URL持久化或写入普通日志。

MCP 工具名称按协议接受 1–128 个 ASCII 字母、数字、下划线、连字符或点号。腾讯文档的 `doc.*`、`smartcanvas.*`、`smartsheet.*` 等命名空间工具会以服务端原名保存和调用；暴露给模型时仍使用本轮生成的安全别名，避免模型 Provider 对函数名字符集的额外限制。

## 滴滴价格预估返回边界

滴滴 `taxi_estimate` 的结构化响应可能包含大规模内部明细。Zimo 在 Main Gateway 收到结果后，仅保留官方下单流程需要的 `traceId`、`items[].productName`、`items[].productCategory` 和 `items[].priceText`，其余字段不进入 Application、模型上下文、持久化或日志。若结构化响应缺少上述必要字段，则降级使用服务端提供的有界文本内容；其他滴滴 Tool 和其他 MCP Server 不应用该投影。

## 腾讯会议接入边界

腾讯会议官方 Skill 的 Python 代理负责注入 Token、版本 Header 并转发远端 MCP。Zimo 已有 Streamable HTTP Client，因此直接在 Main Adapter 完成相同的受控 Header 注入，不安装或执行该 Python Skill。

腾讯会议和其他 MCP Server 使用同一目录策略：Zimo 保存 `tools/list` 返回的全部工具，不按厂商或工具名称过滤。`schedule_meeting`、`update_meeting`、`cancel_meeting` 等写操作会进入本地快照，并在会话、Agent 或 Workflow 授权整个 Server 后提供给模型。

当前测试期把用户选择 Server 视为对该快照中全部工具的授权，不逐工具弹出确认。调用仍经过本轮授权校验、参数 Schema、有界 JSON、20 秒超时、取消、输出上限和脱敏审计。用户应使用可信 Server 和最小权限 Token；正式发布前仍需为高风险远程写操作补充独立确认策略。

会话当前最多直接绑定 300 个 MCP Tool，足以覆盖腾讯文档现有 224 个工具的完整快照。该容量用于测试全量工具暴露效果，不替代后续的 Server ID 持久化、Toolset 授权和语义 Top-K 筛选。

## 后续扩展

新增服务继续采用“目录元数据 + 固定认证适配 + 通用 MCP 生命周期”的方式。厂商差异只停留在可信 Main 配置，不允许 Renderer 提交任意秘密 Header；模型侧仍只看到已保存并绑定到会话、Agent 或 Workflow 的 Tool。

## 验证

- strict IPC 接受腾讯会议固定 Header Token，拒绝自定义 Server 使用该认证类型；
- Main 使用受信目录覆盖 Renderer 提交的名称、endpoint 和认证方式，未知目录 ID 会被拒绝；
- probe 不保存 Repository 或 SecretStore；
- probe、保存和刷新均保留腾讯会议 `tools/list` 返回的查询与写入工具；
- Header 构造测试断言 Token 和 Skill 版本字段；
- 保存后沿用现有会话、Agent、Workflow MCP 选择和 Tool Calling 链路。
- `0018` 扩展既有 `mcp_connections.authentication` CHECK，升级用户可保存 `header_token`；`0020` 再增加 `api_key/query_token`，两次迁移都保留已有连接与 Agent/Workflow 绑定。
- 腾讯文档连接回归覆盖带点号工具名；发现拒绝通过 `mcp.discovery.response.rejected` 记录固定原因和大小元数据，不记录 Token、Schema 或响应正文。
