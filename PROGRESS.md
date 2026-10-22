# Zimo 开发进度

## 2026-10-19 移除桌面远程更新 URL

- 删除 `apps/desktop/package.json` 的 Electron Builder `publish` 配置、`electron-updater` 依赖及文档中的 OSS 更新地址；打包与应用内检查更新均不访问该通道。
- 验证：`apps/desktop/package-config.test.ts`。未跑 Desktop 全量打包。

## 2026-10-19 移除硬编码远程认证 URL

- 删除代码与文档中硬编码的生产远程认证 URL 与托管模型 API 地址；未配置 `ZIMO_AUTH_BASE_URL` 时远程登录返回 `AUTH_REMOTE_UNCONFIGURED`，开发默认走本地 onboarding。
- 验证：`auth-configuration.test.ts`、`auth-onboarding.test.ts`。未跑全量 E2E。

## 2026-10-19 开始使用引导模型配置

- 欢迎页去掉账号密码表单，保留左右布局；「开始使用 Zimo」进入模型配置，保存可用模型后进入对话主页。
- Main 新增 `zimo:auth:start-onboarding:v1`；开发/E2E 在后台建立会话，不在 Renderer 展示凭据。
- Phase One E2E 改为走 onboarding 流程。未跑全量 E2E。

## 2026-10-19 模型配置保存同步显示名称

- 开发服务器保存托管模型时，`displayName` 改为与模型标识一致，不再保留上一次的显示名称。
- 验证：托管模型单测。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-19 空模型配置引导到设置

- 模型标识或 API 地址还没保存时，登录后提示「请先配置模型再使用」，并打开设置中的模型配置。
- 模型配置增加「是否支持图像模式」，保存后写入该模型的视觉能力。
- 详见 [登录账号托管模型](docs/features/login-managed-model.md)。
- 验证：托管模型单测。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-19 托管模型不再写死地址和名称

- 去掉 `DEFAULT_ZIMO_MODEL_BASE_URL`、`DEFAULT_ZIMO_MODEL_NAME` 和显示名回退。登录只读取系统中已保存的模型标识、显示名称和 API 地址。
- 没有这份配置时登录失败。开发环境变量 `ZIMO_MANAGED_MODEL_BASE_URL` 不再提供地址。
- 详见 [登录账号托管模型](docs/features/login-managed-model.md)。
- 验证：托管模型、模型解析和桌面配置单测，以及相关 ESLint 与 Prettier。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-19 托管模型沿用已保存配置

- 再次登录只更新登录下发的模型密钥。模型标识和 API 地址读取设置页已保存的托管模型配置。
- 还没有这份配置时，写入空的托管模型壳（地址、标识待用户在设置或引导中保存），不再写入固定默认 URL 或模型名。
- 详见 [登录账号托管模型](docs/features/login-managed-model.md)。
- 验证：托管模型单测、相关 ESLint 与 Prettier。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-19 对话页不再请求云端模型目录

- 对话页只加载本机已启用模型，不再调用 `GET ai/model/all`。云端目录方法会直接拒绝。
- 本机模型的图像输入仍由 `capabilities.vision` 决定。已经写在会话上的云端快照继续提供图像与推理标记，切回本机模型后清空。
- 详见 [聊天云端模型目录](docs/features/cloud-model-catalog-chat.md) 与 [聊天图像输入](docs/features/chat-vision-images.md)。
- 验证：云端目录拒绝单测、相关 ESLint 与 Prettier。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-19 检查更新改为本地提示

- 「帮助 / Zimo → 检查更新…」不再访问更新源，也不再下载或安装。点击后左下角提示「已是最新版本」。
- 详见 [桌面更新提示](docs/features/desktop-auto-update.md)。
- 验证：更新服务单测、相关 ESLint 与 Prettier。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-19 知识库页移除账号云端知识库

- 知识库列表不再展示「账号云端知识库」，进入页面不再请求云端目录，本地卡片不再提供云端「更新」。
- 详见 [云端知识库目录（只读）](docs/features/cloud-knowledge-directory-catalog.md)。
- 验证：网站菜单说明单测。未跑 Desktop E2E 与全仓 typecheck。

## 2026-10-19 Agent 人才库改为本地目录

- Agent 页面不再请求云端人才库接口，改为读取 `apps/desktop/resources/agents/<目录名>/AGENT.md`。
- 默认提供招聘协调助手、文稿编辑和资料研究助手。点击安装仍走 `AgentMarketplaceService.install`，正文保存为 system prompt。
- 详见 [Agent 人才库与安装](docs/features/agent-marketplace.md)。
- 验证：本地目录与云端拒绝的 Adapter 测试。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-19 Skill Store 列表改为本地目录

- Skill 页面不再请求 `/ai/skill/zimolist`，改为枚举 `apps/desktop/resources/skills` 的直接子目录。云端目录方法会直接拒绝，不会发出该请求。
- 点击安装仍只提交目录名，由 Main 重新读取同一文件夹并走原有安装服务。打包后的应用不包含该目录。
- 详见 [Skill Store 与安装状态](docs/features/skill-marketplace.md)。
- 验证：本地目录 Adapter 测试。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-15 用户端功能步骤截图

- 功能说明页用户端每个菜单项的操作步骤配有隔离 E2E 截图，与「你可以做什么」对应。
- 截图由 `apps/desktop/e2e/capture-website-screenshots.spec.ts` 生成，不进入默认 `pnpm test:e2e`。
- 验证：网站单测与截图文件检查；截图采集为独立 Playwright 运行。未跑全仓 typecheck、Desktop build。

## 2026-10-15 功能说明页「Zimo 是什么」

- 平台概览原「功能概览」改为「Zimo 是什么」，按总体能力简述任务、知识文档、Agent/Skill/工作流、本机工具与规划中的管理端。
- 验证：网站相关 Prettier、ESLint 与单测。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-15 功能说明页品牌用语

- 页面文案中的 RuoYi-Vue / 若依改为 Zimo；启动命令仍使用企业管理端仓库实际目录名。
- 验证：网站相关 Prettier、ESLint 与单测。未跑全仓 typecheck、Desktop build 与 E2E。

## 2026-10-15 功能说明页增加快速开始

- 在平台概览「功能概览」下增加「快速开始」：用户端为本仓库 `pnpm` / Electron；企业管理端为独立 RuoYi-Vue-FastAPI 的 FastAPI 后端与 Vue 前端。
- 部署命令同步到 [快速开始：用户端与企业管理端部署](docs/features/getting-started.md)，不套用其他产品的一键 Docker 脚本。
- 验证：网站相关 Prettier、ESLint 与新增单测。未跑全仓 typecheck、Desktop build 与 E2E。功能页需 `pnpm dev:website` 查看 `#getting-started`。

## 2026-10-15 功能说明页（用户端 / 企业端）

- 产品站点改为功能说明：用户端对应 Desktop 已交付菜单；企业管理端按 RuoYi-Vue-FastAPI 的组织、AI 目录、监控和用量模块整理，并标为规划中。
- 详见 [Zimo 产品介绍站点](docs/features/product-introduction-website.md)。
- 验证：网站相关 Prettier、ESLint 与 4 文件/7 项单测通过。未跑全仓 typecheck、Desktop build 与 E2E。功能页需 `pnpm dev:website` 查看。

## 2026-10-15 仓库项目说明

- 根目录新增 [README.md](README.md)，按产品说明结构介绍 Zimo 定位、已落地能力、明确边界、分层架构、仓库目录和开发启动方式；不把未实现能力写成可用。
- [文档索引](docs/README.md) 增加项目说明入口。
- 本文档不改变产品行为。未跑代码检查。

## 2026-10-14 对话内展示图片附件

- 气泡、草稿条和预览对话框通过 `zimo-doc://v1/<conversationId>/<artifactId>/<revisionId>` 显示 PNG/JPEG/WebP；Main 只对流式图像 revision 供图，Renderer 仍不拿路径或 Base64。CSP `img-src` 增加 `zimo-doc:`。
- 详见 [聊天图像输入](docs/features/chat-vision-images.md)。
- 验证：变更文件 Prettier 与 ESLint 通过。定向单测 4 文件/13 项通过。未跑全仓 typecheck、production build 与 E2E。开发中的桌面进程需重启后才会注册 `zimo-doc` 协议。

## 2026-10-14 聊天图像输入（第二层）

- 会话附件白名单增加 PNG/JPEG/WebP，SQLite `0045` 对齐 format CHECK。视觉模型把本轮图片编成 OpenAI `text` + `image_url` data URL；非视觉模型发送失败，提示「此模型不支持图像输入。请尝试其他模型」。Base64 不进 SQLite、IPC、Renderer 和普通日志。
- 详见 [聊天图像输入](docs/features/chat-vision-images.md)、[聊天云端模型目录](docs/features/cloud-model-catalog-chat.md)。
- 验证：变更文件 Prettier 与 ESLint 通过。定向单测 6 文件/30 项通过（含视觉拒绝文案、PNG/JPEG 签名、日志脱敏、顶部提示）。集成测试 3 文件/15 项中 14 项通过；Desktop checksum mismatch 清理在 Windows 上因 WAL EBUSY 失败，与 `0045` 无关。LangChain 多模态 `image_url` 转发与 JPEG 持久化通过。未跑全仓 typecheck、production build 与 E2E。已运行桌面进程需完整重启以应用 `0045`。历史轮次不会自动重放图片。

## 2026-10-14 云端模型目录图像能力标记

- 云端 `ai/model/all` 的 `supportImages`（`Y`/`N`，缺省为否）映射为目录与会话快照的 `supportsImages`，并覆盖解析后的 `capabilities.vision`。切回本地托管模型时清空该列。不开放附件图片，也不把图像写入模型消息。
- 详见 [聊天云端模型目录](docs/features/cloud-model-catalog-chat.md)。
- 验证：变更文件 Prettier 通过。目录网关与模型解析 2 个文件/4 项单测通过。Desktop migration 序列 5 项中 4 项通过；checksum mismatch 清理在 Windows 上因 WAL EBUSY 失败，与 `0044` 无关。未跑全仓 typecheck、production build 与 E2E。已运行桌面进程需完整重启以应用 migration。图像仍不会进入模型请求。

## 2026-10-12 手动关闭浏览器后的 CDP 重连

- 本机日志确认浏览器关闭后下一轮 `Target.getTargets` 在 0ms 内因 `connection_unavailable` 失败；Gateway 仍保留旧 WebSocket，未进入已有的 Profile 端点探测及浏览器重启流程。现先识别并清除失效连接、活动标签页和快照；发送时竞态断线只对只读标签页查询重连一次，不自动重放创建、导航、点击或输入。
- 旧 `targetId` 不自动映射到新标签页；仍返回 `BROWSER_TARGET_NOT_FOUND`，现有 Tool Loop 引导模型重新获取真实标签页。详见[问题记录](docs/issues/browser-window-close-stale-cdp-connection.md)。
- Browser CDP 10 文件/39 项测试、单包 typecheck、变更 TypeScript ESLint/Prettier、Desktop build 通过。全仓 typecheck 仍被未改动的知识目录 Schema、SQLite cloud-link 导入及 Renderer 可选属性错误阻断。可见 Chrome/Edge 手动关闭后重启、登录 Profile 保留和 Windows 打包态仍待人工验收。

## 2026-10-12 浏览器空标签页恢复与新建标签页

- 新增受控 `browser_open({url})`：沿用公开 HTTP(S) URL 校验与现有运行互斥、超时取消及脱敏审计，Main CDP Adapter 用 `Target.createTarget` 返回真实标签页 ID，不提供 Renderer/IPC 通用 CDP 入口。`browser_tabs` 第一次为空时等待 200ms 后只重试一次，取消时不继续查询。
- Boss、鱼泡、猎聘和统一招聘源 Skill 更新为优先复用已有业务页，其次使用空白页，没有可用页时按需新建标签页；只有实际快照显示登录/验证时才请求用户处理。四个包版本已提升，但安装在用户数据目录中的旧副本不会由应用重启覆盖，需用户重新安装或发布新版 Skill Store 包后验收。
- Browser CDP 单包 typecheck、浏览器 Tool/模型别名/CDP URL 与标签页定向单测 5 文件 32 项、变更 TS ESLint/Prettier、Desktop build 通过。全仓 typecheck 被未改动的知识目录 Schema/SQLite cloud-link 和 Renderer 可选属性错误阻断；集成测试 21 文件中 17 文件通过，4 文件因沙箱回环监听 `EPERM` 和既有 SQLite `catalog_model_display_name` 缺列失败。可见 Chrome/Edge 首次空列表、登录页和 Windows 打包态仍待人工验收。

## 2026-10-12 浏览器改为内建通用能力

- 普通会话不再根据持久化的 `browserEnabled` 或前台窗口 `ownerId` 决定是否提供浏览器 Tool；Agent/Skill 继承所在运行，Workflow Agent 节点和 Automation 专用会话同样获得已注册的十个浏览器 Tool。移除会话“+”菜单和已选能力栏中的浏览器开关；旧字段暂保留兼容，能力保存统一写 true，不修改历史 migration。
- 共享账号 Profile 增加按模型运行的互斥租约：首次浏览器调用取得，Tool Loop 结束释放；并发任务收到 `BROWSER_RUN_BUSY`，不交叉操作标签页。Workflow 截图写入来源会话 Workspace；独立 Workflow 使用该次运行 Workspace。招聘 Skill 源规则取消“后台只规划”及手动开启浏览器的旧提示，并提升包版本；已安装副本仍需用户更新或重新安装。
- ADR 0024/0020、需求、实施计划、浏览器/自动化/招聘说明、威胁模型和日志说明已同步。定向单测 11 文件/58 项及相关 SQLite 集成测试 3 文件/5 项通过；Desktop build、变更生产 TS ESLint 和 `git diff --check` 通过。全仓 typecheck 被既有知识库 Schema/SQLite cloud-link 与 Renderer 可选属性错误阻断；全仓 lint 被未改动区域 6 项错误阻断；全仓单测 502 项中 487 项通过、15 项在招聘路由旧断言与聊天 UI 测试失败；全仓 format:check 报告 16 个文件，其中威胁模型原有表格也未格式化。真实 Chrome/Edge、自动化并发及打包环境仍需人工验收。浏览器操作不做逐动作审批的残余风险随 Automation 扩大，正式发布前须再评审。
- Workflow Runtime 当前 594 行、Conversation Execution 591 行，接近 600 行拆分门槛；下一次扩展模型执行前应按治理清单提取 Agent 节点/运行编排职责。本次未修改 SQLite Schema、既有 migration 或 IPC 契约，旧浏览器布尔字段留待单独兼容迁移后移除。后台登录/验证需人工处理时目前依靠 Skill 指令报告，调度器尚无独立 `needs_input` 状态；模型正常回复仍可能把该次运行记为 completed。

## 2026-10-12 招聘打招呼自动化快捷填写

- 自动化新建/编辑表单的“执行能力”改为默认折叠，标题显示已绑定项数，点击后再展示模型、Agent、Skill、知识库、Workflow 和 MCP Tool；表单提交与能力绑定规则不变。
- 应用户反馈将快捷入口收敛到自动化列表页的说明文字后；点击只打开预填用户提供招聘 Prompt 的新建表单，表单不再展示额外快捷卡片。快捷 Prompt 的各标题下直接接正文、不留空行，岗位名称仍为“前端开发工程师”。Prompt 输入框随内容变化自动增高，内容仍可编辑；不会自动保存、运行或绑定 Skill。当前自动化未开放浏览器操作，招聘 Skill 的长期规则只生成规划且要求单平台，因此这只是草稿填写。详见 [Automation 功能说明](docs/features/automation-scheduler.md)。
- 列表页入口、表单高度与执行能力折叠交互测试 3 项、变更 TS ESLint/Prettier、Desktop production build 与 `git diff --check` 通过。全仓 `pnpm typecheck` 仍被未改动的知识库 Schema/SQLite cloud-link 导入和 Renderer 可选属性问题阻断；真实应用验收待完成。

## 2026-10-12 删除自动化保留已执行任务

