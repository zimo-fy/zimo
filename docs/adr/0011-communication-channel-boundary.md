# ADR 0011：通信渠道与第三方登录边界

- 状态：Accepted
- 日期：2026-09-07

## 背景

产品需要通过个人微信或邮箱通知用户 Workflow 和重要任务的执行结果。原 Plugin 页面只是内存 Mock，不能承担凭据存储、网络登录、超时取消和通知投递职责。

腾讯提供的 `@tencent-weixin/openclaw-weixin-cli` 是 OpenClaw 插件安装器：它检测 OpenClaw 版本、安装实际 channel plugin 并调用 OpenClaw CLI 登录。直接把它放入 Zimo 安装包仍会依赖用户机器上的 OpenClaw、Gateway 和 shell，不构成可用的内置渠道。

## 决策

1. 菜单仍沿用内部路由键 `plugin` 兼容旧导航状态，但产品名称改为“通信渠道”，并使用独立领域模型、Repository、Application Service 和具名 IPC。
2. 内置渠道固定为 `weixin` 与 `email`，用户不能动态安装代码、创建任意渠道或提交任意执行命令。
3. 微信 Adapter 依据腾讯开源 channel 的登录协议实现受控兼容层，只访问固定 `https://ilinkai.weixin.qq.com` 及校验后的 `*.weixin.qq.com` HTTPS 跳转；不执行 `npx`、OpenClaw CLI 或 Gateway 子进程。
4. 微信二维码会话仅存在 Main 内存，最长 5 分钟；Renderer 只获得 PNG data URL、随机 session ID、过期时间和枚举状态。bot token 永不返回 Renderer。
5. 邮箱绑定只登记经 strict Schema 校验和规范化的完整邮件地址，不登录邮箱、不发起网络连接，也不收集密码、授权码或 SMTP/IMAP 配置。邮件入站属于后续独立能力，不能以“已绑定”伪装为已能收件。
6. 微信 token 进入 SecretStore；邮箱地址直接作为普通绑定元数据保存，不创建秘密。SQLite `communication_channel_bindings.secret_ref` 对微信绑定必填、对邮箱绑定可空；`0011` 以前的邮箱秘密在重新添加或解绑时清理。
7. 微信更新凭据时先写新 secret，再写数据库，失败时补偿删除；成功切换后清理旧 secret。邮箱重新登记先保存新地址，成功后再清理可能存在的旧 SMTP secret。
8. 绑定、解绑写审计事件，但不记录 token、二维码内容、验证码或完整响应。
9. Phase 7.3 的微信入站只由 Main 生命周期管理的内置 Adapter 运行，不属于 Automation Scheduler，也不把通信渠道暴露为模型 Tool。绑定以可信登录会话的 `externalUserId` 隔离；切换账号、退出、解绑和应用退出必须取消长轮询。
10. `getupdates` 游标、最近一次 `context_token` 与收件人标识和 bot token 一同进入 SecretStore；SQLite 只保存账号到“微信助手”会话的映射和不含正文的去重收据。处理完成后保存游标，重启重放由收据幂等过滤。
11. 每条文本进入该账号固定的无附加能力普通会话，并以这条入站消息自己的 `context_token` 回复。微信输入不能远程绑定 Agent、Skill、Workflow、MCP，不能绕过 Tool 确认，也不改变 Router `shouldExecute=false`。
12. “发送测试消息”复用最近一次有效入站上下文；没有上下文时返回需要先从微信发消息激活的用户错误，不伪装为已投递。

## 结果

Zimo 不依赖系统 shell 或外部 OpenClaw 安装即可完成微信扫码绑定；邮箱登记也不受服务商 SMTP、Fake-IP DNS 或授权码策略影响。代价是邮箱“绑定”只建立地址身份，不能据此读取邮件。邮件入站仍需单独选择 IMAP/OAuth 或受控入站服务，并补充发件人授权、去重、附件和会话映射策略。
