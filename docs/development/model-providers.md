# 登录托管模型兼容范围

## 当前生产配置

Zimo 不再要求用户在登录时填写模型 API Key。统一登录成功后，Main 从认证响应中取得 `modelApiKey`，并读取系统中已保存的托管模型：

- API 地址、模型 API 名称和显示名称都来自这份已保存配置；
- 协议：OpenAI-compatible Chat Completions；
- 能力：文本流式输出和标准 Tools / Function Calling；
- 应用声明的最大上下文：1,200,000 tokens。

该模型自动设为默认。打包环境的设置页只读展示配置并提供连接测试，不提供增加、编辑、删除、切换地址或修改能力的入口。历史 Provider 为保证数据库引用完整性不会被删除，但登录后会被停用且不会返回 Renderer。

开发服务器设置页可以保存当前托管 Provider 的模型 API 名称、HTTPS/loopback 地址、图像模式和可选新 Key；留空不会替换登录 Key，当前 Key 不回显。保存模型标识时，显示名称同步为该标识。该入口不能新增 Provider 或改变模型 ID、启停与默认状态。打包后的生产应用隐藏编辑入口并由 Application 拒绝 mutation。没有已保存配置时，登录不会创建模型地址或名称。

## 已验证协议

- `POST <baseURL>/chat/completions`；
- Bearer API Key；
- 普通 JSON completion，用于连接测试和 Router；
- `text/event-stream` Chat Completions chunks 与 `[DONE]`；
- 文本 delta 与可选 token usage；
- OpenAI-compatible `tools`、assistant Tool Call 和 Tool result；
- AbortSignal 中止；
- 401/403、429、其他 HTTP 与网络错误的安全映射。

LangChain 的 `ChatOpenAI` 以 `streamUsage:false` 运行，避免要求兼容端点实现 `stream_options`。Router 使用普通 Chat Completion 请求 JSON 文本，并在 Application 边界执行严格 Schema 校验；非法输出会在 800ms 总预算内降级为普通聊天。

1,200,000 tokens 是 Zimo 当前托管配置的预算上限，不代表 Adapter 能验证供应商的真实容量。Application 在预计完整请求达到 80% 时执行检查点压缩，90% 时失败关闭，并预留 120,000 tokens 给输出和估算误差。首版估算不是供应商 tokenizer 的精确结果；如果服务端实际限制更小，应同步下调模型能力配置。

## 不承诺兼容

- OpenAI Responses API 专有功能；
- Azure OpenAI 特有 URL、部署和鉴权格式；
- 厂商私有工具协议、reasoning 请求/响应、缓存或非标准响应字段；
- 多模态图像输入仅在解析模型 `capabilities.vision` 为真时启用：本轮用户消息使用 OpenAI-compatible `content` 数组（`text` + `image_url` data URL）。不支持图像的模型拒绝发送，提示更换模型。历史消息、SQLite、IPC 和普通日志不保存 Base64；
- 自动重试与 Provider fallback；
- OAuth、组织级 Header 或自定义 Header；
- 用户自行添加其他模型或 Provider。

如服务端修改了标准 Chat Completions 字段，应新增专用 Adapter 或 contract fixture，不得把厂商对象泄露到 Domain、IPC 或数据库。

## 数据与安全

登录下发的 `modelApiKey` 只从登录 Adapter 返回到 Application/Main 内存链路，认证 IPC 仍只返回安全会话视图。开发者主动填写的新 Key 只瞬时经过表单和严格模型配置 IPC，保存后页面立即清空。Main 使用新的随机 `secretRef` 将 Key 交给 Electron safeStorage 加密；SQLite 仅保存引用和 Key 尾号。保存模型失败会清理新密钥，替换成功后删除旧引用，退出登录会停用托管 Provider 并删除对应密钥。普通日志、LLM payload 日志和远端错误信息均不得包含 Key。
