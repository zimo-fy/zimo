# Zimo 统一身份认证

状态：已实现；远程服务地址由部署配置决定，仓库内不硬编码生产 URL。

## 用户流程

当前桌面默认通过欢迎页「开始使用 Zimo」进入本地引导会话（开发/E2E 环境），用户随后在模型配置中保存 API 地址与模型标识后再进入对话。

如需对接 xclaw-manager 兼容的远程认证，Main 进程在配置了认证基址后按 `application/x-www-form-urlencoded` 协议请求：

1. `POST {authBaseUrl}zimoLogin`，字段为 `username`、`password`；
2. 校验业务成功状态、Token、`modelApiKey`、用户 ID 和有界用户资料；
3. Token 与 `modelApiKey` 使用不同随机引用写入 Electron `safeStorage` 支持的加密 SecretStore；
4. SQLite 只保存本地会话 ID、云端用户 ID、账号展示信息、过期时间和随机 `token_secret_ref`；
5. 应用恢复会话时调用 `GET /verify-token`，使用 Bearer Token 校验，失效或用户不一致时清除本地会话；
6. 退出登录同时删除 SQLite 会话、Token 和当前账号的模型密钥，并停用托管模型。

xclaw 登录后的 OpenClaw 工作目录准备与 Gateway 启动不属于 Zimo 的认证职责，本次没有复制。登录响应中的 `modelApiKey` 由 Main 写入已保存托管模型的密钥。模型标识、显示名称和 API 地址只读取该配置。认证 IPC 不返回该字段，Renderer 无法读取。

## 安全与失败语义

- Renderer 只经具名 `auth.login` IPC 发送一次凭据，不保存 Token 或密码；
- 未配置远程认证基址时，账号密码登录返回配置错误；开发环境仅允许 `ZIMO_AUTH_BASE_URL` 指向 loopback HTTP(S) 假服务；
- 登录和校验请求 15 秒超时、拒绝重定向，响应限制为 256 KiB；
- SecretStore 不可安全持久化时，在发起登录网络请求前拒绝操作；模型密钥保存或模型元数据写入失败时回滚本次登录；
- 401/403 或业务 `success=false` 映射为凭据错误，网络/5xx 与畸形响应提供可重试错误；
- 普通日志只记录认证/托管模型结果与安全错误码，不记录账号、密码、Token、`modelApiKey`、认证头或响应正文。

## 兼容性与验证

`0014_remote_auth_session.sql` 为既有 `user_sessions` 增加远程认证元数据。升级后的旧 Mock 会话不会继续作为有效会话，用户需使用真实账号重新登录。

自动测试覆盖严格 IPC、Token/密码/模型密钥不进入 Renderer、SQLite 或日志，另覆盖 SecretStore 不可用、缺少 `modelApiKey` 的畸形响应、远端拒绝清理、xclaw 表单协议、Bearer 校验、登录托管模型、重载与退出。升级后已有登录会话因校验接口不补发模型密钥，需要重新登录一次。对接真实认证服务与真实账号仍需人工 smoke。
