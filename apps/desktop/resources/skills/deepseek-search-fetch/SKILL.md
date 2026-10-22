---
packageId: zimo.deepseek-search-fetch
name: deepseek-search-fetch
version: 1.0.0
description: 指导在 DeepSeek 网关下用 web_search 与 web_fetch 完成检索与网页读取，并说明官方 Search/Fetch API 边界。
category: 联网
---

# DeepSeek 联网 Search/Fetch

本 Skill 用于需要**联网检索、打开公开网页、核对来源**的任务。在 Zimo 桌面中，网络请求只由 Main 发起；模型通过会话已绑定的 **`web_search`** 与 **`web_fetch`** 工具完成，不要在回复中伪造 curl、密钥或“已调用某 HTTP 接口”的叙述。

## 何时启用

- 用户要求查最新信息、新闻、政策、价格、文档或任意需核对的公网内容；
- 当前会话模型 API 地址指向 DeepSeek 官方或兼容网关（常见基址含 `api.deepseek.com` 或用户自建反向代理）；
- 设置中已配置可用的联网搜索（Tavily/Brave/SearXNG/**当前模型原生搜索**之一），或会话仍可使用 `web_fetch` 读取已知 URL。

缺少上述条件时，先说明无法联网核实，只基于已有上下文回答，并提示用户在设置中配置模型与联网搜索。

## 推荐流程

1. **先搜后读**：用 `web_search` 提出明确查询词，结果数量保持较小（通常 3–5 条），必要时带时间范围。
2. **再核实**：对 1–2 个权威或官方 URL 调用 `web_fetch`，提取正文后再综合回答。
3. **引用来源**：最终回答列出标题与 URL；摘要不足时以 fetch 正文为准，不编造未出现的细节。
4. **失败处理**：搜索无结果、原生搜索不可用或 fetch 被拒绝时，如实说明；可请用户提供更具体的 URL 或关键词，不要重复无效搜索刷屏。

## 与 DeepSeek 官方 API 的关系

DeepSeek 文档中的服务端点为：

- Search：`POST https://api.deepseek.com/v1/tools/search`
- Fetch：`POST https://api.deepseek.com/v1/tools/fetch`

Zimo **不会**把 API Key 交给模型或 Skill 正文去直接请求上述 URL。应用层将能力收敛为稳定的 `web_search` / `web_fetch` Tool；若网关支持 DeepSeek 原生 Search/Fetch 或兼容实现，由 Main 在工具执行时对接。

需要请求/响应字段、错误码或与官方 Schema 对齐的细节时，读取本 Skill 资源 **「读取 Skill 资源：DeepSeek 联网 Search/Fetch」** 下的 `references/api-endpoints.md`（不要假设仓库外路径）。

## 禁止事项

- 不输出、不猜测用户或系统的 API Key、Bearer Token、完整请求头；
- 不调用 Shell、任意 HTTP 客户端或 MCP 去绕过 Zimo 的 `web_search` / `web_fetch`；
- 不把搜索摘要当作事实而不经 fetch 或权威来源交叉验证（尤其涉及金额、日期、法规、医疗与安全）；
- 不尝试访问内网、localhost、带凭据的 URL 或需要登录的页面（当前 `web_fetch` 不支持）。

## 输出风格

- 中文用户默认中文回答；保留英文专有名词与原始 URL；
- 结构清晰：结论 → 要点 → 来源列表；
- 若仅部分来源可用，标注“部分链接未能读取”。
