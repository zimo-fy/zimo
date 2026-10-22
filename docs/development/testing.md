# 测试策略

## 测试金字塔

Vitest 承担纯单元、Repository contract 和 Main 集成测试；Playwright Electron 模式承担少量关键 E2E。测试默认离线、确定性运行，真实模型仅放入手动 smoke profile，CI 不依赖外部 API 或个人密钥。

| 层          | 目标                                           | 依赖                               |
| ----------- | ---------------------------------------------- | ---------------------------------- |
| Unit        | 领域规则、路由、映射、reducer、脱敏            | 无 IO，fake clock/id               |
| Contract    | Mock/SQLite Repository、Model Adapter 事件契约 | 临时 DB、假 HTTP server            |
| Integration | Main+DB、IPC 校验、取消、迁移                  | Electron/Main 或 Node 环境         |
| Component   | UI 状态、表单、无障碍                          | jsdom + user events                |
| E2E         | 关键用户旅程与安全属性                         | 打包/开发 Electron + fake provider |

## 必测矩阵

### Unit

- Router：明确规则、歧义、LLM fallback、0.7 边界、禁用/缺失 target、800ms 超时、非法 Schema；
- Stream：厂商 chunk 映射、Unicode、多 content、usage、完成/取消/失败终态、重复事件；
- Conversation：状态转换、重新生成、幂等 requestId、会话 Agent 绑定、软删除；
- Error：每类外部错误映射、用户消息、retryable、序列化脱敏；
- Logging：深层 key/token/password/header/query/body 脱敏及循环对象；
- Schema：有效值、边界长度、未知键、恶意 URL、错误 ID。

### Integration

- migration 空库/逐版/重复/失败回滚；
- 每个 Mock 与 SQLite Repository 运行同一 contract suite；
- Main IPC sender、输入和输出校验，未注册 channel 拒绝；
- fake OpenAI-compatible SSE：正常、分片、错误帧、断线、慢响应、AbortSignal；
- 发送消息跨用户消息、assistant 占位、stream flush 的一致性；
- 应用重启恢复登录、会话、消息、Agent 绑定和未完成消息修复。

### E2E

- xclaw 协议登录、Bearer 校验、恢复、失效清理与退出；
- 创建会话、流式接收、停止、重新生成、重命名、删除确认；
- 选择 Agent 后直接发送；切换会话后恢复 Agent 及其派生 Skill且不重复确认；
- 配置 fake provider、测试连接、设默认及会话切换模型；
- Router 结果展示，Router 失败仍正常聊天；
- 主要模块导航、空/加载/错误/未开放状态；
- 窄窗口、键盘导航和核心 accessible name。

### Security

- Renderer 中 `process`、`require`、Node globals 不可用；
- `contextIsolation` 与 sandbox 生效；
- window API 只有批准的方法，不能传任意 channel；
- 非主 frame、伪造 sender 和非法 payload 被拒；
- API Key 不出现在 response、Redux/React query snapshot、DB、日志和错误；
- CSP 阻止 inline/eval/未知网络；导航、新窗口、webview 被阻止；
- 外链只接受用户触发的 HTTPS allowlist 行为；
- Markdown XSS payload 不执行。

## Fixtures

`packages/test-kit` 提供 builders、固定 Clock/ID、内存 SecretStore、Repository contract suite 和本地 fake OpenAI-compatible server。fixtures 不使用生产密钥或真实用户文本。每个测试独立临时目录/数据库，结束后清理。

## 流测试断言

不使用任意 sleep。fake provider 通过可控 deferred promise 推进 chunk；测试等待具体事件。断言事件 sequence、唯一终态、最终数据库正文和状态。取消测试覆盖取消先赢与完成先赢两种竞态。

## 覆盖率与门禁

初始门槛：Domain/Application statements/branches/functions/lines 均 85%；安全、路由降级、日志脱敏和流状态机关键文件 branches 95%。Adapter/UI 不以数字替代场景覆盖。任何回归修复先添加失败用例。

PR 门禁顺序：format → lint → typecheck → unit/contract → integration → build → 适用 E2E。失败不可通过重跑隐藏；flaky 测试需标记负责人和修复期限，不能永久跳过。

## 阶段验收

- Phase 0：Markdown 链接、必需文档和术语一致性检查；
- Phase 1：基础门禁、Mock auth E2E、安全 smoke；
- Phase 2：模型/流/DB contract 与聊天 E2E 全部通过；
- Phase 3：各 Mock Repository contract、导航和主要交互；
- Phase 4：Router 单元/评估集及降级 E2E。

测试命令将在 Phase 1 的根 `package.json` 固化为 `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:integration`、`pnpm test:e2e`。