- 修复删除自动化时无条件软删除专用会话的问题：有消息的会话保留为可单独管理的历史任务，未执行的空会话才随调度配置清理；运行中的会话拒绝删除。自动化删除确认文案同步说明该行为，详见[问题记录](docs/issues/automation-delete-preserves-history.md)。
- 本机数据库只读核对显示两条此前受影响的会话仍分别保留 2 条和 4 条消息，但会话已被软删除；本次代码变更不直接恢复用户数据。Application/Contracts/Preload 定向单测 3 文件/10 项、Automation SQLite 集成测试 1 文件/3 项、变更 TS ESLint/Prettier、Desktop production build 和 `git diff --check` 通过。全仓 `pnpm typecheck` 仍被未改动的知识库 Schema/SQLite cloud-link 导入和 Renderer 可选属性错误阻断；真实应用验收待完成。

## 2026-10-12 自动化专用会话侧栏同步

- 本地日志和数据库确认自动化运行完成且专用会话消息已保存；侧栏未收到运行/删除通知，删除自动化后旧条目仍可点击，从而落入已删除会话的初始化错误。现在 Application 在消息建立、运行终态及删除配置后通知 Main，Main 通过严格空载荷单向 IPC 通知 Renderer 复用 `taskState.refresh()`；ChatPage 遇到已删除会话也会重新读取列表。一个自动化仍只对应一个专用会话，不为每次运行新建任务。后续删除配置保留已有历史会话，见上方修复。详见[问题记录](docs/issues/automation-task-list-stale.md)。
- Application 手动、定时及删除通知测试、Contracts 严格事件测试、Preload 订阅测试和既有侧栏测试通过；变更文件 ESLint/Prettier、Desktop production build 与 `git diff --check` 通过。全仓 `pnpm typecheck` 仍被未改动的知识库 Schema、SQLite cloud-link 导入和 Renderer 可选属性问题阻断；真实应用内事件展示待人工验收。

## 2026-10-12 历史回复模型名与输入区选择解耦

- 助手气泡曾用会话当前模型显示名填充每一条回复，切换输入区模型会改写历史标签。现将生成时的显示名写入 `messages.model_display_name`；发送与重新生成快照目录或本地模型名，切换会话模型不回写旧消息。升级前 NULL 的消息省略名称，不回填当前选择。
- 详见 [历史回复模型名跟随输入区选择](docs/issues/historical-reply-model-follows-composer.md)、[助手回复用量展示](docs/features/assistant-reply-usage.md)。
- 验证：变更文件 Prettier 与 ESLint 通过（message-bubble 既有 Fast Refresh 警告）。ConversationService 与助手气泡/用量 3 个文件、26 项单测中 25 项通过；失败 1 项为既有 Tooltip hover 用例未弹出，与本次无关。Desktop migration 序列 5 项中 4 项通过，checksum mismatch 清理在 Windows 上因 WAL 占用 EBUSY 失败，与 `0043` SQL 无关。未跑全仓 typecheck、production build 与 E2E。已运行的桌面进程需完整重启以应用 migration。

## 2026-10-10 浏览器改用非零调试端口

- 按用户要求将独立 Profile 浏览器的 `--remote-debugging-port=0` 改为随机非零端口。由于 Chrome 不再为这种启动方式自动提供端点发现文件，改从本次子进程的 stderr 读取 CDP 地址，并校验所选端口与 `/json/version` 返回的 WebSocket 地址；验证通过后仅在账号 Profile 内保存端点供重启复用。失败、超时和取消不连接其他浏览器。详见[问题记录](docs/issues/browser-nonzero-cdp-port.md)。
- Browser CDP 8 文件/28 项测试、单包 typecheck、变更 TypeScript ESLint/Prettier、Desktop production build 与 `git diff --check` 通过；本机临时 Profile 的 Chrome headless 实测非零端口和端点一致。真实可见浏览器、Windows Chrome/Edge 与鱼泡访问效果仍待人工验收。

## 2026-10-10 会话消息时间与发送方轮廓

- 用户消息和助手回复的时间统一常显于气泡下方，分别右对齐、左对齐；助手流式输出显示创建时刻，终态显示完成/停止/失败时刻。根据验收反馈移除突出的三角尾角，改为 14px 圆角与更紧凑的垂直内边距，同时保持发送方上侧直角：用户右上角、助手左上角；用户复制按钮仍仅悬停或键盘聚焦时显示。
- 助手气泡内部用量行不再重复时间；复用现有消息时间字段，无 IPC、存储或权限变更。会话体验与助手用量文档同步更新。
- 新增时间与气泡轮廓 3 项定向用例、元信息 4 项测试、变更文件 ESLint 和 Desktop build 通过；全仓 typecheck 仍被未修改的知识库与 Renderer 类型错误阻断。消息组件全集中 1 项既有 Tooltip hover 用例在 jsdom 中未弹出，其余 10 项通过；真实桌面视觉仍需人工验收。

## 2026-10-10 新会话首条长回复自动贴底修复

- 原滚动 hook 只在会话 ID 或用户消息数量变化时定位底部；首条流式回复从无溢出增长到出现滚动条时，原生锚点无法保证贴底。现观察消息内容与可视区域尺寸，在原本贴底的情况下即时校正；用户主动上翻后保持阅读位置，自动校正不用平滑滚动。
- 增加首条回复首次溢出、输入区压缩消息区高度及主动上翻的组件回归测试；[问题记录](docs/issues/conversation-first-reply-auto-scroll.md)和会话体验文档同步更新。定向测试 3 项、变更文件 ESLint/Prettier 和 Desktop build 通过；全仓 typecheck 仍被未修改的知识库与 Renderer 类型错误阻断，相邻旧会话测试 1 项因缺少 `TooltipProvider` 失败。真实桌面窗口待人工验收。

## 2026-10-10 浏览器快照保留会话项父子关系

- Boss 回复任务的最新快照未截断，姓名、岗位和预览均已输出，但与前面连续出现的匿名 `listitem` ref 失去关联；根因是 Zimo 按 CDP 原始数组顺序平铺 AX 节点。参考 xclaw 按 `childIds` 深度优先输出有界缩进，保留无 ID/异常子树、现有 ref 校验、保护字段及 iframe 边界。详见[问题记录](docs/issues/browser-snapshot-flattened-conversation-items.md)。
- Browser CDP 7 文件/26 项定向测试、单包 typecheck、相关 ESLint/Prettier 和 Desktop production build 通过。全仓 typecheck/lint 分别被未修改的知识库/Renderer 类型问题和 6 项既有 lint 错误阻断；真实已登录 Boss 会话项层次仍需人工复测。

## 2026-10-10 Boss 回复 Enter 参数缺失

- 最新运行已成功输入文本，新快照含编辑器 ref；模型却仅以 `targetId + key=Enter` 调用 `browser_press`，受控 Tool 返回 `TOOL_ARGUMENTS_INVALID`，Enter 未执行。已安装 Boss Skill 仍为旧版，源 `reply.md` 上方状态提示也残留缩写。详见[问题记录](docs/issues/boss-chat-editor-ref.md)。
- Boss 源 Skill 升至 `2.0.2` 并统一要求最新 `targetId + snapshotId + 编辑器 ref + key=Enter`；Tool 描述明确条件参数。首次缺参 Enter 安全反馈模型重新快照并核对草稿，第二次仍缺参终止，不自动发送或重复输入。用户数据中的已安装 Skill 仍须更新包并重装后才会读取新文案。
- 浏览器/Tool Loop/Skill 相关 10 文件、32 项定向测试，变更 TypeScript ESLint/Prettier、Browser CDP 单包 typecheck 和 Desktop build 通过。全仓 typecheck 仍被未改动的知识库目录与 Renderer 类型错误阻断；真实 Boss 发送与已安装 Skill 更新待人工复测。

## 2026-10-09 Boss 聊天编辑器 ref 识别与回复指令修复

- 只读 CDP 确认 Boss 当前聊天编辑器是主文档 `contenteditable`，AX 角色为无名称 `generic`；原补充器遇到已有 ref 会跳过，旧回复 Skill 又误把 CSS 选择器填入 `ref`，触发具有误导性的“网页结构已变化”。详见[问题记录](docs/issues/boss-chat-editor-ref.md)。
- 快照现把已有编辑器 ref 标为 `textbox`；不存在的 ref 与过期快照分开报错，并有最多两次安全恢复机会。Boss 源 Skill 的回复与邀约统一改用最新 `snapshotId + ref`，无空编辑器或无法验证文本时停止，不盲目追加或发送。
- 浏览器、Tool Loop、回复文案相关 12 个文件/47 项定向测试、变更文件 ESLint/Prettier、Browser CDP 单包 typecheck 和 Desktop build 通过。全仓 typecheck 被未改动的知识库目录/Renderer 类型错误阻断；全仓 lint 被未改动区域的 6 项错误阻断；全仓单测 476 项中 459 项通过、17 项在招聘路由旧断言、文档模型和聊天 UI 等未改区域失败。真实 Boss 发送链路和已安装 Skill 包更新仍待人工验收；仓库源文件不会自动覆盖用户安装副本。

## 2026-10-10 会话附件新格式无法入库导致不可读

- 导入白名单扩大后，SQLite `document_artifacts.format` 仍只允许四格式，Markdown 等文件在复制后插入失败，被映射成「文件无法安全读取」。
- `0042` 扩展 format CHECK，使可导入类型能持久化并走既有 inspect/read。详见 [会话附件白名单无法写入 SQLite](docs/issues/session-document-import-format-constraint.md)。
- 验证：文档仓储集成测试通过（含升级前拒绝 `md`、应用 `0042` 后可写入）；Desktop migration 序列测试 4 项通过，既有 checksum mismatch 用例在 Windows 上因 WAL 文件占用导致清理失败，与本次 SQL 无关。必须完整重启桌面进程以应用 migration。

## 2026-10-10 会话附件导入对齐知识库可解析格式

- 聊天「添加文件」不再只接受 DOCX/XLSX/PPTX/PDF；导入白名单与知识库相同：文本、Markdown、HTML、JSON、CSV、RTF、OpenDocument 和 EPUB，仍校验扩展名、签名、20 MB 和符号链接。
- 创建、有限修改和转换目标继续只允许四种办公/PDF 格式；新类型可 inspect/read，并语义重建为可编辑格式。可执行文件、通用压缩包、图片和宏格式仍拒绝。
- 详见 [会话文档工作区与模型工具设计](docs/features/document-workspace-and-tools.md)。
- 验证：变更文件 Prettier/ESLint 通过；文档存储、内容 Adapter 与附件 UI 3 个文件/24 项定向测试通过；全仓 typecheck 仍被未改动的知识库目录 Schema 与 Renderer 可选属性错误阻断。未跑 Desktop production build 与 Electron E2E。真实系统选择器/拖放导入待人工确认。

## 2026-10-09 浏览器快照字符预算与招聘滚动次数

- 最新 Boss 推荐牛人任务的快照连续接近 30000 字符并标记截断；将快照正文上限调至 150000，保留 2000 节点/16 iframe 限制，并只为浏览器 snapshot/wait 放宽序列化 Tool 输出预算。详见[问题记录](docs/issues/browser-snapshot-character-budget.md)。
- Boss 与鱼泡推荐牛人 Skill 的列表滚动硬上限由 30 次改为 10 次；猎聘原为 15 次，未改。当前已安装市场包需在对应源包更新并重新安装后才使用新的 Skill 文案；仓库文件修改不会覆盖用户已安装副本。
- 相关 4 个文件、19 项定向测试通过；真实 Boss/鱼泡页面效果仍待人工复测。

## 2026-10-09 Boss 登录误判与跨轮标签页 ID 恢复

- 最新任务首轮只见空白标签页，导航后截图仍为加载画面，模型过早要求扫码；后续同一标签页已进入已登录业务页。方案选择后的 `browser_snapshot` 使用模型编造的 ID，不是真实标签页关闭。
- Boss 源 Skill 负责等待新快照确认登录状态，且用户跨轮回复后重新获取并锁定真实标签页 ID；通用 Tool Loop 不注入登录业务规则，仅将无效 ID 前两次返回可恢复工具结果，第三次终止。详见[问题记录](docs/issues/boss-login-and-stale-browser-target.md)。
- Boss Skill、浏览器 Tool Loop/CDP 共 10 个文件、37 项定向测试通过；变更 TypeScript ESLint、Prettier、Desktop production build 和 `git diff --check` 通过。全仓 typecheck 被未修改的知识库目录与 Renderer 类型错误阻断；既有招聘 Skill 路由测试 15 项中 11 项因其他平台 task 缺少旧断言要求的 URL/恢复文案失败。本次未修改这些 task。真实 Boss 页面仍待用户人工复测。

## 2026-10-09 Boss 推荐牛人列表滚动指令修正

- 用户恢复的旧版 `recommend.md` 使用不带 ref 的 viewport 滚动，并要求 1000–1050 距离，超过 Zimo 当前单次 1000 上限；一次快照姓名不变还会过早判定到底。
- 仅调整该任务的滚动流程：选择当前已加载列表最后一张候选人卡片 ref，复用 CDP 先滚入视区再在卡片位置向下滚动的行为，一次动作抵达当前批次末端并等待懒加载；保留 30 次硬上限和其余用户恢复内容。它不保证尚未加载的后续批次已到底，真实 Boss 页面效果仍待人工验证。

## 2026-10-09 知识库 cloud-links 与 default-browser migration 40 碰撞

- 部分开发库将 `knowledge-cloud-links` 记为版本 40，与当前正式序列（40 默认浏览器、41 cloud-links）冲突导致 checksum mismatch。启动时在名称与 SQL checksum 匹配时事务性将 40 移至 41 并补跑 default-browser；不重放 knowledge SQL。

## 2026-10-09 浏览器 Escape 页面级按键修复

- 最新 Boss 任务对 `RootWebArea` ref 发送 Escape 时，`DOM.focus` 立即返回协议错误，按键未发出；这不是浏览器退出证据。
- 参考 xclaw 的页面级 Escape，将其改为仅需目标标签页并直接派发 `rawKeyDown/keyUp`；兼容旧参数，其他按键继续要求最新快照与元素 ref。未引入网站 selector、任意 JavaScript 或新权限。详见[问题记录](docs/issues/browser-escape-root-focus-failure.md)。
- 验证：浏览器工具/模型 Tool Loop/Browser CDP 共 6 个文件、27 项定向测试，以及全仓 typecheck、变更文件 ESLint/Prettier、Desktop production build 和 `git diff --check` 通过；真实 Boss iframe 弹窗仍待用户人工验收。

## 2026-10-08 浏览器快照去重与 CDP 方法诊断

- 参考 xclaw 的 AX 节点过滤，在快照预算前省略重复文本碎片和装饰文本；保留空容器及 ref，避免影响 iframe 内滚动与无标签交互。新增 CDP 失败方法、固定原因和耗时的脱敏日志，不改变用户可见错误。
- 定向单测覆盖候选唯一文本、按钮与容器 ref 保留及诊断分类。真实 Boss 页面的截断率与 iframe 滚动仍待人工复测；记录见[问题说明](docs/issues/browser-snapshot-noise-and-cdp-failure-diagnostics.md)。

## 2026-10-08 招聘 Skill 任务页面守卫恢复

- 对比迁移前招聘 Skill 后确认，旧 OpenClaw 工具语法被替换时，Boss、鱼泡和猎聘十二个前台业务 task 的目标 URL、页面验证和路由恢复也被过度精简。
- 三个平台主 Skill 增加目标路由表；推荐、搜索、回复和职位管理 task 必须先验证 URL 与页面关键结构，已在目标页时不重复导航，偏离后最多恢复一次。继续禁止 selector、坐标、JavaScript、Shell、TaskHub、子 Agent 和后台浏览器。
- 三个平台版本提升为 `2.0.1`；现有已安装副本需要重新本地安装或通过 Skill Store 更新后才能测试。问题与验证记录见[招聘 Skill 迁移丢失任务页面守卫](docs/issues/recruitment-skill-route-guards-lost.md)。
- 验证：招聘路由与 Desktop 打包资源 2 个测试文件/19 项测试、全仓 typecheck、本次变更 ESLint、Prettier 和 `git diff --check` 通过；真实三个招聘站点仍需用户登录后的人工 smoke。

## 2026-10-08 模型 Tool 后续轮安全诊断增强

- 最新浏览器任务的 `tool_followup` 在浏览器工具成功后 1668ms 报无 HTTP 状态的泛化 `Error`，旧日志不足以确定网络、网关断流或请求规模原因。
- 模型失败事件增加固定枚举传输原因、白名单 cause 链和失败轮请求规模统计；不记录原始异常、消息、Tool 输出或凭据。详见[问题记录](docs/issues/model-provider-failure-diagnostics.md)。
- 验证：诊断 3 项单测、模型适配器 5 项回环集成测试、全仓 typecheck、本次文件 ESLint/Prettier 与 Desktop production build 通过。待重试后根据新日志确认根因；当前不改变模型连接、重试或错误映射。

