# 聊天图像输入

状态：已实现，待登录环境人工验收。

## 行为

会话「添加文件」和拖放支持 PNG、JPEG（`.jpg` / `.jpeg`）和 WebP。文件仍复制到受控文档工作区，Renderer 只拿到 opaque artifact ID、文件名和格式，不拿到路径或 Base64。

对话气泡、待发送草稿和预览对话框通过受控协议 `zimo-doc://v1/<conversationId>/<artifactId>/<revisionId>` 展示图片。Main 只对 PNG/JPEG/WebP revision 返回字节；非图像、错误 ID 和路径逃逸一律 404。CSP `img-src` 允许 `zimo-doc:`。

发送时：

1. 当前解析模型的 `capabilities.vision` 为真时，本轮用户消息编译为 OpenAI Chat Completions 多模态 `content`：`text` 与 `image_url`（`data:image/jpeg|png|webp;base64,...`），由 LangChain `ChatOpenAI` 原样转发。本机模型使用自身的 `vision` 标记；开发服务器的模型配置可以用「是否支持图像模式」修改该标记。会话上已保存的云端快照仍用其 `supportsImages` 覆盖该标记，直到用户改选本机模型；
2. `vision` 为假时拒绝发送，用户可见提示为「此模型不支持图像输入。请尝试其他模型」，可关闭。

图像不写入 SQLite 消息正文，不进入文档 Tool 文本预览，也不进入普通日志。开发态 LLM payload 日志会把 data URL 替换为 `[REDACTED_IMAGE]`。历史轮次仍只发送文本；后续追问若未再次附加图片，模型看不到上一轮像素。

## 安全

- 导入做魔数校验，拒绝扩展名伪装；
- data URL 只在 Application 编译后、Adapter 请求内存中存在；
- IPC、Renderer 和 SQLite 不保存 Base64。

## 验收

1. 选择 `capabilities.vision` 为真的本机模型，或保留 `supportsImages` 为真的既有会话快照，附加 JPEG 并提问「这张图片里有什么？」后，请求体含 `image_url`；
2. 切换到不支持图像的模型后发送同一附件，顶部出现上述中文提示，不创建成功回复；
3. 普通日志与 SQLite `messages.content` 不含 Base64；
4. 发送后的用户气泡和点击预览都能看到原图，而不是「没有可预览的文本内容」。
