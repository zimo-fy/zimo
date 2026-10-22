# DeepSeek Search / Fetch API（参考）

本文档供在 Zimo 内理解 DeepSeek 官方联网工具边界；**实际执行仍通过会话的 `web_search` 与 `web_fetch`**，由 Main 持有凭据并发请求。

## 端点

| 能力 | 方法 | URL |
| --- | --- | --- |
| Search | POST | `https://api.deepseek.com/v1/tools/search` |
| Fetch | POST | `https://api.deepseek.com/v1/tools/fetch` |

完整 JSON Schema、字段说明与错误码以 DeepSeek 开放平台当前文档为准（Search API Reference、Fetch API Reference）。

## 典型协作方式

1. **Search**：根据自然语言查询返回候选网页列表（标题、URL、摘要等，以官方响应为准）。
2. **Fetch**：对单个 HTTPS 公网 URL 拉取可读正文或结构化片段（以官方响应为准）。
3. 先 Search 缩小范围，再 Fetch 1–2 个关键页面，避免对大量 URL 逐个 Fetch。

## 在 Zimo 中的映射

| 用户/模型侧 Tool | 职责 |
| --- | --- |
| `web_search` | 关键词检索，返回有界条目的标题、URL、摘要、来源 |
| `web_fetch` | 对已知 URL 做 GET + 正文提取，字符数有上限 |

设置页选择 **「当前模型原生搜索」** 时，Main 可能向模型网关的 `/v1/messages` 或兼容路径发起独立探测；与上表两个 POST 端点是否一一对应取决于网关实现。会话内仍以 Tool 结果为准，不要向用户宣称绕过了 Zimo 工具层。

## 安全与合规

- 密钥只存在于用户配置的模型 Provider 与（若启用）搜索 Provider 的 SecretStore 引用中；
- 不向日志、Renderer 或 Skill 指令中写入 Key；
- 只处理用户任务相关的公开信息检索，不批量爬取、不绕过 robots 或服务条款。