## 2026-10-08 浏览器 iframe 快照与 2000 节点预算

- CDP 快照改为遍历嵌套 iframe 并按 `frameId` 分别读取可访问性树；iframe ref 与主页面 ref 一起绑定当前快照，继续沿用现有受控点击、输入、按键与滚动链路。
- 总节点上限由 500 提高到 2000；保留 30000 字符输出上限，并为 iframe 预留预算。不可读 frame 明示为截断，不生成虚假 ref。详见[问题记录](docs/issues/browser-iframe-snapshot-missing-content.md)。
- Browser CDP 4 文件/13 项定向测试、全仓 typecheck、本次 TypeScript ESLint/Prettier 和 Desktop production build 通过；真实 Boss 直聘页面及跨进程 iframe 的目标浏览器人工验收仍待完成。

## 2026-10-08 浏览器与云端模型 migration 版本碰撞修复

- 本地旧库已将浏览器 SQL 记为版本 38；后续云端模型 SQL 也使用 `0038`，且被加载为版本 38，导致启动时 checksum mismatch。
- 固定浏览器 38、云端模型 39、默认浏览器 40；对反向顺序的旧账本仅在名称及 SQL checksum 精确匹配时事务性调整版本。SQL 内容与用户数据不变，未知 checksum 继续拒绝启动。详见[问题记录](docs/issues/browser-catalog-migration-version-collision.md)。
- 验证：3 文件/15 项定向 SQLite 集成测试、全仓 typecheck、本次修改文件 ESLint 与 Desktop production build 通过；真实用户数据库仍待重启应用验收。

## 2026-10-08 招聘能力身份、默认浏览器与标题兜底修复

- 普通前台会话默认启用浏览器，既有非 Automation 会话通过 migration 更新；Automation、Workflow 和无前台 owner 的运行仍不注入浏览器 Tool，用户可在“+”菜单关闭。
- 首轮任务标题移除五秒专用超时，继续使用会话取消和模型网关统一边界；模型失败或空输出时根据首条用户指令写入本地兜底标题，主回答状态不受影响。
- Skill Store 保留 `zimo.market.*` 安装身份，能力发现从已持久化 `SKILL.md` 解析受校验的稳定编排身份；精确搜索按唯一编排身份加载，重复身份拒绝加载。
- 问题、兼容迁移和验证记录见[招聘能力精确加载、默认浏览器与标题兜底](docs/issues/recruitment-capability-identity-and-default-browser.md)。
- 验证：相关 6 文件/25 项单元与迁移测试、全仓 typecheck、本次变更 ESLint/Prettier 和 Desktop production build 通过；全仓单测 433 项中 428 项通过，5 项失败来自未修改的回复时长、复制、Tooltip/ResizeObserver 测试；沙箱外集成测试 46 项中 45 项通过，1 项失败来自既有测试库缺少 `catalog_model_display_name`；全仓 lint 与 format check 仍分别被未修改的 Renderer/model-catalog 3 个错误和 6 个格式差异阻断。

## 2026-10-07 统一招聘 Skill 调度与浏览器动作扩展

- 招聘资源目录规范化为 `recruitment-hub`、`boss-zhipin`、`yupao`、`liepin-hr`，增加稳定 `zimo.*` package ID；统一招聘通过 `search_capabilities.packageIds` 精确加载一个或多个已安装平台 Skill，不再读取 `skills/...` 项目路径或创建子 Agent。
- Skill Runtime 新增按安装清单、skill ID 与 checksum 校验的只读包内文本资源 Tool，平台 Skill 可加载 `tasks/*.md`，不借用会话 Workspace 或通用文件 Tool。Boss 的 OpenClaw 登录脚本已移除，登录改为可见浏览器扫码和人工确认。
- 浏览器能力由七项扩展为十项：新增受限 `press`、有界 `scroll`、等待后返回新快照的 `wait`；Adapter 用固定 contenteditable 规则补充聊天编辑框 ref，仍不接受模型 selector、任意 JavaScript、密码或验证码。
- managed Workspace 在数据库 grant 已存在时仍重新确保物理目录存在，避免应用数据被清理后继续返回失效 root。
- 设计见[统一招聘 Skill 调度](docs/features/recruitment-skill-orchestration.md)、[会话按需能力发现](docs/features/on-demand-capability-discovery.md)和[本地浏览器自动化](docs/features/local-browser-automation.md)。自动化招聘仍只生成规划；Workflow、Automation 和后台任务不获得浏览器能力。
- 验证：本次 8 文件/37 项定向测试、Model Tool Loop 11 项测试、全仓 typecheck、本次变更 ESLint 和 Desktop production build 通过。全仓单测 428 项中 423 项通过，5 项失败来自未修改的回复时长/复制/Tooltip 测试；集成测试 45 项中 44 项通过，1 项失败来自未修改的 SQLite 测试库缺少 `catalog_model_display_name`；全仓 lint 和 format check 分别被未修改的 Renderer/model-catalog 3 个错误与 6 个格式差异阻断。真实 Boss/鱼泡/猎聘登录和页面操作仍需应用内人工 smoke。

## 2026-10-08 云端知识库目录与同步

- 知识库列表页登录后请求 `ai/knowledge/directory/tree-with-documents`，展示账号云端目录；各目录「导入到本地 / 更新」对齐本地新建知识库与 `importFiles` 流程，成功后刷新本地列表。Migration `0039_knowledge_cloud_links.sql`、IPC `zimo:knowledge:cloud-sync:*`。详见 [cloud-knowledge-directory-catalog.md](docs/features/cloud-knowledge-directory-catalog.md)。

## 2026-09-23 浏览器 Tool Provider 400 修复

- 定位启用浏览器后模型首轮立即失败：Provider 在 `tool_initial` 返回 HTTP 400 `invalid_request_error`，原因是无参数 `browser_tabs` 使用 `{}`，不满足严格 OpenAI-compatible function parameters Schema。
- `browser_tabs` 改用拒绝未知字段的完整空 object Schema；浏览器审批、权限和执行行为不变。问题记录见[浏览器 Tool 空参数 Schema 导致模型请求被拒绝](docs/issues/browser-tool-empty-schema-provider-rejection.md)。
- 验证：浏览器注册与 Model Tool Loop 共 2 文件/14 项单测、全仓 typecheck、相关 ESLint 和 Desktop production build 通过；真实中转网关修复后复测需重启应用由用户触发。

## 2026-09-23 浏览器 Tool payload 诊断可见性

- 定位最新运行未暴露浏览器 Tool 的直接原因：对应会话持久化的 `browser_enabled=0`；自然语言中的浏览器意图不会替代“+ → 浏览器”的显式会话绑定。
- 修复内建浏览器 Tool 被通用别名误标为 `mcp_N_*` 的可观测性问题，七项模型函数改用稳定 `browser_*` 名称；明确 Tool Schema 应在同一 `conversationId + runId` 的 `conversation_tool_round` 中检查。
- 问题记录见[浏览器工具未出现在模型请求](docs/issues/browser-tools-not-visible-in-model-payload.md)。
- 验证：相关 2 文件/14 项单测、全仓 typecheck、相关 ESLint 和 Desktop production build 通过。

## 2026-09-23 独立 Profile 本地浏览器自动化

- 新增 Phase 11 浏览器能力：普通前台会话可显式启用 `browserEnabled`，向模型暴露标签页枚举/聚焦、Accessibility Snapshot、截图、公开网页导航、快照引用点击和普通文本输入七个小 Tool；Workflow、Automation 和后台运行首版不获得浏览器能力。
- Main 通过新的 `@zimo/browser-cdp` Adapter 启动用户已安装的 Chrome、Edge、Brave 或 Chromium。每个登录账号使用独立持久 Profile、随机回环 CDP 端口，不附着用户默认浏览器，不开放通用 CDP、Selector 或任意 JavaScript 给 Renderer/模型。
- 按用户明确决策，七项浏览器操作均不做动作风险分级、不进入审批弹窗，绑定后直接执行；仍保留严格 Tool Schema、会话绑定、公开 HTTP/HTTPS URL 策略、取消/超时、过期快照拒绝、密码字段拒绝输入和脱敏 Tool 审计。
- `0038_conversation_browser_capability.sql` 持久化会话开关；截图进入当前会话 Workspace。设计与残余风险见[本地浏览器自动化](docs/features/local-browser-automation.md)和 [ADR 0024](docs/adr/0024-local-browser-cdp-automation.md)。
- 验证：全仓 Prettier、typecheck、相关文件 ESLint、5 文件/26 项定向单测、2 文件/16 项 SQLite 集成测试和 Desktop production build 通过；独立真实 Chrome Profile smoke 已验证启动、标签页、聚焦、导航、结构快照、输入、截图与点击跳转。macOS x64、Windows x64、签名安装包和真实登录站点仍待对应环境人工验收。

## 2026-09-24 聊天云端模型目录

- 聊天页模型下拉合并本地 `models.list` 与账号云端 `ai/model/all`（`status=0`）；云端目录不写 SQLite `models` 表，自有模型配置与设置页行为不变。
- 选择云端模型通过 `conversations.selectCatalogModel` 仅保存会话 catalog 快照；执行时复用登录托管 Provider 凭据与 `modelCode`。新增 migration `0038_conversation_catalog_model.sql` 与 IPC `models:list-catalog`、`conversations:select-catalog-model`。
- 验证：`pnpm install` 后运行 model-catalog-zimo 与 conversation-model-resolution 定向单测、typecheck；登录环境人工验收待补。

## 2026-09-23 会话按需能力发现

- 普通会话停止前置 LLM Router 分类，Renderer 移除置信度、识别超时和“继续普通对话”提示；显式选择的 Agent/Workflow 保持原执行链路，兼容 `route.completed` 暂时保留但不展示。
- Tool Calling 会话新增应用内建 `search_capabilities`：搜索启用的 Skill、Agent、MCP、知识库和 Workflow；命中的已安装 Skill、MCP Tool 与知识检索能力无需再次授权，在同一个 run 的下一轮自动加载。具体高风险 Tool 仍按原动作审批执行。
- 本地未命中时查询现有 Skill Store 和 Agent 人才库，只返回安装建议，不允许模型自动安装。单次运行最多搜索两次、每次最多五项，支持取消，无新 IPC、migration 或依赖。设计见[会话按需能力发现](docs/features/on-demand-capability-discovery.md)和 [ADR 0023](docs/adr/0023-on-demand-capability-discovery.md)。
- 当前限制：Agent/Workflow 可被发现，但仍需现有会话入口切换或启动；语义向量检索和嵌套 handoff 尚未实现。
- 验证：能力检索、同轮动态加载和会话 UI 定向 22 项测试、全仓 typecheck、19 文件/45 项集成测试、Desktop production build，以及本次修改文件 ESLint/Prettier 均通过。全仓单测 409 项中 404 项通过，5 项失败来自未修改的回复菜单、时长文案和剪贴板测试；全仓 lint 仍有未修改回复 UI 的 4 个既有错误，`format:check` 仍被 7 个未修改文件的既有格式差异阻断。真实模型自主发现与市场建议仍待应用内 smoke。

## 2026-09-23 会话问答卡逐题浮层交互

- 模型仍可一次提交最多 3 个问题，但 Application 改为逐题发布和逐题校验，最后再把完整答案回传同一 Tool Call；每题使用独立一次性问题 ID，并显示题号/总数。
- 问答卡从消息输入表单中移出，改为输入框上方独立浮层，不改变原输入框布局；Main 接受回答后 Renderer 立即移除当前卡，随后显示下一题。问题记录见[会话问答卡批量展示与提交后残留](docs/issues/conversation-question-card-interaction.md)。
- 验证：逐题服务、提交清理、问答卡和模型工具循环定向 9 项测试、45 项集成测试、Desktop production build、Preload 安全边界 Electron E2E 通过，本次修改文件 ESLint 与 Prettier 通过。全仓 406 项单测中 400 项通过，6 项失败均来自未修改的助手回复 UI 断言；全仓 lint 仍有该区域 4 个既有错误，typecheck 仍被未修改的 `conversation-display-messages.test.ts:134` 中 `messageCount` 类型错误阻断。真实模型多题切换仍待应用内人工 smoke。

## 2026-09-22 会话内结构化提问

- 普通桌面会话的工具循环增加 `ask_user_question`，支持 1–3 题、单选/多选和自输入；Main 保持待回答请求，Renderer 在输入框上方展示卡片，通过具名 IPC 回答后继续同一轮运行。同批其他工具调用被延后，答案不构成动作审批。Workflow、微信及后台 Automation 不暴露此能力；待回答请求不跨应用重启恢复。
- 功能设计见[会话内结构化提问](docs/features/conversation-user-questions.md)。验证：新增问答与工具循环定向 7 项测试、45 项集成测试、Desktop production build、Preload 安全边界 Electron E2E 通过；本次改动文件 ESLint 与 Prettier 通过。全仓 typecheck 被未改动的 `conversation-display-messages.test.ts:134` 的 `messageCount` 类型错误阻断；全仓 lint 和 unit 分别有未改动的助手回复 UI 文件错误与 6 项既有断言失败。真实模型自主触发及完整人工交互仍待应用内 smoke。

## 2026-09-22 原生搜索不支持时继续网页读取

- `web_search` 使用模型原生后端且明确返回 `MODEL_NATIVE_SEARCH_UNSUPPORTED` 时，会话工具向模型回传 `ok=false/status=unavailable`，保留后续 `web_fetch` 读取已知公开网址的机会；不编造搜索结果，也不切换到其他搜索 Provider。设置页原生能力测试与其他错误仍严格失败。详见[问题记录](docs/issues/model-native-search-chat-fetch-fallback.md)。
- 验证：先新增复现失败的模型工具循环用例，修复后定向 11 项测试、全仓 379 项单元测试、45 项集成测试、typecheck、lint、Desktop production build 和 1 项模型记忆 Electron E2E 通过。全仓 `format:check` 仍因 8 个本次未修改文件的既有格式差异失败，本次改动文件已单独格式化。真实网关与网页读取质量仍待人工 smoke。

## 2026-09-22 移除压缩偏好提取遗留链路

- 删除压缩完成后的偏好提取器、账号记忆保存方法、可选回调、所属账号透传和专用流事件；手动与自动压缩只生成会话检查点。普通会话的结构化记忆 Tool、设置页 CRUD 与新任务记忆注入保持不变。旧检查点和既有数据库记忆不删除。
- 验证：typecheck、lint、99 文件/377 项单元测试、19 文件/45 项集成测试、Desktop production build，以及手动压缩不写记忆和模型工具写入/新任务读取两项 Electron E2E 通过。全仓 `format:check` 仍因 8 个本次未修改文件的既有格式差异失败；本次改动文件已单独格式化。未修改既有数据库记忆或检查点。

## 2026-09-22 普通会话结构化记忆保存

- 桌面窗口发起且模型支持 Tool Calling 的普通会话，在既有流式请求中新增 `save_user_memory`；模型可提交 `preference|goal|open_issue` 与有界内容。微信入站、自动化后台运行不自动获得写入工具。Application 核对本轮与当前登录账号，写入既有账号隔离 `user_memories`，相同类别和内容幂等跳过。后续会话沿用已有有界记忆注入。生产压缩链路不再调用摘要偏好提取器，摘要仍只作会话交接。
- 首版不做语义价值、原文出处、冲突或敏感性校验；模型可能保存不准确或不必要的信息，用户可在设置页删除/停用。模型调用工具后的最终回复可能需要后续模型轮次，不保证单次 HTTP 请求。无新 migration、IPC、依赖或打包资源。
- 验证：全仓 typecheck、lint、383 项单元测试、45 项集成测试、Desktop production build，以及记忆写入/新会话注入和压缩不再写入记忆的 2 项 Electron E2E 通过。集成/E2E 需允许本机回环端口；全仓 `format:check` 仍因 8 个本次未修改文件的既有格式差异失败，本次改动文件已单独格式化。真实模型自主触发仍待人工 smoke。

## 2026-09-22 开发环境手动压缩门槛

