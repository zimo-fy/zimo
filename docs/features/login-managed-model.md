# 登录账号托管模型

状态：已实现，待真实服务人工验收。

## 用户体验

首次打开时，欢迎页不再展示账号密码表单。点击「开始使用 Zimo」进入模型配置，保存可用模型后进入对话主页；左右分栏布局保持不变。凭据仍由 Main 在后台建立会话并写入 SecretStore，Renderer 不展示登录密码。

已登录用户再次打开时，仍使用系统中已经保存的模型标识、显示名称和 API 地址，并只更新登录下发的 API Key。打包环境的设置页只读展示这份配置并允许测试连接，不能手动新增、编辑或删除模型。

通过开发服务器运行时，设置页允许修改当前托管模型的模型标识、API 地址和是否支持图像模式，并可选输入一个新 API Key。保存后显示名称与模型标识保持一致。当前 Key 永不回显；新 Key 留空时继续使用登录账号下发的凭据，填写后只瞬时经过严格 IPC，并由 Main 写入 SecretStore。开发入口不能新增或删除 Provider，也不能修改启停状态或默认模型。

模型标识、显示名称和 API 地址只来自系统中已经保存的托管模型配置。登录只轮换密钥。还没有完整配置时，登录仍然成功，应用提示「请先配置模型再使用」并打开设置中的模型配置。模型配置可以设置是否支持图像模式，对应会话发送图片时使用的视觉能力。

## 执行链路

1. `ZimoHttpAuthGateway` 严格解析登录响应，要求同时存在 Token、`modelApiKey` 和用户 ID；
2. `ZimoAuthProvider` 安全保存 Token，仅把 `{ session, modelApiKey }` 返回 Application；
3. Main 调用 `ModelConfigurationService.provisionManagedZimoModel`，为模型密钥生成独立 `secretRef` 并写入 SecretStore；
4. SQLite 中已有的模型标识、显示名称和 API 地址保持不变，只更新 `secretRef` 和 Key 尾号，并把该托管模型设为默认。三者尚未齐全时写入空配置并保持模型停用，登录仍然成功；
5. 登录 IPC 只返回 `AuthSessionView`，`modelApiKey` 在 Main 处理结束后不再向外传播；
6. 模型密钥写入失败时清理新密钥、退出认证会话并返回失败。配置为空时登录成功，界面提示「请先配置模型再使用」并打开设置中的模型配置；
7. 退出登录时停用托管 Provider 并删除模型密钥。

为保留 Conversation/Agent 外键完整性，旧的自定义 Provider 不做物理删除；成功登录后它们会被停用，且托管模式的 `models.list` 不返回它们。旧会话如果仍引用历史模型，用户需要改选当前 DeepSeek 模型。

## 恢复与升级

`/verify-token` 当前只验证登录 Token，不重新下发 `modelApiKey`。因此升级前已恢复的登录会话若没有托管模型密钥，应用会清除会话并要求重新登录一次。之后 Token 和模型密钥均能从各自安全引用恢复。

开发服务器的设置页可以保存 HTTPS 或 loopback HTTP(S) 地址。该入口要求 Main 检测到开发服务器。生产包拒绝模型 mutation，并继续使用已保存的配置。

## 安全与日志

- 当前 `modelApiKey` 不进入 Renderer、Preload 返回值、SQLite 明文、普通日志或 LLM payload 日志；开发者主动输入的新 Key 仅瞬时存在于表单和严格 IPC 请求，保存后清空表单并进入 SecretStore；
- Token 与模型密钥使用不同 SecretStore 引用，生命周期分别由认证与模型服务管理；
- 日志只记录 `model.provider.managed`、Provider ID 和结果，不记录 Key、尾号、地址或响应正文；
- 自动测试使用 canary 扫描 Renderer 响应、SQLite、日志和加密 secrets 文件明文。

## 验收

1. 使用登录接口返回 `modelApiKey` 的账号登录；
2. 打包环境设置页只显示 `DeepSeek V4 Flash`、固定 API 地址和“由登录账号安全下发”；开发服务器显示模型标识、API 地址和可选新 Key 输入框；
3. “测试连接”成功，新任务默认使用该模型；
4. 打包页面不存在添加、编辑、删除模型或输入 API Key 的入口；开发入口只能更新固定托管模型，且不回显当前 Key；
5. 重启后会话与模型可恢复；退出后重新进入登录页，模型密钥已清理；
6. 缺少 `modelApiKey` 的登录响应必须整体失败。
