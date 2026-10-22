# 联网搜索与网页读取

## 用户能力

设置页的“联网搜索”支持配置 Tavily、Brave Search、公网 HTTPS SearXNG，或显式选择“当前模型原生搜索”。Tavily/Brave 的 API Key 保存到系统安全存储且不回显；SearXNG 保存账号隔离的服务地址。原生搜索复用当前会话所选模型的已保存凭据，无需单独搜索 Key。用户可先测试连接再保存；模型设置页另有“测试原生联网”，与普通对话连通性测试独立。

普通会话和 Workflow Agent 每轮都会获得两个简短 Tool 定义：

- `web_search`：输入查询词、结果数量和可选时间范围，返回标题、URL、摘要、来源域名和可选发布时间；
- `web_fetch`：输入一个已知公网 URL 和正文字符上限，返回 Readability 提取后的主要文本。

因此模型可以执行“搜索候选来源 → 读取少量可靠页面 → 综合回答”的多轮过程，而不需要 Zimo 用关键词判断天气、地图、新闻或其他业务类型。Tool 定义随模型请求发送，真正的 API Key、网络请求和正文处理只发生在 Main。

## 执行流程

```text
用户消息
  → Zimo 将 web_search / web_fetch Schema 放入 request.tools
  → 模型流式返回文本或 tool_calls
  → Application 校验本轮暴露名称与参数 Schema
  → Main 调用搜索 Provider、当前模型的原生搜索端点或安全网页读取器
  → 有界 Tool 结果作为 tool message 回传模型
  → 模型继续调用工具或输出最终回答
```

开发态启用 `ZIMO_LOG_LLM_PAYLOADS=1` 后，`conversation_tool_round` / `workflow_tool_round` 可看到本轮 Tool Schema 和模型返回的 Tool Call；普通日志不记录查询、URL、正文或结果。

原生搜索仍由稳定的 `web_search` Tool 触发：Main 对当前模型配置的同一网关发送独立 `/messages` 请求，携带 `web_search_20250305`，只将 `server_tool_use` 后的有效 `web_search_result` URL、标题归一化回 Tool。没有运行中模型连接时使用账号默认模型。普通聊天继续使用 Chat Completions；原生搜索不额外写入会话，也不会因模型仅输出“已搜索”的文本而判定成功。结果缺少摘要时明确提示使用 `web_fetch` 核实；部分搜索结果失败时模型设置页测试会显示部分成功。

原生搜索请求只提供 `web_search` 一个工具，并使用 `tool_choice: {type: "any"}` 要求模型实际调用。网关若未执行工具、工具只返回错误、或执行后没有有效来源，会分别给出不同错误；数组中的搜索错误也计入“部分结果出错”。

普通会话与 Workflow Agent 调用 `web_search` 时，如果原生搜索明确返回 `MODEL_NATIVE_SEARCH_UNSUPPORTED`，工具会给模型一个标记为 `ok=false/status=unavailable` 的结果，明确说明本次没有搜索来源，并提示本轮不要重复搜索。模型可继续使用独立的 `web_fetch` 读取已知可信的公开网址；若没有可核实的网址，应说明无法核实，不能编造来源。`web_fetch` 不是搜索引擎，无法保证发现未知页面。模型设置页“测试原生联网”仍严格报错，不会把这种回退判定为原生搜索成功；传输、鉴权、无有效来源及取消等其他错误也不会在会话中被静默降级。

## 安全边界

- 网页读取只有 GET，无自定义 Header、Cookie、请求体和写方法；
- Readability 与 `linkedom/worker` 仅在读取 HTML 时按需加载；worker 入口使用纯 JavaScript Canvas shim，正文提取失败时降级为有界纯文本，不影响应用启动；
- 拒绝 URL 内嵌凭据、自定义端口、本机/私网/保留地址，并逐跳检查重定向；
- 搜索 Provider 和原生搜索请求不跟随重定向，避免 API Key 外发；原生搜索只能连接已配置模型网关；
- 下载最多 2 MiB，输出最多 50000 字符，搜索最多 10 条；
- 网页正文属于不可信输入，不可覆盖系统指令或扩大权限；
- 取消会话会传播 AbortSignal，搜索 Tool 硬超时 45 秒、网页读取硬超时 60 秒。原生搜索测试限时 45 秒。

## 当前限制

- 不执行 JavaScript，不支持需要登录、验证码、点击或滚动加载的页面；这类需求未来应进入独立浏览器工具；
- 未提供网页截图、图片检索、文件下载和站内深度爬取；
- 搜索质量、地区覆盖和调用费用由用户选择的 Provider 决定；
- 原生搜索依赖网关兼容 `/v1/messages` 与 `web_search_20250305`；只支持网关返回的来源条目，`freshness` 筛选暂无严格保证。测试成功只证明本次请求返回了来源，不保证来源内容准确；重要信息仍需 `web_fetch` 核对；
- 首版没有语义 Tool Search，因为两个 Web Tool 的 Schema 很小，直接提供的 token 成本可控。

## 验证

- Application：账号隔离配置、SecretStore 保存/复用/删除、严格参数 Schema、稳定模型工具名；
- Main：三类响应归一化、HTML 正文提取、私网与元数据地址拒绝、重定向复检、响应体上限；
- Contract/Preload：三个具名配置 IPC，Renderer 不获得 Key、任意 URL fetch 或通用网络 IPC；
- 手工：分别使用真实 Tavily/Brave/SearXNG 配置，验证时效查询、搜索后读取、取消和服务端错误。