- “较早的完整消息不足”表示当前会话在最新检查点之后的已完成非 system 消息不超过保留数，与自动压缩 token 水位无关。开发服务器的手动压缩保留数降为 2（完成两轮对话可试），正式版和自动压缩继续保留 12；原始消息与旧检查点不改动。详见[手动压缩与记忆](docs/features/manual-compaction-and-user-memory.md)。
- 先补充仅保留 2 条的手动压缩回归用例并验证原实现失败；修改后 380 项单测、45 项集成测试、typecheck、lint、Desktop build 和 2 项正式构建 Electron 手动压缩 E2E 通过。改动文件格式检查通过。

## 2026-09-22 助手回复用量旁重新生成

- 最新已完成/已停止/失败的助手气泡在「共消耗」右侧提供重新生成，悬停提示后续内容会被覆盖；复用现有 `conversation.regenerate`。
- 设计见 [助手回复用量展示](docs/features/assistant-reply-usage.md)、[Conversation Experience V0](docs/features/conversation-experience-v0.md)。
- 已对变更文件跑 Prettier。相关组件单测在本地被跳过，未宣称通过。未跑 typecheck、lint、integration、build、E2E。

## 2026-09-22 思考中无正文不显示空气泡

- 助手回复 `pending`/`streaming` 且尚无正文、附件或资料引用时只保留 `思考中 {n}s` 与工具步骤，不渲染空白气泡；有回复内容后再显示。完成、停止或失败仍显示气泡以便用量与状态。
- 设计见 [Conversation Experience V0](docs/features/conversation-experience-v0.md)、[助手回复思考时间与工具步骤](docs/features/assistant-reply-timeline.md)。

## 2026-09-22 已完成思考流程默认折叠

- 助手气泡上方仍显示 `已完成 {n}s` / `已停止 {n}s`；有工具步骤时默认折叠，点击耗时标题展开。进行中的 `思考中 {n}s` 仍展开显示当前步骤。
- 设计见 [助手回复思考时间与工具步骤](docs/features/assistant-reply-timeline.md)。
- 本次 Prettier / typecheck / lint / 单测在本地被跳过，未宣称通过。未跑 integration、build、E2E。

## 2026-09-22 原生联网测试误报修复

- 脱敏实测已配置网关可返回真实搜索调用、来源及数组包裹的工具错误；原实现没有强制工具调用，且漏识别数组错误。现为原生搜索请求设置 `tool_choice: any`，分别报告未调用、仅工具错误、无有效来源；保留纯文本不算搜索成功的安全边界。
- 回归与未留存原始失败响应的限制见 [问题记录](docs/issues/model-native-web-search-false-unsupported.md)。
- 新增先失败后通过的协议回归；全仓 379 项单测、45 项集成测试、typecheck、lint 与 Desktop production build 通过。真实网关脱敏诊断确认 `tool_choice: any` 可返回工具调用；应用内复测仍需重启后由用户确认。

## 2026-09-22 模型原生联网搜索后端

- `web_search` 新增显式“当前模型原生搜索”后端，复用本轮模型配置和安全存储的密钥，Main 独立调用 `/messages`，只返回真实来源条目；原有 Tavily、Brave、SearXNG 和 `web_fetch` 不变。
- 模型设置页增加“测试原生联网”，区分普通连接成功与搜索来源成功，并报告部分结果错误数；联网搜索设置页可选择该后端。详见 [联网搜索与网页读取](docs/features/web-search-and-fetch.md)、[ADR 0022](docs/adr/0022-controlled-web-search-and-fetch.md)。
- 验证：全仓 378 项单测和 45 项集成测试通过，Desktop production build、lint、typecheck、改动文件格式检查通过；全仓格式检查仍报 9 个本次未改动文件的既有格式差异。真实网关交互需在应用内使用“测试原生联网”复验。

## 2026-09-21 工作目录创建与压缩记忆（压缩记忆写入已于 2026-09-22 撤回）

- 新增受控 `zimo.workspace.mkdir`：模型可在已授权目录中逐级创建子目录，父目录须存在，沿用文件写入审批和符号链接/敏感路径拒绝规则。自动与手动压缩成功后，仅从本次用户原文逐字验证的长期偏好候选去重保存到当前账号记忆；保存失败不回滚检查点，并给当前会话提示。新会话首轮继续从账号读取启用记忆。
- 验证通过全仓格式、lint、typecheck、86 文件/324 项单元测试、18 文件/44 项集成测试、Desktop production build，以及手动压缩记忆保存与新会话首轮注入、错误跨会话隔离两条 Electron E2E。集成和 E2E 在允许本机监听的环境复跑通过。

## 2026-09-20 联网搜索与网页读取

- 参考 Abu-Cowork 的“稳定 Tool + 可替换搜索 Provider”架构，新增 `web_search` 与 `web_fetch` 两个模型可见工具；普通会话和 Workflow Agent 直接通过现有流式 Tool Loop 获得完整 Schema，不依赖关键词匹配。开发态 Tool Round payload 可还原实际暴露和调用过程。
- `web_search` 支持账号隔离的 Tavily、Brave 和公网 HTTPS SearXNG 配置；Key 只进入 SecretStore。`web_fetch` 仅允许 GET，按需加载 Mozilla Readability + `linkedom/worker` 提取正文，不继承浏览器登录态；纯 JS worker 入口和失败降级避免可选原生 `canvas` 阻断 Electron Main 启动。
- Main 拒绝 URL 凭据、自定义端口、本机/私网/保留地址和云元数据，公开网页重定向逐跳复检；带搜索凭据的请求拒绝重定向。搜索/读取具备取消、20/60 秒硬超时、2 MiB 下载与 50000 字符正文上限，并复用脱敏 Tool 审计。
- 新增三个具名配置 IPC 和设置页“联网搜索”区域。设计与限制见 [联网搜索与网页读取](docs/features/web-search-and-fetch.md) 和 [ADR 0022](docs/adr/0022-controlled-web-search-and-fetch.md)。
- 自动验证通过 format、lint、全仓 typecheck、87 个文件/324 项单元测试、19 个文件/45 项集成测试、Desktop production build，以及登录/设置页与 Preload 安全表面 2 项 Electron E2E。合并运行 Phase 2 E2E 时，工作目录、审计中心、用户记忆、手动压缩等 5 项通过，既有 Workflow 测试面板仍因缺少“读取本地知识库索引”文案失败；该失败与联网 Tool 链路无关，未描述为全量 E2E 通过。真实 Tavily/Brave/SearXNG 凭据仍待人工 smoke。

## 2026-09-21 助手回复思考时间与工具步骤

- 助手气泡上方展示墙钟耗时：进行中 `思考中 {n}s`，完成 `已完成 {n}s`，停止/失败 `已停止 {n}s`。秒数由 `createdAt`/`updatedAt` 推导，不另存一列。
- 会话 Tool Loop 每条工具调用持久化一条 `AssistantStep`（`0037_message_steps.sql` 的 `steps_json`），流式快照为 `message.steps.updated`。工作目录读取显示 `读取 notes.md` / `已读取 notes.md`；绝对路径只留文件名；MCP 无计划动作时只用工具标题。不展示 reasoning、工具输出、Router、标题或 Workflow 内部步骤。
- 设计见 [助手回复思考时间与工具步骤](docs/features/assistant-reply-timeline.md)。
- 本次 Prettier / typecheck / lint / 单测在本地被跳过，未宣称通过。未跑 integration、build、E2E。已有 `npm run dev` 需重启后才会应用 `0037_message_steps.sql`。

## 2026-09-21 助手回复用量计入分类与标题

- 「共消耗」现合并同一轮发送的主回复/Tool 轮、Router 分类和首轮标题。分类 800ms 超时后不 abort 请求，结束后补记到同一条助手消息；用户停止也显示页脚，已发出的分类仍会补 usage。
- LangChain 分类 HTTP 上限从 800ms 改为 60s，与补记等待对齐，避免服务端仍在计费时客户端已经掐掉请求。
- 停止后立刻停字，但当前模型 HTTP 再读最多 15s 以收取最后一块 usage；见 [停止生成后流式用量未计入](docs/issues/cancelled-stream-usage-not-counted.md)。
- 本次 typecheck / lint / 单测在本地被跳过，未宣称通过。未跑 integration、build、E2E。

## 2026-09-21 助手回复用量页脚

- 已完成的助手气泡显示 `共消耗 {n} tokens · {模型显示名} · {HH:mm}`。流式过程把已有 `usage.updated` 写到进行中的助手消息，完成时刻取 envelope 时间；历史会话继续读 SQLite `usage_json`。
- 提供商未返回 usage 时省略消耗，不伪造 0；模型名来自当前会话 `modelId` 的 `displayName`。思考步骤/Tool 时间线未做。
- 设计见 [助手回复用量展示](docs/features/assistant-reply-usage.md)。
- 相关文件已跑 Prettier；全仓 typecheck 在拆分格式函数前通过。相关 lint 当时 0 error；组件测试首次因 jsdom 未 cleanup 失败 1 项，已补 `afterEach(cleanup)`。拆分后的 lint/typecheck/单测复跑在本地被跳过，未宣称通过。未跑 integration、build、E2E。

## 2026-09-21 应用内 alert/confirm 对话框

- 全部 `window.alert` / `window.confirm` 已换成 `@zimo/ui` 的 `AppDialogProvider`，避免 Windows 上原生模态框归还后 BrowserWindow 无法聚焦输入框。
- 打开时焦点留在 `alertdialog` 内，Escape 取消确认；关闭后若后续流程没有立刻聚焦新输入，则焦点回到触发控件。
- 设计见 [应用内提示与确认对话框](docs/features/in-app-alert-confirm.md)，根因见 [问题记录](docs/issues/windows-native-dialog-focus.md)。

## 2026-09-21 Skill / Agent 列表版本字段

- Skills 列表版本优先映射目录接口 `skillVersion`，缺失或不是 `x.y.z` 时仍使用既有 `version` → `1.0.0` 回退。
- Agents 列表版本优先映射 `agentVersion`，经 Domain / Application / IPC 进入人才库卡片；安装时写入本地 Agent Definition，已安装人才库条目用当前目录版本覆盖本机卡片。缺失时仍展示既有 `1.0.0`。
- 设计见 [Skill Store](docs/features/skill-marketplace.md) 与 [Agent 人才库](docs/features/agent-marketplace.md)。

## 2026-09-20 流式 Tool Calling

- 会话与 Workflow Agent 的 Tool Loop 已从非流式 `invokeWithTools()` 统一切换为 `streamWithTools()`；LangChain Adapter 使用 `bindTools(...).stream()`，文本 chunk 可立即进入会话，分片 Tool Call 参数只在完整聚合后执行。
- 默认 Workspace 让普通“你好”携带工具时，不再等待整段模型回复后才替换“正在思考…”；取消、250ms/4KB 持久化、Schema、审批、超时、审计和多轮 Tool Message 链路保持不变。
- 开发态 Tool Round payload 的 `request.stream` 改为 `true`；Provider 返回不完整工具参数时以 `MODEL_TOOL_CALL_INVALID` 失败，不静默回退非流式请求。设计见[流式 Tool Calling](docs/features/streaming-tool-calling.md)。
- 验证通过相关文件格式检查、全仓 lint/typecheck、85 个文件/316 项单元测试、18 个文件/44 项集成测试和 Desktop production build；本地假 SSE 覆盖文本增量及跨 chunk 工具参数。Phase 2 持久会话 E2E 已通过本次流式文档 Tool 断言，随后仍在既有 Workflow 面板缺少“读取本地知识库索引”文案处失败。全仓 `format:check` 仅被工作区既有未跟踪临时文件 `apps/desktop/electron.vite.config.1789893374502.mjs` 阻断，本次未修改该文件。

## 2026-09-20 手动压缩提示跨会话修复

- 修复手动压缩错误跨会话显示：输入区提示按来源会话 ID 隔离，异步压缩失败不会显示到切换后的会话。新增 Electron 回归用例，先复现、后验证通过；格式、相关 lint、全仓 typecheck、85 文件/316 项单元测试、Desktop build，以及正常压缩和错误隔离两条 Electron E2E 通过。详见 [问题记录](docs/issues/manual-compaction-error-cross-conversation.md)。

## 2026-09-20 手动会话压缩与账号记忆

- 最新已完成的普通助手回复增加“回复操作”：复制当前内容、压缩当前会话；工作流会话不显示压缩入口。手动压缩复用独立检查点、现有会话事件和原文保留，未到自动水位仍可触发；较早完成消息不足时安全拒绝，运行中可取消，账号退出/窗口关闭取消正在整理的请求。
- 新增独立 `0036_user_memories.sql` 和账号隔离 Repository；设置页提供偏好、当前目标、未解决问题的新增、编辑、启用/停用与删除。Main 从有效登录会话确定所有者，Renderer 不可提交账号身份；记忆不从摘要自动提取。普通会话每轮（含新会话首轮）按上限注入有效记忆，当前指令优先于旧记忆；Workflow 内部节点暂不读取记忆。
- 设计与边界见 [手动会话压缩与用户记忆](docs/features/manual-compaction-and-user-memory.md)。本地数据库未做应用层加密；启用的记忆会发送给当前模型，开发态 payload capture 会包含记忆正文。
- 验证：format、lint、typecheck、85 文件/316 项单元测试、18 文件/44 项集成测试、Desktop production build，以及记忆首轮注入、设置页编辑/停用/删除和手动压缩两条 Electron E2E 通过；Phase 2 完整 Electron E2E 的旧有 Workflow 面板“读取本地知识库索引”文案断言仍失败，其余 4 项通过。

## 2026-09-18 会话上下文检查点压缩

- 登录托管 `deepseek-v4-flash` 现在声明 1,200,000 tokens 最大上下文；Application 使用保守字符估算把 System Prompt、Agent/Skill、知识/文档/Workspace、工具 Schema、历史和 120,000 tokens 输出预留计入预算，在 80%/90% 软硬水位执行或强制上下文整理。
- `0035_conversation_context_compactions.sql` 独立保存版本化检查点、原始消息覆盖边界、状态和估算 token；`messages` 继续是完整事实来源。模型 Surface 使用最新有效摘要和摘要后的完成消息，后续压缩会整合上一份摘要，不重新发送已覆盖原文。
- 压缩 Prompt 使用固定中文交接栏目，保留用户纠正、限制、路径、标识符、错误、数字、未完成工作和下一步；压缩不开放 Tool，并支持取消、摘要大小限制、启动中断修复、软水位旧 Surface 回退和硬水位失败关闭。
- 会话详情和严格流事件展示“正在整理”、完成或失败状态；完成卡片显示覆盖位置、压缩前后估算 token 并可展开交接摘要。普通日志只记录 ID、触发类型、token、结果和错误码，不记录摘要正文。
- 设计与实施步骤见 [会话上下文检查点压缩](docs/features/conversation-context-compaction.md)。首版仅处理普通会话运行前的历史；Workflow Agent 节点和同一 Tool Loop 内新增的 Tool transcript 尚未自动压缩，token 估算也不是供应商 tokenizer 的精确结果。
- 自动验证通过 format、lint、全仓 typecheck、83 个文件/308 项单元测试、17 个文件/43 项集成测试和 Desktop production build。Phase 2 Electron E2E 通过 4/5；唯一失败发生在既有 Workflow 测试面板未出现“读取本地知识库索引”，此前的工作目录、审计中心和会话生命周期步骤已运行，本次未修改该 Workflow 权限文案。

## 2026-09-17 任务导航与会话能力交互优化

- “工具”一级菜单改为右侧弹出菜单，不再纵向展开占用任务列表高度；知识库、工作流、通信渠道、MCP 与自动化入口保持原有彩色识别和当前项状态。
- 新增 `0032_conversation_pinning.sql`、严格 IPC 与持久化仓储方法；任务菜单支持置顶/取消置顶，列表按置顶优先、同组最近活动优先排序，置顶本身不篡改活动时间；已置顶任务在标题前显示紧凑图钉标识。
- 会话中直接选择的 Agent、Skill、知识库、Workflow 和 MCP Server 标签在 hover/键盘聚焦时可解除绑定；Agent 继承 Skill 不伪装为可独立删除能力。
- 默认 `Zimo Workspace` 继续为会话提供受控读写，但不再占用输入区；仅显示用户显式添加的外部工作目录。
- 自动验证通过 format、lint、全仓 typecheck、80 个文件/290 项单元测试、16 个文件/40 项集成测试和 Desktop production build；工作目录与持久会话两条 Electron E2E 通过，覆盖工具弹出菜单、置顶跨重启恢复、能力移除和默认 Workspace 隐藏。集成测试首次因执行沙箱禁止监听 `127.0.0.1` 失败，允许本机临时测试端口后全量通过。

