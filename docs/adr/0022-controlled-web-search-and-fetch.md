# ADR 0022：受控网页搜索与公开网页读取

- 状态：Accepted（2026-09-22 补充原生搜索后端）
- 日期：2026-09-20

## 背景

Zimo 的模型服务使用 OpenAI-compatible Chat Completions，不能假定服务端实现 OpenAI、Anthropic 或其他厂商的原生联网搜索。用户需要一个与模型厂商解耦的 `web_search` / `web_fetch` 能力，并要求参考 [Abu-Cowork](https://github.com/PM-Shawn/Abu-Cowork) 的实现方式。

Abu 将模型可见的搜索 Tool 与实际搜索 Provider 分离，支持 Brave、Tavily、Bing 和 SearXNG；网页读取由宿主网络层执行并使用 Readability 提取正文。它还可在声明能力的模型上注入厂商原生搜索工具。Zimo 当前只采用前一种本地 Tool 路径，以免把 OpenAI-compatible 当作原生搜索能力。

## 决策

1. 注册两个稳定内置 Tool：`zimo.web.search` 对模型显示为 `web_search`，`zimo.web.fetch` 显示为 `web_fetch`。
2. 两个 Tool 默认进入普通会话和 Workflow Agent 的 Tool Calling 请求；模型依据 description 和 JSON Schema 自主决定是否调用，不使用用户文本关键词匹配。
3. `web_search` 通过独立 `WebSearchGateway` 适配 Tavily、Brave 和用户自建 SearXNG。配置按当前登录账号隔离；API Key 只进入 SecretStore，Renderer 只知道是否已经配置。
4. `web_fetch` 首版只允许 GET，不接受自定义 Header、Cookie、请求体或写方法，不继承浏览器登录态。HTML 按需加载 Mozilla Readability 与 `linkedom/worker` 提取正文；worker 入口使用纯 JavaScript Canvas shim，避免 Electron Main Bundle 探测可选原生 `canvas`。正文提取失败时降级为有界纯文本，其他文本按受限内容类型读取。
5. 所有 URL 在 Main 中校验协议、userinfo、端口和 DNS 结果，拒绝回环、私网、链路本地、保留地址和云元数据地址；每次公开网页重定向重新检查目标。携带搜索凭据的 Provider 请求拒绝重定向，避免跨域泄露 Key。
6. 单次响应下载上限 2 MiB，模型结果正文最多 50000 字符；搜索最多 10 条。调用复用现有 Tool 超时、取消、输出上限、流式 Tool Loop 和脱敏审计。
7. 普通日志只记录 Tool ID、参数键名、耗时、结果和错误码，不记录查询词、URL、网页正文、搜索结果或 API Key。
8. 用户可显式选择“当前模型原生搜索”作为 `web_search` 的第四种后端。该后端仅在 Main 通过当前运行模型的连接信息向同一网关发起独立 `/messages` 请求；普通对话仍为 Chat Completions。模型设置页提供具名原生搜索测试，必须观察到 `server_tool_use` 和有效来源才能判定支持。原生搜索不储存额外密钥、不自动探测、不静默切换到其他搜索后端，并拒绝网关重定向。普通会话中的 `web_search` 若明确收到 `MODEL_NATIVE_SEARCH_UNSUPPORTED`，向模型返回 `ok=false/status=unavailable` 的工具结果；模型只能再尝试 `web_fetch` 读取已知公开 URL，不能把文本答复、猜测的网址或未读取的页面当作搜索结果。其他原生搜索故障、取消和模型设置页测试继续按错误处理。
9. 原生搜索请求仅提供一个搜索工具并设置 `tool_choice: {type: "any"}`，避免模型只给文字答复；网关返回的数组或对象形式工具错误均须单独识别，不得将工具错误误报为“未执行搜索”。

## 结果与限制

- 搜索服务可独立替换，不绑定模型 Provider，也无需为天气、地图、新闻等类别分别实现关键词路由。
- `web_fetch` 不是浏览器自动化：不执行页面 JavaScript、不处理登录、验证码或交互式页面。
- DNS 检查和实际 Node 请求尚未做到地址级连接固定，理论上仍存在 DNS rebinding 时间窗；正式发布前应改为固定解析结果的受控网络代理。
- 网页和搜索摘要是不可信资料，只能作为回答依据，不能授予 Tool、文件、命令或凭据权限。
