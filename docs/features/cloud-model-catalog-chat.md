# 聊天云端模型目录

状态：对话页已不再请求云端模型目录。

## 行为

聊天页模型下拉只加载本机已启用模型（`models.list`，含登录托管模型）。进入页面不会调用 `GET ai/model/all`。云端目录方法会直接拒绝，不会发出该请求。

选择本机模型仍调用 `conversations.changeModel`。已经保存在当前会话上的云端快照继续显示，并沿用其中的图像与推理标记；再次点选该快照不会重新请求目录。切回本机模型后，快照按原逻辑清空。

原先选择云端模型会调用 `conversations.selectCatalogModel`，把 catalog 快照写入 `conversations` 表，发消息时使用登录托管 Provider 的 Key 与 baseUrl，以及快照里的 `modelCode`。

云端行的 `supportReasoning` / `supportImages`（`Y`/`N`，缺省为 `N`）映射为会话快照的 `supportsReasoning` / `supportsImages`，并覆盖本轮解析模型的 `capabilities.reasoning` / `capabilities.vision`。`vision` 为真时，本轮 PNG/JPEG/WebP 附件会编进 Chat Completions 的 `image_url` data URL；为假时拒绝发送并提示更换模型。详见 [聊天图像输入](chat-vision-images.md)。

会话 catalog 字段由 `0039_conversation_catalog_model.sql` 增加，`0044` 增加 `catalog_model_vision`；已安装的早期构建若将 0039 SQL 记为版本 38，启动时会在名称和 checksum 精确匹配后调整 migration 账本，不重放 SQL。切回本地模型时清空包括图像标记在内的 catalog 列。

对话页不再因为云端目录失败而提示重试。本机模型列表独立加载。

## 安全

Renderer 不直接访问云端 URL；响应正文不进普通日志。目录分页与响应大小有上限。

## 验收

1. 进入对话页只看到本机已启用模型，且不请求 `ai/model/all`；
2. 本机模型的图像能力仍由该模型的 `capabilities.vision` 决定；已保存的会话快照仍按其 `supportsImages` 决定本轮能否发送图片；
3. 切回本机模型后 catalog 字段清空；
4. 设置页与 `models` 表不出现云端同步写入。