## 2026-09-17 Workspace 与 Automation migration 版本碰撞修复

- 修复旧开发数据库将 Automation migration 记录为 25/26、而当前正式序列使用 Workspace 25 与 Automation 26/27 时的启动 checksum mismatch。
- 补充兼容先落地 Workspace 25、再将 Phase 9 审批/审计/授权记录为 26–29 的已确认历史；名称和 checksum 逐项精确匹配后在单事务中顺延到 28–31，再正常应用 Automation 26–27。
- 兼容逻辑只在旧名称和规范化 SQL checksum 精确匹配时事务性顺延账本版本；未知差异仍 fail closed，不覆盖 checksum 或重复执行 SQL。
- 集成测试覆盖两类历史序列、部分应用中间状态和不同 SQL 拒绝路径；用户真实数据库副本完整升级至 31 通过，真实 `pnpm run dev` 启动后账本也已收敛为 Workspace 25、Automation 26–27、Phase 9 28–31，不再出现未处理拒绝。
- 自动验证通过 format、lint、全仓 typecheck、78 个文件/287 项单元测试、16 个文件/40 项集成测试和 production build；详见 [问题记录](docs/issues/migration-version-collision-workspace-automation.md)。

## 2026-09-16 Codex 代码审查工作流

- 新增显式调用的仓库级 `$zimo-code-review` Skill，与“增加功能”“修改问题”使用相同的 Codex 展示和调用方式。
- 默认只读，支持 PR、基准分支、分支、提交、文件或本地未提交变更；完整读取 diff 后结合调用链、契约、migration、测试与项目规范验证问题。
- 结果按 `P0`–`P3` 输出有证据、可定位、可执行的发现；过滤纯偏好和无证据评论，无问题时明确报告剩余验证风险，不自动修改、提交、推送或发布 PR 评论。

## 2026-09-16 Phase 10 本地 Automation 调度

- Automation 已从 Phase 3 内存 Mock 替换为账号隔离的真实本地调度：`0026` 持久化任务、专用会话、下一次执行时间和运行历史，`0027` 增加每日本地时间范围；支持单次、固定间隔、每天、每周和跨午夜时段。固定间隔从保存或重新启用时开始，不再要求首次执行时间。
- 每个任务复用 Conversation 的模型、Agent、Workflow、Skill、知识库和逐项 MCP Tool 绑定，执行仍经既有能力解析、运行时二次校验、Tool 安全边界、取消与流式终态链路；Renderer 不获得通用执行入口。
- Electron Main 每 30 秒发现到期任务，同一任务事务级非重叠、每轮最多启动 3 个；应用关闭期间不执行，恢复后最多补跑一次；登录切换、退出和应用退出会取消当前运行，异常中断会在下次启动标记失败。
- Automation 页面支持创建、编辑、启停、立即运行、计划与时间范围、能力选择、下次时间和近期状态；产品介绍站点、需求、架构、威胁模型、IPC、日志、ADR 与功能文档已同步。
- 冲突合并后自动验证：format、lint、全仓 typecheck、69 个文件/264 项单元测试、14 个文件/29 项集成测试及 Desktop/Website production build 通过。全量 7 项 Electron E2E 中 6 项通过，既有持久会话用例在 Skill 菜单定位处达到 30 秒超时；该失败用例随即单独复跑通过，未发现 Automation 或工作目录合并回归。

## 2026-09-15 Windows 内置 Embedding JSON 换行校验

- Windows 知识库页显示“内置模型异常”，是因为 `getStatus()` 按原始字节校验 HuggingFace JSON，工作区/安装包被 `core.autocrlf` 改成 CRLF 后哈希与固定 LF 值不一致；ONNX 权重本身完好。
- JSON 现先规范为 LF 再哈希，ONNX 仍按原始字节校验；`.gitattributes` 锁定模型 JSON 为 LF。已安装旧包需重新打包才能带上该运行时修复。
- 详见 [问题记录](docs/issues/windows-embedding-model-crlf-checksum.md)。

## 2026-09-15 Windows migration checksum 跨平台修复

- Windows 安装包启动时报 `Migration checksum mismatch for version 1` 的原因是 migration SQL 过去按原始文本计算 SHA-256，而 Vite `?raw` 保留 Windows CRLF/BOM；历史 `0001` 本身没有被修改。
- migration 现统一移除开头 UTF-8 BOM并规范为 LF 后执行和记账；旧账本只对同一 SQL 的换行符/BOM 等价 checksum 自动归一化，真实 SQL 内容变化仍会阻止启动。
- 新增 `.gitattributes` 固定 migration 为 LF，并将 migration 职责从 SQLite 超限入口提取到独立模块；无需删除用户数据库。
- format、lint、全仓 typecheck、60 个文件/237 项单元测试、12 个文件/25 项集成测试和 production build 通过；Windows 安装包仍需在 Windows x64 构建机重新生成并用原报错数据库完成启动 smoke。

最后更新：2026-09-17

当前阶段：V0.2 Phase 10 — 本地 Automation 调度与 Phase 9G 统一目录、审批和审计均已实现；Phase 9E0 实验性宿主机命令已接入，Phase 9E OS 沙箱与受控网络仍暂缓

Windows 打包修复：`pnpm package:win` 在 Node 22 上会因无 shell 直接 `spawn("pnpm.cmd")` 得到 `EINVAL`；越过该问题后 Electron Builder 仍从 GitHub 重复下载已安装的 Electron 44.1.1 并在 TLS 重置后失败。打包脚本现用 Node 调用 pnpm CLI，并复用本地 `electron/dist`。详见 [spawn EINVAL](docs/issues/windows-pnpm-spawn-einval.md) 与 [GitHub 重复下载](docs/issues/windows-electron-builder-github-download.md)。

总体状态：Phase 0–5 已确认，Phase 6 知识链路已完成大部分；Phase 7 已接入受控 Tool/Skill/MCP/Workflow；Phase 8 已完成会话文档首版；Phase 9 已接入工作目录读写、持久授权、审批、基础权威审计和逐条审批的实验性宿主机命令；Phase 10 已完成应用存活期、账号隔离的本地 Automation 调度

审批模式偏好持久化：输入框底部“请求审批 / 帮我批准”的最近选择现写入账号级 `workspace_approval_mode_preferences`。新建任务和下次启动创建默认 Workspace 时沿用该账号偏好；重新打开既有任务仍以会话 grant 为准，账号切换互不影响，首次使用失败关闭为“请求审批”。新增 `0034_workspace_approval_mode_preferences.sql`；单账号升级会继承最近会话模式，多账号历史不做猜测。

审批模式偏好持久化验证：`format:check`、lint、全仓 typecheck、81 个文件/302 项单元测试、16 个文件/42 项集成测试和 Desktop production build 通过。集成测试首次在受限执行环境内因禁止监听 `127.0.0.1` 失败，允许本机临时测试端口后全量通过；定向回归另覆盖账号隔离、单账号升级继承、新任务读取偏好和既有会话不被覆盖。

Phase 9E0 实验性宿主机命令：会话现在稳定暴露单一 `zimo.workspace.run_command`，模型可在任一已绑定 workspace 中使用完整平台 Shell 语法。所有命令统一标记高风险；“请求审批”逐次显示审批卡，“帮我批准”自动执行。Main 通过可替换 `WorkspaceCommandExecutor` 启动 macOS `/bin/zsh -l -c` 或 Windows PowerShell，默认 120 秒、最大 360 秒，使用有限继承环境、输出首尾截断、会话取消和进程树终止。该执行器不是 OS 沙箱，命令拥有当前 OS 用户权限，cwd 只决定起始目录；网络、目录外访问和危险命令内容当前不做强制隔离。后续以 Sandbox Adapter 原位替换，不改变 Tool/审批契约。

“帮我批准”语义修复：真实日志确认会话模式已保存为 `auto_low_risk`，但宿主机命令仍被 `experimental_host_command_requires_approval` 强制转为审批，因此不是 UI 状态丢失，而是旧策略与用户预期不一致。现将内部模式迁移为 `auto_approve`，自动放行文件写入、删除和 `run_command` 等当前可执行动作；`critical`、路径边界违规、内部敏感目录和未注册能力继续拒绝。新增 `0033_workspace_auto_approve_mode.sql` 原子迁移既有会话，并补策略、审批、UI 和 SQLite 升级回归。详见[问题记录](docs/issues/help-me-approve-still-prompts.md)。

“帮我批准”语义修复验证：`format:check`、lint、全仓 typecheck、81 个文件/299 项单元测试、16 个文件/41 项集成测试、Desktop production build 和工作目录模式保存/重载目标 Electron E2E 通过。完整 `phase-two.spec.ts` 运行 5 项中 4 项通过；既有持久会话用例在 Workflow 测试面板缺少“读取本地知识库索引”文案处失败，与本次审批策略链路无关，未将该混合运行描述为全量 E2E 通过。

Phase 9E0 自动验证：`format:check`、lint、全仓 typecheck、81 个文件/297 项单元测试、16 个文件/40 项集成测试、Desktop production build 和 Website production build 通过；新增回归覆盖“模型误传默认 Workspace ID 时仍在用户选择的项目目录执行”。集成测试在受限执行环境内首次因无法监听回环端口失败，允许本机临时测试端口后全量通过。当前开发机已验证命令成功、命令超时和会话取消；Windows x64 打包态 PowerShell、`taskkill` 进程树以及签名安装包仍需人工 smoke。

Shell 工作目录优先级修复：真实模型测试确认会话已添加项目目录后，模型仍可能把隐藏的默认 Zimo Workspace ID 传给 `run_command`，导致 `pwd` 落到应用数据目录且 Git 报“not a repository”。Workspace 上下文现标注内部输出目录与用户项目目录；Application 在存在外部 grant 时把误选 managed ID 的命令改到最近添加的外部目录，模型明确选择其他外部目录时仍尊重选择。审批卡与 Executor 共享最终 grant，避免批准和执行目标不一致。详见[问题记录](docs/issues/command-selected-workspace-precedence.md)。

Phase 9 审批与授权交互增强：审批模式下拉已移动到会话输入框底部、模型选择器之前，新会话默认“请求审批”。账号已放行目录内的普通低风险创建/修改直接执行，高风险修改与删除继续询问。设置页审计中心新增账号级“已放行目录”清单和撤销操作；撤销会同步移除同根外部会话 grant，不删除用户目录。文件动作审计增加有界动作名称、目录显示名和相对目标，绝对路径只由授权清单专用 IPC 展示，普通日志和 append-only 审计事件仍不保存绝对路径。Shell 尚未开放，因此当前没有可记录的命令正文。

Phase 9 审批与授权交互增强验证：与 Phase 10 Automation 及 migration 兼容修复合并后，format、lint、全仓 typecheck、78 个文件/287 项单元测试、16 个文件/40 项集成测试和 production build 通过；工作目录审批下拉及审计中心 Electron E2E 2 项在合并前通过。集成/E2E 在执行沙箱内需允许监听本机临时测试端口。

Phase 9G 统一目录与授权模型：应用运行数据归入 `system/accounts/workspaces`；旧数据库、密钥、知识文件、Skill 包、会话文档和恢复副本在数据库打开前安全迁移。每个会话自动获得不可移除的默认 `Zimo Workspace`，文档资产与普通输出归入同一会话容器。用户选择目录默认允许普通读写；未绑定绝对路径允许有界读取，首次写入通过既有审批卡片后按登录账号持久授权父目录，并继续原运行。`system`、`accounts`、生产安装目录、敏感文件、链接、二进制及危险类型继续硬拒绝。OS 沙箱、Shell、网络和外部应用未接入。

Phase 9G 自动验证：`format:check`、lint、全仓 typecheck、75 个文件/278 项单元测试、15 个文件/29 项集成测试、production build 通过；默认 Workspace、外部目录添加、重载恢复和撤销的 Electron E2E 单独通过。集成测试首次在执行沙箱内因禁止监听 `127.0.0.1` 失败，允许本机临时测试端口后全量通过。旧真实用户数据迁移、Windows 路径/ACL、签名安装包及首次目录外写入的真实模型审批流程仍需人工 smoke。

Phase 9E 沙箱门禁调研：当前 macOS 14 x64 开发机虽存在 `sandbox-exec`，但 Apple 明确不建议第三方产品依赖未公开 SBPL；macOS 后续采用签名 App Sandbox XPC/helper + 安全作用域 bookmark。Windows 后续采用稳定 AppContainer/LPAC + Job Object；Microsoft 新 `Experimental_CreateProcessInSandbox` 仍是 Windows 11 实验 API，不能作为发布基线。仓库继续禁止注册 `run_command`、网络或普通 `child_process` 降级，待 macOS arm64/x64、Windows x64 原型、签名和安装包矩阵全部通过。

Phase 9F 基础审计中心：新增 `0029_security_audit_events.sql` append-only 权威事实、Application 审计服务、有界只读 IPC/Preload API，以及设置页风险/结果筛选和最近 100 条列表。策略自动放行/拦截、审批请求/决策/超时/取消、Tool 执行开始和终态均持久化；只保存枚举、可信 ID、计数、耗时和错误码，不保存路径、正文、参数值、digest 或凭据。副作用 Tool 或自动放行策略在开始审计无法写入时失败关闭；Renderer 无新增、修改或删除审计事件能力。

Phase 9F 基础审计自动验证：format、lint、全仓 typecheck、73 个文件/273 项单元测试、15 个文件/28 项集成测试和 production build 通过；设置页审计中心 Electron E2E 单独通过。集成测试首次仍因执行沙箱禁止监听 `127.0.0.1` 出现 EPERM，允许本机临时测试端口后全量通过。保留/清理、分页及时间/能力/会话筛选、恢复 UI、恶意仓库测试和跨平台发布验收仍待完成。

Phase 9D 受控文件修改：模型稳定获得 `list/search/read/create/patch/delete` 六个产品级 Tool。读取结果返回 SHA-256 与字节数；修改/删除必须提交最新 checksum。创建采用不覆盖语义，修改使用同目录临时文件、落盘同步和原子替换，修改/删除前写入 `userData/system/workspace-recovery` 受管恢复副本。Adapter 拒绝路径穿越、符号/硬链接、秘密与 `.git`/Zimo/依赖/构建目录、二进制、可执行/只读文件、歧义替换、陈旧内容和操作/行数/字节预算超限。低风险创建/修改按授权执行；高风险修改与删除在“请求审批”下询问，在后续扩展的“帮我批准”下自动执行；网络和外部应用仍未注册。

Phase 9D 自动验证：format、lint、全仓 typecheck、71 个文件/269 项单元测试、14 个文件/27 项集成测试和 production build 通过；工作目录绑定、审批模式与跨重启恢复 Electron E2E 单独通过。集成测试首次受执行沙箱禁止监听 `127.0.0.1` 影响，允许使用本机临时测试端口后全量通过。恢复 UI/保留清理、恶意仓库 E2E、macOS/Windows 签名安装包文件系统语义和 Phase 9E OS 沙箱仍待后续验收。

Phase 9C 逐动作审批：新增版本化 `allow | ask | deny` 策略、`0028` 一次性审批事实、Tool 参数校验后的 `PlannedAction` 授权点，以及 `approval.requested/resolved` 流事件。审批绑定 run、Tool Call、action digest 与发起窗口；过期、取消、跨窗口、摘要不匹配和重放均失败关闭。输入区显示一次允许/拒绝卡片，目录胶囊可切换“请求审批 / 帮我批准”；首版后者仅放行低风险动作，现已按用户确认的语义扩展为自动放行当前可执行动作。关键危险和边界违规始终失败关闭。

Phase 9C 自动验证：format、lint、全仓 typecheck、70 个文件/263 项单元测试、14 个文件/27 项集成测试和 production build 通过；工作目录绑定、审批模式切换与跨重启恢复 Electron E2E 单独通过。首次在受限沙箱运行集成测试因禁止监听 `127.0.0.1` 出现 EPERM，允许测试使用本机临时端口后全量通过。签名安装包与真实副作用 Tool 仍需后续阶段人工验收。

Phase 9B 只读工作目录：`0025` 持久化会话目录 grant，Main 原生目录选择和 Preload 文件夹拖放解析真实路径，Renderer/模型仅接收 opaque workspace ID 与显示名。Application 每轮稳定暴露 `zimo.workspace.list/search/read`，按调用分页返回目录项、搜索命中或文本片段，不递归注入整个目录。文件 Adapter 拒绝根目录、用户 Home、绝对/穿越路径、符号链接、敏感文件、常见依赖/构建目录、二进制和超限读取，并支持取消。输入框下方展示可移除的只读目录胶囊；移除绑定不会删除用户目录。文件写入、删除、命令、网络、审批模式和审计中心仍未开放。

Phase 9B 自动验证：format、lint、全仓 typecheck、64 个文件/246 项单元测试、12 个文件/24 项集成测试和 production build 通过；新增 typed bridge 与工作目录原生选择、跨重启恢复、移除 E2E 单独通过。全量 7 项 Electron E2E 中 6 项通过；既有持久会话用例仍在已记录的流式取消“开始”文本 10 秒窗口超时，与本次工作目录链路无关。macOS/Windows 签名安装包仍需人工验收。

会话文档工作区 Phase 8：`0022` 建立 DOCX/XLSX/PPTX/PDF 受控资产、revision 与消息绑定，`0023` 扩展 revision 来源。Phase 8B 以 `officeparser@7.8.0` 实现 digest、页/Sheet/Slide selector、cursor、结构/文本预览与 6,000 字符本轮上下文；Phase 8C 锁定 `docx@9.7.1`、`exceljs@4.4.0`、`pptxgenjs@4.0.1`、`pdf-lib@1.17.1` 并实现四格式创建；Phase 8D 实现不可变 revision、DOCX 替换/追加、XLSX 单元格/公式、Zimo PPTX 重建及 PDF 重排/拆分/表单/水印/页码/叠加；Phase 8E 实现四格式语义重建转换和禁用 JavaScript/网络的 Chromium 中文 PDF 输出。模型会话调用稳定获得 `inspect/read/create/patch/convert` 五个 Tool，由模型自行选择而不依赖文本匹配；文件二进制、路径和完整正文不进入 Renderer 或普通日志。

会话文档无反馈修复：确认开发态 Renderer 已热更新、但运行中的 Preload/Main 尚无 artifact bridge/IPC，用户数据库也未应用 `0022`，调用拒绝后因缺少异常捕获而静默。现由 `useChatArtifacts` 统一捕获 bridge/IPC 异常并提示完整重启，导入期间显示即时状态；详见 [问题记录](docs/issues/chat-document-attachment-no-feedback.md)。

会话文档模型引用修复：真实 payload 证明附件已持久化且首次 inspect 成功，失败由模型在下一轮抄写长 artifact UUID 时改错一个字符导致。模型侧协议现统一使用会话内稳定的 `doc_n` 短引用；内部 artifact/revision UUID 不再进入文档上下文、Tool Schema 或 Tool 结果。短引用仅解析当前会话已发送文档，patch 仍由 Application 使用内部当前 revision 做乐观并发控制；详见 [问题记录](docs/issues/model-document-reference-transcription.md)。

会话文档修改参数修复：真实 Tool Call 证明模型已正确选择 `replace_text`，但旧 `patch.operation` Schema 未公开嵌套字段，导致模型猜测为 `find/replace`，被严格解析器拒绝。现完整声明八种操作的准确参数与边界，并为 `replace_text` 明确 `search/replacement` 示例；执行期严格校验和受控工作区权限不变。

会话文档修改产物修复：真实运行确认 12 处错别字被模型拆成 12 个 patch，造成 12 个中间 revision；DOCX 每轮重建又从显示名额外插入标题，最终形成重复标题。同时 patch 未绑定 assistant 输出，旧消息绑定唯一约束也不能同时保留输入和输出。现以 `operations[]` 和同轮合并实现一次批量修改只提交一个最终 revision；`0024` 将消息固定到具体 revision，最终结果原子绑定到 assistant，预览/另存为读取卡片对应版本。format、lint、全仓 typecheck、53 个文件/214 项单元测试、11 个文件/21 项集成测试和 production build 通过；新增 Word 修改结果 Electron E2E 单独通过。完整 E2E 首次运行的 6 项中 5 项通过，既有 Skill 菜单用例因 DOM 脱离达到 30 秒超时，和本次文档路径无关；详见 [问题记录](docs/issues/document-patch-output-and-duplication.md)。

模型供应商失败诊断：连续真实运行显示文档 `inspect` 在十余毫秒内完成，而 Tool 结果回传后的模型请求约 60 秒失败；原 `conversation.run.failed` 只有失败终态，无法判断上游 HTTP 状态。LangChain Adapter 现为连接测试、流式生成、意图分类、Tool 首轮和 Tool 后续轮记录脱敏的 `model.provider.request.failed`，仅包含阶段、耗时、受限错误标识和 HTTP 状态，不记录请求/响应正文、URL、凭据或 Tool 内容；详见 [问题记录](docs/issues/model-provider-failure-diagnostics.md)。

Phase 8 自动验证：format、lint、全仓 typecheck、52 个文件/210 项单元测试、11 个文件/20 项集成测试、production build 和 5 项 Electron E2E 通过；E2E 覆盖真实系统选择、附件预览、`doc_1` inspect→read 跨轮调用、正文进入相关模型请求、消息绑定/重载后重新生成、四格式模型 Tool 创建、结果卡片和中文 PDF 预览。`officeparser` 明确作为 Desktop 生产运行时依赖并从 Main bundle 外置，避免打包破坏动态 parser/worker 加载；Main 未压缩入口约 7.19 MB。macOS x64 目录包成功生成并启动到登录页，ASAR 已确认包含 `officeparser`、`file-type` 与 `pdfjs-dist`；Windows 及主流办公软件打开、另存为和复杂真实文件仍需人工 smoke。

桌面自动更新（历史）：曾计划 generic HTTPS 稳定通道与启动静默下载；2026-10-19 起客户端与打包配置均已移除远程更新 URL，菜单检查仅提示已是最新版本。

桌面自动更新验证（历史）：曾验证 macOS x64 两阶段 `package:mac` 与 Main 字节码校验；远程更新源与 `electron-updater` 已于 2026-10-19 从仓库移除，自动安装未验收。

Electron 生产字节码保护：Main 生产构建改为 CommonJS bundle，打包采用“临时编译器应用 → 使用锁定的 Bytenode 1.6.0 生成压缩 `.jsc` → 最终打包”的两阶段流程，使字节码与 Electron 44 最终打包态 V8 snapshot checksum 一致；全部成功后原始 Main 代码才被替换为极小加载器。构建门禁拒绝残留 `.js`/`.mjs`、source map、缺失字节码和异常加载器，编译超过 5 分钟会终止；macOS/Windows 打包脚本拒绝跨目标操作系统生成，Windows 额外固定 x64。Preload 继续保持 sandbox，Renderer 和 Preload 不做字节码转换；该能力只提高逆向成本，不替代 SecretStore、签名、公证和服务端秘密边界。Main CJS 同时关闭 Rollup `externalLiveBindings`，修复默认互操作包装在 Electron namespace proxy 上导致的 Transformers 延迟加载失败；实际 Electron 本地模型推理已返回 512 维向量。

Electron 生产字节码保护验证：format、lint、全仓 typecheck、49 个文件/193 项 unit、10 个文件/19 项 integration、生产 build、两阶段 `package:dir`、7 组加载器/字节码结构检查和 macOS x64 打包态启动 smoke 通过；ASAR 中 Main `.js` 为 0，Transformers 延迟 chunk 也已转换为 `.jsc`。Phase 2 E2E 已通过原先失败的知识文档导入与本地 Embedding 环节，但随后在既有流式取消场景中连续两次未在 5 秒断言窗口内显示“开始”，该场景需另行诊断。macOS arm64 与 Windows x64 仍必须在对应目标构建机完成安装、启动和核心能力 smoke。

产品介绍站点：在 `apps/website` 新增独立 Vite + React 静态站点，参考文档型介绍页的信息结构，以 Zimo 当前真实能力整理对话、Agent/Skill、知识库、Workflow、MCP 与安全边界；菜单详解进一步覆盖新建任务、Agent、Skill、知识库、工作流、通信渠道、MCP、自动化和设置，并按已可用、基础能力、功能预览区分状态。支持桌面三栏阅读、移动端折叠目录、键盘焦点和 reduced-motion。站点不接入 Desktop IPC 或用户数据；Automation 当前明确为应用存活期调度，操作系统常驻调度、通用 Shell、Plugin 代码执行及 stdio/私网 MCP 仍未开放。

产品介绍站点验证：`pnpm format:check`、lint、全仓 typecheck、44 个文件/171 项单元测试和 Website production build 通过；另以浏览器完成默认桌面宽度与 390px 窄屏视觉检查。该纯静态 Renderer 变更未运行 Main/IPC/数据库 integration 或 Electron E2E。

产品介绍站点局域网启动：Website 开发与预览服务器固定监听 `0.0.0.0:5174` 并启用 strict port，允许同一可信局域网通过开发电脑内网 IP 访问；配置回归测试锁定监听地址与端口，本机通过回环地址和 `192.168.112.56:5174` 验证均返回 HTTP 200。

产品介绍站点品牌资产：顶部 Logo 与 favicon 已改为复用 Desktop 的 512px 产品图标；首屏 CSS 模拟界面已替换为从隔离 Electron E2E 环境截取的真实新建任务页面，桌面使用 1440×900、窄窗口使用 480×800 响应式截图。截图只包含假认证用户和内置测试状态，自动测试覆盖 Logo 二进制一致性和两张截图尺寸。

产品介绍站点品牌资产验证：Website 定向 format、lint、typecheck、2 个文件/3 项配置与资产测试、production build，以及桌面/390px 窄屏浏览器视觉检查通过；两次隔离 Electron 截图流程通过。全仓 unit 运行时 Website 测试通过，但并行开发中的 `communication-channel-service` 有 5 项既有测试因新增 session 依赖未注入而失败，本次未修改该功能。

登录托管模型增量：登录协议现强制校验响应中的 `modelApiKey`，凭据仅经 Adapter → Application → Main 内存链路进入 safeStorage，认证 IPC 不返回该字段。Main 自动配置固定 ID 的托管 Provider/Model、设为默认并停用遗留 Provider；设置页改为只读展示与连接测试。模型保存失败会回滚登录，退出会清理模型密钥；缺少托管凭据的升级会话需重新登录一次。（后续已取消代码内固定 API 地址与模型名，见 2026-10-19 托管模型条目。）

Agent/Skill 分类表单：Agent 新建/编辑已移除标签输入，分类改为统一 Select，并复用当前本地 Agent 与人才库目录分类；编辑时保留历史分类。Skill 当前仍只允许 Store/本地完整包安装，不创建缺少指令和资源的空 Skill；本地安装只强制 `SKILL.md`，分类优先读取可用 manifest/frontmatter，否则默认“本地”。共用作者编辑器同步采用无标签和分类选择规则。

全局任务导航：左侧菜单使用与会话能力一致的彩色图标和浅色选中态，文字统一为 14px，移除“概览”，“对话”改为“新建任务”；知识库、工作流、通信渠道、MCP、自动化收进可折叠“工具”二级菜单。登录、点击一级入口或任务区“+”时进入不展示在列表中的空白草稿，并保留选择模型、Agent 与资料的会话引导，第一条指令发送成功后自动转为当前任务。现有任务按最近活动时间排序，固定区域独立滚动；任务以标题和右侧时间单行展示，hover 后以 `…` 提供重命名和确认删除，聊天标题栏不再重复显示这两个操作。新任务第一轮回答后由本轮模型生成简短标题；2026-10-08 起不再设置五秒标题层超时，模型失败或空输出时使用首条指令生成本地兜底且不影响主回答，开发态 payload 以 `task_title` 标识额外请求。

账户入口精简：侧栏底部独立“设置”已移除，设置与退出登录统一收进 Zimo 账户菜单，设置页和权限边界保持不变。

桌面应用菜单：Electron 原生菜单已显式中文化，并继续使用标准 role 保留系统快捷键；“开发者工具”只在未打包且由 electron-vite 开发服务器启动时加入，普通构建和正式安装包不显示该入口。

侧栏验证：指定测试账号的生产认证 smoke 已通过，登录后直接落到对话页，概览入口为零、任务区域可见且当前页选中状态正确；验证使用独立临时用户目录，关闭后已清理。Phase 2 聊天 E2E 与 Phase 3 产品导航 E2E 均通过。

会话能力绑定增量：聊天“+”菜单现可直接多选已安装 instruction Skill、选择一个 Workflow，并按名称选择已连接 MCP Server。选择 Server 时将其当前工具快照原子保存到 `0016` 的 Tool ID 集合，切换会话或重启后恢复；模型根据本轮收到的工具说明和 Schema 自主选择具体 Tool。直接 Skill 与 Agent Skill 去重合并，选择 Workflow 后发送会执行保存的 DAG 并把最终输出写回助手消息。Renderer 仍无直接 Tool execute IPC；删除、卸载或断开能力时自动清理会话绑定。

会话 MCP Server 选择验证：Server 工具快照整体选择、整体取消和遗留部分选择状态共 3 项单元测试通过；format、lint、typecheck、127 项全量单元测试、生产构建及 Phase 2 Electron 聊天 E2E 通过。E2E 首次在受限环境因不能监听 `127.0.0.1` 失败，按测试要求在允许本机临时监听后复跑通过。

MCP 列表简化：连接卡片仅展示状态、Server 名称与版本、地址、来源、认证方式、工具数量以及刷新/解绑操作，不再逐项渲染远端 Tool 名称、风险和描述；完整工具快照仍保留在 Main/SQLite 并供受控模型调用。

Skill Store 增量：参考 xclaw 的 `/ai/skill/zimolist` 目录和分类交互，Zimo 现分页获取全部上架 Skill，并与本地已安装 Skill 合并展示。页面保留已安装/未安装两态及安装/重新安装/卸载动作；完整包经路径和体积校验后写入 `userData/accounts/local/skill-runtime`。安装后的 Skill 复用 Agent/会话/Workflow 绑定链路，卸载自动清理活动引用及包与工作数据。

桌面打包 Skill 边界：仓库内 `apps/desktop/resources/skills/` 仅作为开发源文件保留，Electron Builder 的通用、macOS 和 Windows 文件规则均显式排除该目录，且不通过 `extraResources` 分发；用户安装的 Skill 继续只存放在 `userData/accounts/local/skill-runtime`。

默认回复语言：普通会话、Agent、直接 Skill、模型 Tool Calling 和 Workflow Agent 统一在 Application System Prompt 中要求默认使用简体中文；英文 Skill、Tool 输出或参考资料不再自动带偏最终回复语言，用户当前请求明确指定其他语言时仍可切换。

Skill Store 密度优化：分类改为隐藏原生滚动条的紧凑横向导航，溢出时显示左右翻页按钮和渐变边缘；Skill 卡片缩小字号、图标、留白与操作区，响应式提升到每行 3–5 项，并移除来源展示。筛选和搜索结果统一把已安装 Skill 排在未安装 Skill 前面，同一状态内保持原目录顺序。

受审核脚本 Skill：`.py/.js/.mjs/.cjs` 现在按已安装清单动态注册为 `skill.<skillId>.run_script`，模型只能传入枚举脚本和有界字符串参数；执行使用固定解释器、`shell:false`、最小环境、独立持久化工作区、30 秒超时/取消、输出上限及现有 Tool 审计。该能力信任上传审核而非 OS 沙箱；旧 Skill 需重新安装补齐此前未保存的脚本。

模型工具能力：托管的 `deepseek-v4-flash` 固定声明流式文本与 Tool Calling 能力，支持会话 Skill/MCP 和 Workflow Agent；能力不再由 Renderer 表单修改。

统一身份认证增量：登录页已由 Mock 改为员工账号 ID/手机号登录，Main 按 xclaw-manager 协议调用固定 HTTPS `/zimoLogin` 并在恢复时调用 `/verify-token`。密码不持久化，Token 只进入 safeStorage SecretStore；`0014` 的 SQLite 会话只保存云端用户资料和 secret ref。旧 Mock 会话升级后失效，生产真实账号 smoke 待人工执行。

通信渠道增量：原 Plugin 菜单已替换为内置个人微信 Clawbot 与邮箱。微信除 5 分钟二维码绑定外，已增加按登录账号隔离的 `getupdates` 长轮询、SecretStore 游标/`context_token` 恢复、SQLite 去重收据、专用“微信助手”普通会话和原消息上下文即时回复；登录恢复会启动监听，退出、解绑和应用退出会停止，页面展示真实运行状态并可在微信先发消息激活后发送测试消息。远程消息不会授予 Agent、Skill、Workflow 或 MCP 权限，图片、文件、群聊、邮件收取和 Workflow 主动通知尚未接线。`0021` 只把可确认唯一当前账号的旧绑定迁移给该账号，未知归属不会激活。

微信助手基础链路自动验证：format、lint、typecheck、188 个 unit、19 个 integration、desktop build 和 4 个 Electron E2E 已通过；集成测试因需要回环临时服务在允许本机监听的环境执行。真实腾讯服务仍需用实际微信账号人工验证扫码、首条消息激活、冷启动游标恢复、上下文过期与测试消息可见性。

通用 MCP 增量：GitHub 使用官方通用 `/mcp/` endpoint，也可连接目录中的其他公开 HTTPS Streamable HTTP Server；Main 自动完成 initialize、检查 tools capability、分页 tools/list，并将服务端暴露的全部工具存入 `0013` 多 Server Registry。Agent/Workflow 可绑定 Server，绑定后把完整工具集合交给支持 Tool Calling 的模型；模型选择后经本轮暴露校验、参数边界、20 秒超时、取消、输出上限和审计调用标准 tools/call，结果作为 Tool message 返回模型。当前测试策略不逐 Tool 限制或确认。

MCP 双入口与 OAuth 增量：MCP 页面现区分“官方服务授权”和“自定义 MCP 服务”。连接记录持久化 `catalog/custom` 来源；认证支持 `none/bearer/oauth`。标准 OAuth 由 Main 使用 MCP SDK 完成元数据发现、动态客户端注册、PKCE、随机 state、系统浏览器和一次性 loopback 回调，5 分钟超时；Token、动态客户端信息和刷新状态只进入 SecretStore，成功后继续 initialize/tools/list。暂未为腾讯会议等私有 Token/Header/CLI 协议伪造标准 OAuth 预设。

MCP 固定凭据目录：当前页面提供 17 个受信 HTTPS 服务，按目录定义执行 OAuth、Bearer、专用 Header、固定 API Key Header、Query Key 或免认证连接；probe 不写数据库或 SecretStore。腾讯会议仍由 Main 注入 Token 和 Skill 版本 Header，不依赖 Python Skill。所有 Server 统一保留 `tools/list` 完整目录，不按厂商或工具名称过滤；选择 Server 即授权当前快照，远程写工具可由模型选择。自定义 Server 可从 MCP 页面新增，当前限公网 HTTPS 与 none/bearer/oauth 认证。

MCP 独立编辑页与常用服务目录：MCP 卡片的编辑操作进入带返回操作的独立配置页。企业微信、Notion、Linear、Stripe、Canva、Atlassian 已移除，升级启动时同步清理遗留连接、绑定与凭据；保留 GitHub、Sentry、Hugging Face、Context7、Microsoft Learn，并新增腾讯文档、高德地图、千图 AI、EdgeOne Pages、有活招工、盈米基金、滴滴出行、今日投资、麦当劳中国和 UAPI。Main 固定 Header/Query 凭据放置方式，Renderer 不能覆盖 endpoint、认证方式或秘密字段名称。

MCP 国内目录认证：新增 `0020` 顺序迁移保存 `api_key/query_token` 认证类型；API Key 仍只进入 SecretStore，SQLite endpoint 不含 Query Key。网关按受信 Server ID 临时注入腾讯文档/盈米/UAPI Header，以及高德/滴滴/今日投资 Query Key；自定义 Server 不能使用这些固定认证类型。

MCP 列表交互：新增名称/描述/地址搜索与全部、已连接、未连接筛选；已连接服务在搜索和筛选后优先排序。新增 MCP 与编辑操作均进入独立页面。公共 Button 增加不可压缩和单行文本约束，修复紧凑卡片中“编辑”等短按钮被挤成两行的问题。

麦当劳 MCP 编辑提示：官方目录继续固定 `https://mcp.mcd.cn` 和 Bearer Header，编辑页明确展示请求头格式，并提示只填写 Token 本身、已有 Secret 不回显及更换后需重新测试保存；桌面回归覆盖 MCP Token 输入可编辑。

MCP 工具 Schema 兼容：所有 Server 的 `tools/list` 参数 Schema 已取消 12 层嵌套和单数组/对象 500 项限制，改为有界 JSON 序列化解析；仍保留单 Tool Schema 50000 字符、单 Server 500 个 Tool 和完整快照 1900000 字符上限。回归覆盖 20 层与 501 属性 Schema 可发现、超体积 Schema 继续拒绝；format、lint、typecheck、151 项单元测试、19 项集成测试和 production build 通过。

腾讯文档 MCP 工具名兼容：Gateway 与 Application Registry 统一接受 MCP 标准中的点号命名，腾讯文档 `doc.*`、`smartcanvas.*` 等工具可进入完整快照；模型仍使用本轮安全别名。发现阶段新增 `mcp.discovery.response.rejected` 安全诊断，区分工具数量、名称、Schema 和目录体积拒绝且不记录远端正文或凭据；format、lint、typecheck、173 项单元测试、19 项集成测试和 production build 通过，真实 Token 连接待人工复测。

MCP 传输失败诊断：Streamable HTTP Gateway 新增 `mcp.transport.request.failed`，区分 `connect/tools_list/tools_call` 并只记录可信 Server ID、Tool 名、耗时、受限 SDK 错误类型/错误码和 HTTP 状态码；不记录异常正文、endpoint、Header、Token、参数或远端响应。腾讯文档异步进度查询可据此区分 429、5xx、网络重置和协议错误。

MCP 运行内 Session 复用：Conversation/Workflow Agent 的同一 Tool Loop 现在按可信 `runId + serverId` 复用一个已初始化的 Streamable HTTP Session，避免每个 Tool 重复 `initialize`；成功、失败和取消均在循环 `finally` 关闭，传输失败会立即淘汰 Session 并允许后续重连。Session 与凭据只驻留 Main 内存，不跨运行复用。

滴滴 MCP 响应兼容：诊断确认 `taxi_estimate` 的 `structuredContent` 含 2626 项数组、总计 118542 字符。Tool 结果通用归一化只保留 JSON 序列化结果 90000 字符总上限；滴滴价格预估在 Main 进一步只投影官方流程所需的 `traceId`、车型名称、分类标识和价格，结构不符时降级文本通道。format、lint、typecheck、146 项单元测试和 production build 通过，等待真实服务复测。

腾讯会议保存修复：连接测试成功但保存失败的原因是既有 SQLite `mcp_connections.authentication` CHECK 尚未包含 `header_token`。新增 `0018` 顺序迁移扩展认证枚举，并在重建连接表时保留已有连接、工具快照、secret ref 及 Agent/Workflow 绑定；升级路径集成测试覆盖旧 Bearer 连接保留和腾讯会议 Header Token 写入。

能力删除级联：Agent、Skill、知识库、Workflow 和 MCP Server 不再因会话、Agent 或 Workflow 正在引用而拒绝删除。`0019` 在删除事务内自动清理活动绑定；引用被删节点能力的 Workflow 自动禁用，AgentRun 历史保留原 Agent ID 快照。Application/Main 的引用拦截已移除。

Phase 7.1 治理进度：P0 已完成。Application 入口按认证、知识、原型、Skill、路由、模型和会话拆分为领域服务，1907 → 29 行；Electron Main 按 App/Auth、模型、会话、原型与知识 IPC 拆分，972 → 391 行。新增模块均低于 600 行且公共 API、IPC 与持久化格式不变。SQLite 与 Contracts 仍在 P1 治理清单中。

列表 UI：Agent、Skill、知识库、Workflow、Plugin、MCP 和 Automation 使用响应式多列操作卡；列表不再附带详情区，新建/编辑、知识文档和 Workflow 编排进入独立页面，启停、删除与模块快捷操作留在卡片中。Renderer 原生下拉框已统一替换为带明确触发器、选中态和键盘导航的自定义菜单。

工程规范：在原代码规范基础上新增项目工程、TypeScript、React、Electron/Node.js 和 Git 专项规范，覆盖架构与目录、依赖与配置、数据迁移、契约、安全隐私、性能资源、可访问性、测试文档、代码评审和发布流程；根 `AGENTS.md` 已纳入按任务读取规则。

会话体验：消息列表支持首次打开、发送和流式响应智能贴底；用户上翻后暂停跟随并提供“回到最新”。输入框支持 72–180px 自动增高；底部仅常驻“+”、已选能力小字摘要、模型和发送操作，Agent、直接/随 Agent Skills、知识库、Workflow 与 MCP Servers 收入能力弹层。选择即写入会话授权；能力保存期间菜单锁定，避免连续变更相互覆盖。

RAG 文档：已补充当前本地 BGE、文件解析与分块、SQLite FTS5/向量存储、RRF 混合召回、会话/Agent/Workflow 上下文注入、引用快照、降级策略和现有限制的统一实现说明。

模型请求诊断：会话生成和 Workflow Agent 节点均在 Model Gateway 调用前写入 `model.request.prepared` 安全摘要，可核对实际模型、Agent、Skill package/version、知识库及消息角色/长度；日志明确不保存消息、System Prompt、Skill 指令或检索正文。

开发态 Payload 诊断：根目录和 Desktop 包的 `pnpm run dev` 默认将会话及 Workflow Agent 节点的完整 Model Gateway messages 写入同一个权限 `0600` 的 `llm-payloads.jsonl`，并以 `conversationId` 或 `workflowId/nodeId` 区分来源；普通日志和打包应用仍不记录正文，连接凭据始终排除。

Tool Calling Payload 诊断：会话和 Workflow Agent 每轮调用现在追加 `conversation_tool_round` / `workflow_tool_round` 记录，包含该轮实际暴露的 `request.tools` 和模型返回的 `response.toolCalls`；后续轮次 messages 可还原 Tool 结果回传链路。该内容只进入开发态敏感日志，API Key、MCP Header 与 SecretStore credential 仍不记录。

Skill 兼容修复：内置“网页摘要”已补全 instruction package 元数据；启动时幂等修复旧数据库中的不完整记录，解决 Agent 可绑定但运行时报“Skill 未安装或未启用”的状态矛盾。

本地 Skill 创建：项目维护的 `skill-creator` 在隔离工作区中初始化、分段写入并校验完整目录；固定 Creator 身份与权限可调用受控安装 Tool，目录绑定当前 ID/checksum/workspace 后复用现有包校验、快照和 Repository 安装链路。Tool 不可用或失败时才回退到手动“本地安装”，不扫描应用数据或直接修改安装记录。

会话能力恢复：会话默认 Agent 已通过 `0009` migration、Repository、Application、严格 IPC 和 Renderer 全链路持久化；选择 Agent 即代表授权该会话后续消息直接使用，切换会话或重启后恢复 Agent 及其派生 Skill，不再重复确认。

## 阶段状态

| 阶段                             | 状态   | 备注                                             |
| -------------------------------- | ------ | ------------------------------------------------ |
| Phase 0 架构和规范               | 已确认 | 需求、架构规范和 7 个 ADR 已确认                 |
| Phase 1 Electron 基础与设计系统  | 已确认 | 安全桌面壳与本地基础已确认；登录已由 V0.2 替换   |
| Phase 2 真实模型对话             | 已确认 | 已切换为登录账号托管的单一 DeepSeek 模型         |
| Phase 3 产品模块 UI 原型         | 已确认 | 用户于 2026-09-03 明确要求继续进入 Phase 4       |
| Phase 4 Intent Router V0         | 已确认 | 用户于 2026-09-03 明确完成验收                   |
| Phase 5 Agent + Skill Runtime    | 已确认 | 用户验收后明确要求优先进入知识库检索             |
| Phase 6 Knowledge Retrieval      | 待验收 | 6A–6B 初步确认；6C Grounding 等待验收            |
| Phase 7 Workflow/Controlled Tool | 待验收 | 受限 DAG、首个只读 Tool 与 GitHub MCP 发现已接通 |

## 统一身份认证增量

- 已移除 Desktop 对 `MockAuthProvider` 的依赖，新增独立 `@zimo/auth-zimo` Adapter；
- 按 xclaw-manager 使用 `POST /zimoLogin` 的 form-urlencoded `username/password`，并通过 `GET /verify-token` 恢复校验；
- 远程认证基址由部署配置；开发测试覆盖仅允许 loopback HTTP(S)，仓库内不硬编码生产 URL；
- 登录请求 15 秒超时、拒绝重定向、响应限制 256 KiB，并严格提取 Token 与用户字段；
- 密码不持久化，Token 仅写入 safeStorage SecretStore；`0014` SQLite migration 只保存非敏感用户资料和 `token_secret_ref`；
- 登录页、账户菜单与设置页已移除 Mock 文案；旧 Mock 会话升级后失效并要求重新登录；
- xclaw 的 OpenClaw 工作目录/Gateway 初始化未复制；登录响应的模型 Key 已按独立模型服务边界接入。

## Phase 2 完成项

- 增加 `0002_models_and_conversations.sql`，落地 provider、model、conversation、message 表、约束和索引；
- 实现 SQLite ModelRepository 与 ConversationRepository，包括默认模型、软删除、active run 互斥和启动中断修复；
- 原 Phase 2 实现过模型提供商管理；当前生产 UI 已收口为登录托管的固定模型，只保留连接测试；
- `modelApiKey` 由登录响应瞬时下发，仅在 Main 使用；数据库和 IPC 响应只包含随机 `secretRef`/尾号；
- 实现安全 Key 新建、替换与删除补偿，safeStorage 不可用时拒绝保存；
- 新增独立 `@zimo/model-langchain` Adapter，以 LangChain `ChatOpenAI` 对接 OpenAI-compatible Chat Completions；
- 将厂商 chunk 映射为稳定 ModelStreamEvent，再由 Application 生成带 sequence 的 AgentStreamEnvelope；
- 实现每会话单 active run、AbortSignal 停止、唯一终态、失败保留部分正文和启动恢复；
- assistant 文本按 250ms 或 4KB 阈值持久化，终态强制 flush；
- 实现对话创建、历史恢复、重命名、软删除、重新生成和模型切换；
- 实现流式对话 UI、会话列表、当前模型、状态提示，以及 Markdown、代码块和基础表格；
- 模型输出链接不直接打开，V0.1 不注册 Tool、Shell、文件、MCP 或其他高风险执行能力；
- 更新模型兼容范围、LangChain ADR、运行说明和阶段计划。

## 验证结果

- `pnpm format:check`、`pnpm lint`、`pnpm typecheck`：通过；
- `pnpm test`：通过，33 个文件、124 个 unit/contract/evaluation 测试；
- `pnpm test:integration`：通过，9 个文件、18 个 integration 测试；
- `pnpm build`：通过，Main、sandboxed Preload 和 Renderer 产物生成；
- `pnpm test:e2e`：通过，4 个真实 Electron 用例；
- 邮箱地址登记增量：strict IPC、Application 旧 secret 清理、`0010 → 0011` 数据迁移及 Phase 3 Electron E2E 通过；
- fake provider：普通 JSON 连接测试、SSE 文本分片、鉴权错误和 AbortSignal 路径通过；
- 对话 E2E：登录托管 Provider、连接测试、固定默认模型、流式回答、重启恢复、重命名、重新生成、停止和删除通过；
- 安全 canary：测试 API Key 未出现在 Renderer 响应、SQLite、日志或加密 secrets 文件明文中；
- Phase 1 安全回归：Renderer 仍无 `process`/`require`，`window.zimo` 只暴露具名 models/conversations/prototypes/router/skills/workflows/tools/communicationChannels/mcp 能力。
- Phase 3：七类 Mock Repository contract、严格 prototype Schema、导航、Agent 新建、知识文件 Mock 元数据和 MCP 未开放断言通过；
- Phase 7：工作流结构/引用校验、SQLite 恢复、拓扑执行、Tool 注册/Schema/确认/超时/审计，以及只读知识 Tool 的 Electron E2E 通过；
- 通用 MCP：Registry 全量快照、SecretStore 分离、多 Server Repository、动态受控工具注册、本轮越权拒绝、单次 Tool 20 秒超时及 LangChain OpenAI Tool Calling 请求格式通过自动测试；测试期已取消单次运行 12 轮/36 次调用上限，循环持续到模型返回最终回答或被取消/调用失败，正式发布前仍需补异步任务状态和总运行预算；真实服务留作人工 smoke；
- Tool Calling Payload：会话与 Workflow 每轮暴露工具和模型返回调用的单元测试、敏感日志落盘测试通过；`format:check`、lint、typecheck、127 项单元测试、18 项集成测试和 production build 全部通过；
- MCP 固定凭据目录：format、lint、typecheck、130 项单元测试、18 项集成测试、production build 与 Phase 3 Electron E2E 通过；企查查和腾讯会议真实 Token 连接已人工通过；
- MCP 全量工具目录：腾讯会议专用只读白名单已移除，probe/connect/refresh 均保留服务端完整 `tools/list`；单元测试覆盖查询与写入工具同时保留，format、lint、typecheck、130 项单元测试、18 项集成测试和 production build 通过；真实创建会议调用待人工验收；
- 能力删除级联：format、lint、typecheck、130 项单元测试、19 项集成测试、production build 和 Phase 3 Electron E2E 通过；新增真实 SQLite 用例覆盖 Agent、Skill、知识库、Workflow、MCP 的会话/Agent/Workflow 引用清理、Workflow 禁用及 AgentRun 历史保留；
- MCP 常用 HTTPS 目录：format、lint、typecheck、133 项单元测试、19 项集成测试、production build 和 Phase 3 Electron E2E 通过；10 个新增服务的真实账号授权与工具调用留作逐项人工 smoke；
- MCP 国内 HTTPS 目录：移除 Notion、Linear、Stripe、Canva、Atlassian，并在启动时清理其遗留连接、绑定和凭据；新增腾讯文档、高德地图、千图 AI、EdgeOne Pages、有活招工、盈米基金、滴滴出行、今日投资、麦当劳中国和 UAPI。format、lint、typecheck、138 项单元测试、19 项集成测试、production build 与 Phase 3 Electron E2E 通过；10 个服务的真实凭据连接与工具调用待人工逐项验证；
- MCP 列表与手动新增：搜索、连接状态筛选、已连接优先排序和公网 HTTPS 自定义 Server 独立新增页已完成；公共 Button 的单行与防收缩规则修复列表操作文字换行。format、lint、typecheck、149 项单元测试、19 项集成测试、production build 与 Phase 3 Electron E2E 通过；
- MCP 双入口/OAuth：连接来源与 OAuth 契约、opaque credential 持久化、`0015` SQLite 升级、Main/Preload/Renderer 构建及桌面回归通过；标准 OAuth 的真实服务商授权仍待人工 smoke；
- 会话能力绑定：严格原子契约、`0016` SQLite 持久化/引用查询、无 Agent 直接 Skill Prompt、逐项 MCP Tool 暴露、Workflow 对话执行及 reload 恢复均通过自动测试；
- Agent 人才库：目录/分类协议、Token 隔离、角色 Markdown、安装补偿、并发防重、远端 ID 卸载、`0017` SQLite 恢复及 Electron 安装 UI 通过自动测试；
- Preload 仅提供只读 `tools.list`、具名 `workflows.run/cancel/onStream` 与 MCP Registry 连接管理；不存在 Renderer 直接执行 Tool 的 IPC，Renderer 仍无 Node、密钥或数据库权限。
- Electron 中文菜单：macOS/Windows 模板单测与 Phase 1 生产式 Electron E2E 通过，非开发模式不存在 `toggleDevTools` 菜单项。
- 登录托管模型：缺少 `modelApiKey` 的响应拒绝、固定生产地址/开发 loopback 边界、默认 DeepSeek、遗留 Provider 停用、退出清密钥、连接测试、对话/Workflow 运行、重载恢复与全链路 canary 均通过；完整 Electron E2E 4 个用例通过。
- Agent/Skill 分类表单：format、lint、typecheck、33 个文件/124 个单元测试和 production build 通过；Phase 3 Electron E2E 验证 Agent 标签输入不存在、人才库“人力资源”分类可选且保存后正确展示。
- 本地 Skill 无 manifest 兼容：Adapter 回归覆盖 `SKILL.md`-only、frontmatter 元数据和畸形 manifest 非阻断；format、lint、typecheck、全量 124 个单元测试、production build 与真实 Electron 本地目录安装 E2E 通过。
- Creator 直接安装：固定 package ID/权限、workspace/checksum 绑定、目录逃逸与符号链接拒绝、自覆盖保护、取消和既有安装服务复用均有自动测试；format、lint、typecheck、43 个文件/164 项单元测试、10 个文件/19 项集成测试、production build 和 4 项 Electron E2E 通过。E2E 首轮曾在既有慢响应首分片 5 秒断言处超时，失败截图仍显示正常生成中；该完整用例单独复跑和随后全套复跑均通过。
- Creator 参数与商店身份修复：保留 `run_script` 严格 Schema，通过 Tool 字段说明和完整 JSON 示例约束 `--append` 等参数进入 `arguments`；直接安装授权同时覆盖项目本地身份和官方商店固定身份/来源组合，避免新版包被商店元数据覆盖后失去安装 Tool。format、lint、typecheck、43 个文件/167 项单元测试、10 个文件/19 项集成测试和 production build 通过；沙箱内首次集成运行因禁止监听回环地址失败，允许本地临时测试服务后全量通过。Creator 校验器不适合校验自身文档，其中面向作者的 `TODO` 约束会按既有规则被视为占位内容。
- 开发态托管模型编辑：开发服务器设置页允许更新固定登录模型的模型标识、HTTPS/loopback API 地址和可选新 Key；当前 Key 永不回显，留空复用登录凭据，填写后轮换 SecretStore 引用。Application 拒绝非固定 Provider/Model、新增删除、能力/名称/停用变更，打包环境继续只读。format、lint、typecheck、43 个文件/170 项单元测试、10 个文件/19 项集成测试、production build 和 4 项 Electron E2E 通过；E2E 额外确认打包 Renderer 不显示保存入口或新 Key 输入框。

## 已决事项

- LangChain 锁定 `@langchain/openai 1.5.11` 与 `@langchain/core 1.2.9`；
- 首批通用 Adapter 只承诺 OpenAI Chat Completions 标准文本子集；
- `streamUsage:false` 提高第三方兼容性，usage 缺失时保持未定义；
- 会话直接绑定 MCP Tool 的测试期上限由 50 提高到 300，契约与 Application 共用同一常量，允许腾讯文档当前 224 个工具作为完整 Server 快照被选择；后续仍需以 Server ID 持久化和语义 Top-K 替代全量暴露；
- 不自动重试模型生成，避免重复回答或计费；用户通过“重新生成”显式重试；
- 开发 fake provider 仅通过显式环境开关允许 loopback HTTP，普通配置必须为 HTTPS；
- LangGraph 保持未接入；模型自主 Tool Calling 对绑定的 MCP Tool 和受审核脚本 Skill 开放，Router 仍仅识别和展示，固定不执行。通用 Shell、包外脚本、安装 Hook 与 Plugin 代码仍禁止。

## 遗留与风险

- 未使用真实外部 provider/API Key 做自动测试；真实端点是可选人工 smoke，差异需按 fixture 补充；
- 当前每个 provider UI 管理一个主模型；Repository 与 DTO 支持模型数组，批量模型发现/管理后续增强；
- 普通会话已有保守的本地上下文预算与检查点压缩，但尚未接入供应商精确 tokenizer，也未覆盖 Workflow Agent 节点和单轮 Tool Loop 的动态 Tool transcript；服务端真实上限若小于声明值仍可能先返回安全错误；
- Renderer 产物约 1.86 MB、Main 约 5.80 MB（未压缩），后续应进行页面、MCP 客户端与文档解析 Adapter 拆包；
- macOS 未签名开发构建的 safeStorage 行为不能替代正式签名构建验证；
- Drizzle `node:sqlite` Adapter 仍使用 RC 版本，依赖升级需运行 migration、integration 和 E2E；
- 本地会话正文未做应用层整体加密，依赖 OS 账户和磁盘保护；
- 真实模型输出仍可能包含错误或恶意文本；当前禁 raw HTML、禁链接执行，模型也不能自主获得 Tool 权限。
- Electron 44 与 electron-vite 5 的开发启动兼容已增加 `predev` 运行时预检；新依赖目录首次启动仍依赖 Electron 下载源可用。

## Phase 3 完成项

- 增加七类产品 Definition、专用 Repository 端口和内存 Mock Adapter；
- 增加统一但严格的 prototype list/get/mutate IPC 传输契约；
- 实现 Agent、Skill、知识库、Workflow、Plugin、MCP、Automation 导航与主要交互；
- 使用 React Flow 实现节点拖拽、连接、配置及 Zimo WorkflowDefinition 映射保存；
- 所有真实执行类入口保持 `CAPABILITY_UNAVAILABLE`，不引入危险运行时；
- 新增 Repository、Application、Schema、安全与 Phase 3 Electron E2E 覆盖。

## Phase 4 完成项

- RouteTarget 从 Agent、Skill、Workflow Mock Repository 实时投影并校验启用状态；
- 本地显式命名规则优先，其余请求复用当前模型进行严格 JSON 分类；
- 800ms timeout、0.7 阈值以及所有降级原因均不阻塞普通聊天；
- `route.completed` 在模型消息事件前发送，UI 展示目标、置信度和未开放说明；
- `0003_intent_routes.sql` 保存 fingerprint、长度和路由指标，不保存输入正文；
- 结构化日志记录耗时、置信度、intent、target 和 fallback，不记录消息；
- 10 条中英文 fixture 准确率 100%，fallback rate 40%，本地 p50 0.276ms、p95 3.409ms；
- Domain、Schema、Application、Adapter、SQLite 和 E2E 均断言 `shouldExecute=false`。

## Phase 5 完成项

- Zimo Agent 页面接入现有系统的分类、人才库、账号 Agent 列表、创建和删除接口；人才库与手动创建的本地 Agent 合并为单一区域，安装前复用同一账号已有远端 Agent，安装后的本地 Definition 可直接用于会话与 Workflow；
- Agent 人才库严格区分 catalog ID、远端用户 Agent ID 与本地 Agent ID，远端 `modelApiKey` 永久忽略；角色 Markdown 仅从公开 HTTPS 有界下载且不携带登录 Token；
- `0017_agent_marketplace.sql` 保存两个远端关联 ID，安装/卸载加入超时取消、引用级联清理、补偿删除和脱敏审计；
- `0004` 将 Agent 和 Skill 从内存 Mock 迁移到 SQLite，并用一次性标记初始化内置示例；
- 本地 instruction Skill 只强制非空 `SKILL.md`；manifest 可选且无效内容不阻断，元数据安全回退，同 package ID 安全更新；
- 拒绝脚本/依赖字段、未知权限、超限文件、符号链接和目录逃逸，Renderer/日志不接收路径；
- Agent 编辑器支持选择模型、绑定已安装 Skill，并阻止保存无效引用；删除使用中的 Skill 会自动解除绑定；
- Agent System Prompt 与绑定 Skill 编译为受限模型上下文，不注册 Tool、Shell、MCP 或文件能力；
- Agent 详情和聊天页可手动选择 Agent，绑定后由会话作为唯一运行时来源，发送接口不接受临时 Agent 或确认状态；
- 会话默认 Agent 跨切换和重启恢复，绑定 Skill 从 Agent 实时派生；删除 Agent 时会话自动解除绑定；
- Router 命中只显示建议；用户选择并绑定后，下一条消息创建 AgentRun；
- `0005` 持久化 AgentRun 模型、Skill ID、状态和错误码，不保存 prompt 或消息正文；
- Electron E2E 覆盖本地 Skill 安装/恢复、Router 建议、会话切换恢复和 Agent 模型流式回答。

## Phase 7 Workflow Editor

- 工作流从内存 Mock Repository 迁移到独立 SQLite Repository；
- 参考 FastGPT 的编辑流程实现节点库、无限画布和配置侧栏；
- 节点卡片展示类型、配置摘要以及四向输入/输出端口；
- 支持搜索添加、网格拖拽、连接、缩放、小地图、撤销/重做、快捷保存和删除；
- Agent、Skill、知识检索与 Tool 节点可选择已启用的本地实体或可信能力；
- 保存时校验单一开始节点、结束节点、边端点、无环结构和引用状态；
- 测试面板支持输入、运行/取消、逐节点状态、耗时、跳过原因和最终输出；
- 受限运行时支持开始、知识检索、instruction Skill、受控只读 Tool、Agent 和结束节点；
- Workflow Agent 节点接入统一模型请求安全摘要和开发态完整 payload 诊断；
- 条件、人工确认、Shell、Plugin 与代码节点仍不执行；Workflow Agent 节点可调用其绑定 MCP Server 当前快照中的工具；
- Tool 节点只接受 Main/Application 可信注册表中的能力；
- 首个 `zimo.knowledge.search` 仅只读检索显式配置的已启用知识库；
- 测试面板在每次运行前展示权限、只读/开放世界属性和超时并要求确认；
- 参数拒绝未知字段，输出限制大小并作为不可信数据注入，调用支持取消和硬超时；
- 审计只记录 ID、权限 ID、参数键名、确认、耗时、结果和错误码，不记录值或输出；
- MCP 信任、命名、HTTPS/stdio、SecretStore、能力快照和重新审批边界已由 ADR 0010 固化；GitHub HTTPS 已真实连接，仓库搜索已受控执行。

## 下一步

下一步人工验收 Phase 8 全链路：选择/拖放、预览、模型总结/读取、四格式创建、有限修改、转换、重启恢复与另存为，并分别在 macOS/Windows 用主流 Office/PDF 阅读器打开产物。通过后再按真实使用结果排定 Utility Process 隔离、PDF 缩略图、模板槽位/样式、PDF 合并、CSV 产物与版本恢复 UI；并行遗留仍包括真实认证、标准 MCP OAuth、Agent/Workflow Toolset/语义 Top-K 和 P1 治理。

Phase 9 下一步分成两条：平台侧在具备 macOS arm64/x64、Windows x64 构建机和签名身份后实现并验收原生 Sandbox helper，验收前不开放命令/网络；应用侧继续 Phase 9F，补审计保留清理、分页和时间/能力/会话筛选，并为 `workspace-recovery` 增加用户可见恢复/删除流程。最后执行恶意仓库、Prompt 注入、审批疲劳、秘密 canary 和签名安装包矩阵。

Windows x64 打包已补充跨 OS Sharp 可选依赖、显式 ASAR 解包、目标平台过滤与产物结构检查；仍需在 Windows x64 干净环境完成安装和启动验收。

Windows ONNX Runtime 启动崩溃已增加固定哈希的 Microsoft Visual C++ x64 Redistributable NSIS 前置安装，并将 Transformers/ONNX 改为 Embedding 首次使用时按需加载；Windows x64 产物同时移除 ONNX arm64 文件。安装器兼容成功、需要重启（3010）及系统已有其他版本（1638）返回码；仍需在 Windows x64 环境继续完成启动和真实推理验收。

## Phase 6A–6B 完成项

- `0006` 持久化知识文档、分块、来源元数据、Float32 向量与 FTS5 trigram 索引；
- 支持拖放或选择 TXT、Markdown、JSON、HTML、CSV、PDF、DOCX、XLSX、PPTX、RTF、ODT、ODS、ODP 和 EPUB；
- Main 限制文件数量/大小、拒绝符号链接，并限制解析时长、解压规模、附件、OCR、iframe 和图片提取；
- 原文件复制到应用管理目录，按 SHA-256 内容去重，删除文档/知识库时清理管理副本；
- 固定 revision 的 INT8 BGE 已纳入应用资源，启动时校验 SHA-256 并回填既有文档的 512 维向量；资源异常时 FTS 仍可用；
- 480 字符分块、64 字符重叠，保留页码、幻灯片、工作表、标题和文本位置；
- 使用 RRF 融合关键词与语义候选，结果返回来源、匹配类型和归一化分数；
- 数据库或企业管理后台及后台索引任务仍未接入。

## Phase 6C 完成项

- `0007` 为会话、Agent 和 AgentRun 保存知识库 ID，为助手消息保存来源快照；
- 普通会话可显式选择一个已启用知识库，选择结果跨重启恢复；
- Agent 可绑定已启用知识库，运行时与会话选择合并并记录实际使用 ID；
- 每次生成最多使用 5 个知识库、8 个文本块和 6000 字符知识正文；
- 知识上下文标记为不可信参考数据，禁止将资料内指令解释为权限或 Tool 请求；
- 助手消息实时展示并持久化 `[资料N]` 对应的知识库、文档和页/章节位置；
- 删除知识库时自动清理会话和 Agent 绑定；无结果或语义模型异常时安全降级；
- Phase 6 完成时 Tool、MCP 与 Workflow 执行尚未开放；当前状态以 Phase 7 小节为准。
