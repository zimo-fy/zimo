# Zimo 实施计划

状态：V0.2 Phase 8B–8E 首版自动化完成，Phase 7.5 与 Phase 8 等待跨平台人工验收
基线日期：2026-09-02

## 工作原则

每阶段开始前重新阅读 `REQUIREMENTS.md`、本文和 `PROGRESS.md`。阶段内只实现该阶段范围；新增核心逻辑同步补测试。结束时运行适用门禁、更新进度/ADR/遗留项，然后停止等待人工确认。

能力只能在对应阶段明确批准的边界内实现。当前按 ADR 0013 开放受审核 Skill 包内 Python/Node 脚本，按 ADR 0019 开放每条人工审批的实验性宿主机 `run_command`，并按 ADR 0020 开放应用存活期的账号隔离 Automation 调度；仍不得引入无人值守 Shell、Plugin 代码执行、stdio/私网 MCP、操作系统常驻调度或 Router 自动执行。HTTPS MCP 以 ADR 0010 为准。

## 已确认的 V0.1 假设

- 首要开发/验收平台为 macOS；架构保持 Windows/Linux 可移植，正式多平台发布另行验收；
- 主题只交付浅色，token 为深色预留；
- 登录模型的标识、显示名称和 API 地址来自已保存配置，使用 OpenAI-compatible Chat Completions 文本流；开发服务器模式允许在设置页临时修改模型标识、HTTPS/loopback API 地址，并可选安全替换模型 Key；
- 登录接口下发的 `modelApiKey` 只在 Main 内存链路中流转，并使用 Electron `safeStorage` 异步能力持久化；不可安全加密时登录失败并回滚；
- SQLite 使用 Drizzle，Phase 1 spike 决定 `node:sqlite` 或 `better-sqlite3` driver；
- UI 使用 Tailwind + 经 Zimo 包装的 Radix Primitives；Workflow 画布使用 React Flow；
- Router 默认 800ms、阈值 0.7，只展示不执行。

## Phase 0：架构和规范

### 范围

只交付架构、契约、规范、威胁模型、技术 ADR、阶段计划和进度；不建立业务工程，不复制图标，不安装依赖。

### 交付

- [x] 架构总览与依赖方向
- [x] 目标目录结构
- [x] 领域模型与 Repository/Provider 端口
- [x] IPC 通道、安全校验与 DTO 信封
- [x] 流事件、顺序、背压、取消和错误语义
- [x] SQLite 数据模型、migration、密钥引用和删除策略
- [x] 代码、测试、日志、错误处理规范
- [x] 威胁模型与残余风险
- [x] 关键 ADR
- [x] 实施计划与进度模板

### Exit gate

必需文件全部存在、Markdown/相对链接有效、核心术语一致，且无业务代码或提前安装依赖。人工确认后进入 Phase 1。

## Phase 1：Electron 基础与设计系统

阶段状态：已完成并通过人工验收。

### 包含

1. 建 pnpm workspace、严格 TypeScript、ESLint/Prettier/Vitest/Playwright 基线；
2. 建 electron-vite Main/Preload/Renderer，落实窗口、协议、CSP、权限、导航与 IPC sender 安全；
3. 实现 contracts/application/domain 最小骨架和 `AppError`、logger、redactor；
4. 对 `node:sqlite` + Drizzle 做目标 Electron spike，落地 driver 及 `0001` migration；
5. 实现 `SecretStore` 骨架与安全能力状态（不需模型 Key 页面完整功能）；
6. 复制 `/Users/vb/Downloads/icon.png` 到 `apps/desktop/resources/icon.png`；
7. 建 token、基础组件、主导航、响应式壳、Error Boundary；
8. 实现 `MockAuthProvider` 登录/恢复/退出与设置页骨架；
9. 增加 unit/integration/E2E 与安全 smoke。

### 不包含

模型配置、真实对话、产品模块 CRUD、Router。

### Exit gate

`format:check`、lint、typecheck、unit、integration、build 和 Phase 1 E2E 通过；开发环境可启动；登录可恢复；Renderer 无 Node 权限；进度更新后人工确认。

### 完成记录（2026-09-02）

- [x] pnpm workspace、严格 TypeScript 与质量门禁
- [x] Electron Main/Preload/Renderer 安全壳与自定义协议
- [x] 类型安全 IPC、Application/Domain/Adapter 最小骨架
- [x] `node:sqlite` + Drizzle migration spike
- [x] safeStorage SecretStore、结构化日志和脱敏
- [x] UI token、组件、导航、响应式壳与 Error Boundary
- [x] Mock 登录、会话恢复、退出和设置页骨架
- [x] 应用图标复制和接入
- [x] unit、integration、build 与真实 Electron E2E 门禁
- [x] 人工验收 Phase 1

## Phase 2：真实模型对话

阶段状态：已完成并通过人工验收。

### 包含

1. ModelProvider/Model/Conversation/Message migration 与 Repository contract；
2. 登录托管 Provider、Key 安全保存/替换/删除、连接测试、默认模型；
3. LangChain `ModelGateway` OpenAI-compatible Adapter 与 fake SSE contract server；
4. Conversation Application 用例、统一 stream registry、持久化节流与恢复；
5. 对话 UI：新建、模型切换、Markdown/代码/表格、状态、停止、重新生成；
6. 重命名、删除确认、历史恢复、可理解错误；
7. 对应单元、集成、安全与 E2E。

### 不包含

Tool calling、Agent/LangGraph 运行、图片、RAG、Router。

### Exit gate

fake provider 的正常/断线/取消/错误用例通过；真实 OpenAI-compatible endpoint 进行可选手动 smoke；Key canary 不出现在 Renderer/DB/log；聊天关键 E2E 通过后人工确认。

### 完成记录（2026-09-03）

- [x] Provider、Model、Conversation、Message 的 `0002` migration 与 SQLite Repository
- [x] 登录 `modelApiKey` 替换、删除补偿和 safeStorage 持久化
- [x] 固定 OpenAI-compatible 地址、`deepseek-v4-flash`、连接测试和默认模型
- [x] LangChain ModelGateway 与稳定 ModelStreamEvent 映射
- [x] 流式显示、250ms/4KB 持久化、取消、失败保留和中断恢复
- [x] 会话创建、历史恢复、重命名、软删除和重新生成
- [x] 全局任务侧栏、空白草稿首发转任务、最近活动排序、工具二级菜单与首轮模型标题
- [x] Markdown、代码块、表格与安全链接展示
- [x] unit/contract、fake provider integration、安全 canary 与 Electron E2E
- [x] 人工验收 Phase 2（用户于 2026-09-03 明确要求继续进入 Phase 3）

### V0.2 长会话上下文压缩增量（2026-09-18）

手动压缩与账号记忆扩展设计见 [手动会话压缩与用户记忆](docs/features/manual-compaction-and-user-memory.md)：最新回复操作菜单；具名 IPC、可取消的手动检查点；独立账号记忆表和设置页；每轮普通会话首条起注入，账密/正文不进入普通日志。

2026-09-21 增量中的压缩偏好提取已撤回：检查点只用于本会话交接，长期记忆改由普通会话的结构化 Tool 写入。Phase 9 工作目录新增逐级创建子目录 Tool，复用文件写入授权和路径安全边界。

- [x] 最新助手回复操作菜单、复制、无聊天消息副作用的手动压缩和可取消检查点；
- [x] 增量迁移、账号隔离记忆 CRUD、设置页维护与请求前有界注入；
- [x] Schema、单元/集成与新会话首轮注入 E2E 验证；
- [ ] Workflow 内部模型节点记忆注入和工作流历史压缩继续保持后续阶段范围。

- [x] 托管模型声明 1,200,000 tokens 上限，以 80%/90% 软硬水位和 120,000 tokens 输出预留评估请求；
- [x] `messages` 保持完整事实来源，`0035` 独立保存版本化检查点，模型 Surface 使用最新摘要和未覆盖原文；
- [x] 压缩请求使用固定中文交接结构，重复压缩整合旧摘要，支持取消、输出上限、启动中断修复和硬水位失败关闭；
- [x] 会话流与详情展示压缩开始、完成、失败、覆盖位置、估算 token 和可展开摘要；
- [ ] Workflow Agent 节点和单轮 Tool Loop 的动态 Tool transcript 尚未自动压缩；首版仅在普通会话每次模型运行前处理。

## Phase 3：产品模块 UI 原型

阶段状态：已完成并通过人工验收。

### 包含

按 Agent → Skill → Knowledge Base → Workflow → Plugin → MCP → Automation 的顺序逐模块实现领域 DTO、Mock Repository、Application 用例和 UI。每个模块具备列表/详情/表单、搜索筛选、加载/空/失败状态及需求规定交互。

Workflow 使用 Zimo `WorkflowDefinition` 与 React Flow mapper，支持节点拖拽、连接、配置和 Mock 保存。知识文件仅选择并生成 Mock 元数据；Plugin/MCP/Automation 的运行类按钮明确“预览/未开放”。

### 不包含

任何真实解析、下载、连接、工具调用、图执行或调度。

### Exit gate

所有 Mock Repository contract、主要组件/导航 E2E、未开放状态断言和可访问性 smoke 通过；无危险 runtime 依赖/IPC；人工确认。

### 完成记录（2026-09-03）

- [x] 七类领域 DTO、专用 Repository 端口、Mock Repository 与 Application 用例
- [x] strict prototype list/get/mutate IPC 与具名 Preload API
- [x] 七模块列表、详情、表单、搜索筛选及加载/空/失败状态
- [x] Agent、Skill、知识库、Plugin、MCP 和 Automation 需求交互原型
- [x] React Flow mapper、节点拖拽/连接/配置与 Mock WorkflowDefinition 保存
- [x] 运行、连接、检索和调度类按钮明确预览/未开放且不执行
- [x] unit/contract、integration、安全回归与 Electron E2E 门禁
- [x] 人工验收 Phase 3（用户于 2026-09-03 明确要求继续进入 Phase 4）

## Phase 4：Intent Router V0

阶段状态：已完成并通过人工验收。

### 包含

1. RouteTarget 目录从已启用 Mock Agent/Skill/Workflow 投影；
2. 可解释的规则快速匹配；
3. 复用 ModelGateway 的 LLM structured classification；
4. strict Schema、800ms timeout、0.7 阈值、target 校验和全降级矩阵；
5. send-message 前置编排与 `route.completed`；
6. UI 展示结果、继续普通聊天、未开放目标说明；
7. 不含正文的 route 记录、指标与基础中英文评估集。

### 不包含

目标自动执行、用户授权流、多 Agent、后台路由。

### Exit gate

规则/Schema/阈值/超时/目标校验测试通过；Router 故障聊天 E2E 通过；评估报告含 p50/p95、fallback rate、样本准确率；`shouldExecute` 全链路固定 false。

### 完成记录（2026-09-03）

- [x] Agent/Skill/Workflow RouteTarget 目录投影与具名 IPC
- [x] 中英文显式规则匹配和当前会话模型 structured classification
- [x] strict Schema、800ms timeout、0.7 阈值和目标存在/启用/类型校验
- [x] timeout、调用错误、非法 Schema、低置信度、缺失/禁用目标降级矩阵
- [x] `route.completed` 前置流事件、聊天 UI 提示与普通聊天继续
- [x] `0003` IntentRouteRecord、SHA-256 fingerprint 和隐私安全日志
- [x] 中英文评估集、p50/p95、fallback rate 与样本准确率报告
- [x] `shouldExecute=false` 全链路测试与 Router 故障聊天 E2E
- [x] 人工验收 Phase 4（用户于 2026-09-03 明确确认验收完成）

## V0.1 收尾

四阶段均人工验收后统一运行完整门禁和干净安装验证，完成运行/构建/故障排查说明、安全清单、已知限制、migration 备份恢复演练及依赖许可检查。正式发布、签名、公证、自动更新和多平台安装包需要独立发布计划，不因开发版可运行而默认完成。

## V0.2 Phase 5：Agent + Skill 最小闭环

### Phase 5A–5B：持久化与 instruction Skill 安装

- [x] Agent/Skill 从内存 Mock Repository 迁移到 SQLite；
- [x] 接入 Zimo Agent 人才库分类、目录、安装/卸载，并将安装结果转换为本地 Agent Definition；
- [x] 接入 Zimo Skill Store 全量分页目录、分类展示、安装/卸载两态，以及 instruction-only 安全安装边界；
- [x] instruction v1 manifest 与 `SKILL.md` 安全读取边界；
- [x] 本地目录选择、安装、同 package ID 更新和跨重启恢复；
- [x] Renderer 不接收路径，禁止脚本、依赖、未知 manifest 字段和符号链接逃逸；
- [x] 完整自动化门禁；
- [x] 人工验收（用户于 2026-09-03 要求进入 Phase 6）。

### Phase 5C：Agent Registry 与提示词编译

- [x] Agent 模型选择、Skill ID 绑定和引用完整性；
- [x] 将 System Prompt 与启用的 instruction Skill 编译为模型消息；
- [x] Agent Registry 和只读能力摘要。

### Phase 5D–5E：运行与聊天入口

- [x] AgentRun/事件持久化、取消和失败状态；
- [x] Agent 详情页进入对话、聊天手动选择和 Router 建议入口；
- [x] 会话默认 Agent 持久化，切换/重启后恢复 Agent 与派生 Skill；
- [x] 选择 Agent 即写入会话绑定，后续消息直接进入 AgentRun；
- [x] Router 只提出建议，用户选择 Agent 后才绑定到会话。
- [x] 会话可直接多选已安装 instruction Skill，并与 Agent Skill 去重合并、跨重启恢复。

## V0.2 Phase 6：知识库检索

### Phase 6A–6B：本地文件摄取与混合检索

- [x] 知识文档、分块、向量与 FTS5 索引迁移到 SQLite；
- [x] 用户选择或拖放白名单文件，安全解析 PDF、Office、文本和开放文档格式；
- [x] 受管理文件副本、SHA-256 内容去重、删除清理和跨重启恢复；
- [x] 固定 revision 的本地 BGE 随应用资源分发，启动后校验哈希并回填向量；资源异常时降级到 FTS5；
- [x] 关键词与语义结果使用 RRF 融合，并返回文档与页/幻灯片/工作表/标题来源；
- [x] Renderer 不获得路径，解析限制、IPC Schema、unit/integration/E2E 覆盖；
- [x] 人工验收（用户于 2026-09-03 确认基本可用并要求继续）。

### Phase 6C：Agent/chat Grounding

- [x] Agent 绑定已启用知识库，会话显式选择并跨重启保存；
- [x] 模型调用前受控检索、6000 字符保守预算与来源引用；
- [x] 无结果、知识库禁用、模型不可用和取消的降级语义；
- [x] 防 prompt injection 的知识上下文分隔与端到端测试；
- [ ] 人工验收。

### Phase 6D：外部业务数据源

- [ ] 数据库只读 Source Adapter、查询模板/视图 allowlist、凭据安全存储；
- [ ] 内部后台 API/Webhook/定时同步、增量游标、幂等、重试和审计；
- [ ] Utility Process 索引任务、进度、取消、限流和断点恢复；
- [ ] 数据新鲜度、来源权限和删除传播策略。

## V0.2 Phase 7：Workflow Editor

- [x] 参考 FastGPT 的节点库 → 画布 → 配置侧栏交互，保持 Zimo 自有视觉；
- [x] 自定义节点卡片、四向连接端口、缩放、小地图与网格吸附；
- [x] 保存状态、撤销/重做、快捷保存与选中删除；
- [x] Agent、instruction Skill、知识库和 Top K 节点配置；
- [x] WorkflowDefinition strict Schema、无环结构和启用引用校验；
- [x] `0008` SQLite 持久化与内置示例一次性初始化；
- [x] Workflow 安全运行时、调试事件和知识检索节点执行。
- [x] 可信 Tool 注册表、权限声明、参数 Schema、逐次确认、超时取消和脱敏审计；
- [x] 首个内置只读 `zimo.knowledge.search` Tool 与 Workflow 节点；
- [x] MCP 信任、命名、传输、凭据、能力快照与重新审批边界 ADR；
- [x] GitHub 官方 Streamable HTTP 只读连接、身份验证与待审批 Tool 快照；
- [x] 将 GitHub `search_repositories` 纳入受控调用与 Workflow；
- [x] 将 GitHub 专用连接演进为多 Server HTTPS MCP Registry，自动完成 initialize、完整 tools/list 快照和通用 tools/call；
- [x] Agent/Workflow Server 级绑定、全量工具模型 Tool Calling、Tool result 回传、调用轮数限制和审计；
- [x] 会话直接选择一个 Workflow 和多个 MCP Server；发送时运行 Workflow，或仅向模型暴露所选 Server 当前快照中的 Tool；
- [x] 普通会话通过内置结构化 Tool 将模型提出的偏好、目标或未解决问题写入当前账号记忆；下次会话按现有有界注入链路使用，压缩摘要不再负责生产记忆写入；
- [x] 开发态敏感 payload 日志按模型工具轮次记录实际暴露的 `tools` 与模型返回的 `tool_calls`；
- [x] MCP 固定凭据目录首批接入企查查与腾讯会议，支持测试后保存及腾讯会议受控 Header Token；
- [x] MCP 目录移除 Notion、Linear、Stripe、Canva、Atlassian并清理遗留连接，新增 10 个国内 HTTPS 服务及固定 Header/Query Key 适配；
- [x] 移除腾讯会议专用只读工具白名单，所有 MCP Server 统一保存并授权其完整 `tools/list` 快照；
- [x] Agent、Skill、知识库、Workflow 和 MCP 删除取消使用中拦截，使用 SQLite 事务级联清理活动引用并保留历史运行快照；
- [x] MCP 编辑进入独立页面，移除无法直接固定连接的企业微信入口，并增加 10 个具有官方公网 HTTPS endpoint 的常用 MCP 服务；
- [ ] 增加 Toolset/单 Tool 授权、语义 Top-K 和 DNS rebinding 固定解析代理层；标准 OAuth/PKCE 基础连接已完成，厂商私有授权 Adapter 待逐项接入。

当前测试运行支持开始、知识检索、instruction Skill、显式 Tool、绑定 MCP 的 Agent 和结束节点；不得在 Renderer 执行条件表达式，也不开放 Shell、stdio/私网 MCP、Plugin 或任意代码节点。

### Phase 7.1：工程收口与超大模块治理

- [x] 按 [超大模块治理清单](docs/issues/oversized-modules.md) 修正 Phase 7 状态漂移；
- [x] 优先拆分 Application Tool/Workflow、Main IPC 与 Workflow Canvas，执行超限文件只减不增规则；
- [x] 完成 Application 与 Main 的 P0 领域拆分，两个入口均降到 600 行以内；
- [ ] 继续拆分 SQLite Repository 与 Contracts；Domain、Prototype 页面与 Chat 页面已关闭超限项；
- [ ] 全部生产文件降到 600 行以内后启用 ESLint/CI 行数门禁；
- [ ] 重新生成安装包并完成打包态检索 smoke。

Phase 7.1 采用逐步等价重构，每一步独立验证和提交；完成 Tool/Workflow/Application/Main 的 P0 拆分后，才继续增加 MCP Streamable HTTP 实现。

### Phase 7.2：受审核 Skill 脚本运行时

- [x] 完整读取并有界保存 `SKILL.md`、脚本、资源和任务文件；
- [x] 包目录与按 Skill 隔离、可持久化的运行工作区；
- [x] `.py/.js/.mjs/.cjs` 固定解释器、`shell:false`、最小环境、超时/取消和输出上限；
- [x] 脚本 Skill 动态注册到 Controlled Tool，并接入会话、Agent 与 Workflow 模型工具循环；
- [x] 固定身份与权限的 Creator 可通过 workspace 限定 Tool 直接安装已生成 Skill，并保留手动安装回退；
- [x] 普通日志仅保留 Tool 审计元数据，不记录脚本参数值和输出；
- [ ] 人工复核 Zimo Store 上传审核流程必须绑定精确包 checksum；
- [ ] 在 macOS/Windows 打包应用中分别 smoke 系统 Python 与应用 Node 脚本；
- [ ] 设计依赖声明、包签名/撤回与 OS 级隔离，不自动执行安装 Hook。

### Phase 7.3：微信助手文本指令基础链路

- [x] `0021` 将通信渠道绑定改为登录账号复合主键；可确认唯一当前账号时迁移旧绑定，否则保持为不可激活的遗留归属；
- [x] 固定腾讯 HTTPS Adapter 接入 `getupdates`、`notifystart`、`notifystop` 与 `sendmessage`，校验响应大小和结构并贯穿超时/取消；
- [x] 游标与最近一次 `context_token`/收件人写入 SecretStore，SQLite 仅保存账号路由和不含正文的去重收据；
- [x] 文本入站串行进入账号专用“微信助手”普通会话，并以原消息的 `context_token` 回复；
- [x] 登录恢复启动、退出/解绑/应用退出停止，失败采用有界退避并向通信渠道页暴露真实状态；
- [x] 通信渠道页增加“发送测试消息”，未收到过微信消息时明确要求先激活会话；
- [ ] 使用真实微信账号完成扫码、冷启动游标恢复、Token 失效和测试消息人工 smoke；
- [ ] 后续单独设计微信侧选择已安装 Agent/Skill/Workflow 的授权语法、确认流程和审计，当前不开放远程能力变更。

### Phase 7.4：Electron 生产字节码保护

- [x] Main 生产 bundle 固定输出 CommonJS，并使用临时打包 Electron 中的 Bytenode 1.6.0 生成 `.jsc`；
- [x] 所有字节码成功后才把 Main 源 bundle 替换为最小加载器，失败时清理不完整字节码并阻止打包；
- [x] 自动拒绝残留 `.js`、source map、缺失字节码或异常加载器的生产 Main 产物；
- [x] 采用“临时编译器应用 → 生成字节码 → 最终打包”的两阶段流程，匹配打包态 V8 snapshot checksum；
- [x] macOS/Windows 打包前校验目标操作系统，Windows x64 同时校验架构，禁止复用跨平台 V8 字节码；
- [x] 保持 Preload `sandbox:true`，不对 Renderer 或 sandboxed Preload 启用字节码；
- [x] 修复 Main CommonJS 与内置 Transformers 延迟加载的模块互操作，并以真实 512 维本地推理回归验证；
- [ ] 分别在 macOS arm64、macOS x64 和 Windows x64 发布构建机完成安装包启动与核心能力 smoke；
- [ ] 正式发布前补代码签名、公证、ASAR 完整性、SBOM 和依赖审计流程。

### Phase 7.5：Electron 桌面自动更新

- [x] 曾锁定 `electron-updater` 与 generic provider（2026-10-19 已从仓库移除远程更新 URL 与依赖）；
- [x] Main 实现启动静默检查、自动下载、进度、取消、失败恢复与用户确认重启安装；
- [x] 严格 IPC 只暴露有界状态、主动检查和安装，不暴露 URL、路径或远端原始错误；
- [x] 应用菜单增加“检查更新…”，Renderer 增加 WorkBuddy 风格左下角更新浮层；
- [x] 记录 OSS 清单/载荷上传顺序、签名边界和发布安全 ADR；
- [ ] 向 OSS 上传首个完整版本，并在 macOS arm64/x64、Windows x64 签名包完成跨版本升级 smoke；
- [ ] 验证中断下载、清单缓存切换、失败重试、旧数据保留和回滚流程。

2026-10-19 起，客户端不再执行启动检查、下载和安装。「检查更新…」直接提示已是最新版本。OSS 发布配置保留。

## V0.2 Phase 8：会话文档工作区（Phase 8A–8E 首版已实现）

设计依据：[会话文档工作区与模型工具设计](docs/features/document-workspace-and-tools.md) 与 [ADR 0018](docs/adr/0018-controlled-document-workspace.md)。本阶段不得与 Phase 7.1 的 P1 超限治理混在同一提交中；Contracts 和 SQLite 新增能力进入独立领域模块。

### Phase 8A：受控资产与附件交互

- [x] 文档 Domain/Contracts、错误码、`0022` SQLite migration 与应用管理工作区；
- [x] “+”菜单底部灰色次级文件入口、系统选择器、聊天窗口拖放、输入框下方附件条和消息文件卡片；
- [x] 草稿/消息资产事务绑定、跨重启恢复、移除、会话删除清理和用户确认另存为；
- [x] 路径、扩展名/文件签名、符号链接、10 文件/消息、20 MB/文件、OOXML 目录项/声明解压规模和隐私门禁；8B 真正解压时再次执行运行态预算。

### Phase 8B：读取与渐进上下文

- [x] 复用 `officeparser@7.8.0` 的 DOCX/XLSX/PPTX/PDF 结构读取；
- [x] `DocumentDigest`、页/Sheet/Slide selector、cursor、单次 12,000 字符和本轮 6,000 字符预算；
- [x] `zimo.document.inspect/read` 受控 Tool；五个文档 Tool 在会话模型调用中稳定暴露，不依赖文本匹配；
- [x] 四格式本地结构/文本预览与 30 秒取消/超时；逐页图像缩略图和 Utility Process 隔离保留为增强项。

### Phase 8C：JS-first 创建

- [x] 精确锁定 `docx@9.7.1`、`exceljs@4.4.0`、`pptxgenjs@4.0.1`、`pdf-lib@1.17.1`；
- [x] 建立统一受限内容模型和四种格式 Adapter；
- [x] `zimo.document.create`、签名验证、版本保存、回复结果卡片与自动化打开/读取验证；
- [x] 记录依赖、构建体积、中文 PDF 字体路径和目标平台边界；主流 Office/Windows 实机 smoke 留给人工验收。

### Phase 8D：有限修改与版本

- [x] DOCX 文本替换/追加重建、XLSX Range 值/公式写入；样式与模板槽位作为后续增强；
- [x] Zimo 生成 PPTX 可重建修改，外部 PPTX 返回明确不支持并建议先转换；
- [x] PDF 拆分/重排、表单、水印、页码和文本叠加；多资产合并作为后续增强；
- [x] `expectedRevisionId` 乐观并发控制、父 revision 保留和稳定的不支持错误；版本对比/恢复 UI 作为后续增强。

### Phase 8E：转换与收口

- [x] Office/PDF→有界文本/结构、四种来源到四种目标格式的语义重建；XLSX↔CSV 文件产物作为后续增强；
- [x] 使用禁用 JavaScript/网络的隐藏本地 HTML renderer 与 Electron `printToPDF` 生成中文 PDF；
- [x] Tool 描述与稳定错误明确“语义重建可能损失格式/不支持”，结果以新 artifact 返回；独立转换等级徽标作为后续增强；
- [x] 高保真 Office→PDF 的本地原生/云端 Provider 延后决策，当前不依赖系统 Python/Office/LibreOffice。

Phase 8 首版采用 20 MB/文件、10 文件/消息；任务删除时同步删除数据库资产并尽力清理全部 revision。每次会话模型调用稳定暴露五个产品级文档 Tool，由模型自行选择且不依赖文本匹配；文档正文只以 6,000 字符有界、不可信上下文进入相关模型请求。写操作只创建内部 artifact/revision，用户通过 Main 原生对话框另存为。

## V0.2 Phase 9：会话工作目录、持久目录授权与逐动作审批

设计依据：[会话工作目录、OS 沙箱与逐动作审批](docs/features/conversation-workspace-sandbox-and-approvals.md)、[ADR-0019](docs/adr/0019-conversation-workspace-and-action-approval.md) 与 [OS 沙箱技术 Spike](docs/reports/phase-9-os-sandbox-spike.md)。项目所有者已批准 Phase 9D 受控文本文件修改，并于 2026-09-17 批准 Phase 9E0 实验性宿主机命令；该能力必须逐条人工审批且明确不是 OS 沙箱。

### Phase 9G：统一目录与授权模型

- [x] 建立 `system/accounts/workspaces` 顶层目录并安全迁移旧数据库、密钥、知识、Skill、文档和恢复目录；
- [x] 每个会话自动创建默认 Zimo Workspace，附件/生成文档与普通输出归入会话容器；
- [x] 用户选择目录直接获得普通读写权限，高风险修改和删除仍审批；
- [x] 未授权绝对路径允许有界读取，首次写入审批后按登录账号持久授权父目录；
- [x] Zimo 系统、账号、生产安装目录及数据库、密钥、日志、审计与安装资源硬拒绝；
- [x] OS 沙箱、网络和外部应用继续保持未注册；Shell 进入独立的 Phase 9E0 实验边界。

### Phase 9A：架构决策与沙箱 Spike

- [x] 冻结 workspace grant、逐动作审批、一次授权和风险矩阵；
- [ ] 完成 macOS arm64/x64、Windows x64 文件/网络/进程/资源隔离 Spike；
- [ ] 确认 helper、签名、更新完整性、失败关闭和打包体积；
- [x] 评审 Contracts、IPC、流事件、SQLite migrations、威胁模型和审计字段；
- [x] 项目所有者人工批准先进入 Phase 9B 只读工作目录。

### Phase 9B：只读工作目录

- [x] 原生目录选择/拖放、会话绑定、跨重启恢复和显式额外目录；
- [x] canonical path、symlink/junction、二进制、ignore、数量和大小边界；
- [x] `list/search/read` 三个产品级 Tool 与渐进返回；
- [x] 只读 Domain/Contract/Application/Adapter/SQLite/Renderer 单元及集成覆盖；
- [x] Electron E2E 覆盖 typed bridge、原生选择、跨重启恢复和移除；
- [ ] macOS/Windows 签名安装包人工验收。

### Phase 9C：逐动作审批基础设施

- [x] `PlannedAction -> allow|ask|deny` 策略引擎及规则版本；
- [x] run 暂停/恢复、审批请求/结果/过期流事件；
- [x] action digest、防重放、窗口归属、取消与单终态；
- [x] “请求审批 / 帮我批准”交互；后者自动放行当前可执行风险动作，关键危险和策略边界违规仍拒绝；
- [x] 审批模式按登录账号保存最近选择；新建任务和重启沿用，既有会话模式不被反向覆盖；
- [x] 无副作用模拟 Tool 覆盖允许、拒绝和“审批前不执行”；网络 Tool 保持未注册，命令随后由 Phase 9E0 单独批准。

### Phase 9D：受控文件修改

- [x] `create/patch/delete` 的风险策略、变更预算和 checksum 并发保护；
- [x] 同目录临时文件、原子替换、不覆盖创建、失败清理和结果摘要；
- [x] `.git`、Zimo/秘密文件、二进制、可执行文件、硬链接和批量修改保护；
- [x] 修改/删除前保存受管恢复副本；恢复 UI 与保留清理进入 Phase 9F；
- [x] 路径逃逸、符号链接、陈旧 checksum、歧义替换、取消和审批前不执行测试；
- [ ] macOS/Windows 签名安装包人工验证原子替换、权限位和恢复副本。

### Phase 9E：OS 沙箱命令与网络

Phase 9E0 临时宿主机执行：

- [x] 增加单一 `zimo.workspace.run_command` 和可替换 `WorkspaceCommandExecutor`；
- [x] 固定平台 Shell、最小继承环境、120 秒默认/360 秒最大超时、取消、进程树终止和输出截断；
- [x] 命令均标记高风险；“请求审批”逐次人工确认，“帮我批准”自动执行；
- [x] 复用 Tool/审批审计且不新增 Renderer Shell IPC；
- [ ] 完成 Windows x64 打包态人工 smoke，并在 OS 沙箱 Adapter 上线后移除宿主机实现。

- [x] 完成官方机制调研并排除 macOS `sandbox-exec`、普通 `child_process` 与 Windows 实验 API 作为生产基线；
- [ ] 实现并签名 macOS App Sandbox XPC/helper 与安全作用域 bookmark 原型；
- [ ] 实现 Windows AppContainer/LPAC + Job Object helper 原型；
- [ ] 仅由已验收 Sandbox Worker 执行结构化 argv，Main/Renderer 不直接运行命令；
- [ ] 默认断网，新域名仅当前动作批准，逐跳验证 HTTPS/DNS/重定向/私网；
- [ ] 最小环境、资源预算、超时、取消、输出上限和完整进程树回收；
- [ ] macOS/Windows 签名安装包通过沙箱验收矩阵后才开放 UI。

### Phase 9F：审计中心与发布验收

- [x] `0029` SQLite append-only 审计存储及设置页只读审计中心；
- [x] 审批模式移入输入框底部，审计展示文件动作详情，并提供账号级已放行目录查看与撤销；
- [x] 记录策略判定、批准/拒绝、执行前事实、执行终态和安全错误码，不记录正文、参数值或秘密；
- [x] 副作用 Tool 在权威审计开始事实无法写入时失败关闭；
- [ ] 增加保留/清理策略，以及时间、能力、会话筛选和分页；
- [ ] 恶意仓库、Prompt 注入、审批伪造/疲劳、网络外带和秘密 canary 测试；
- [ ] macOS arm64/x64、Windows x64 全链路人工验收、升级和回滚演练。

Phase 9 当前不提供 Home/磁盘根文件 Tool 写入授权、命令前缀批准、后台无人值守命令、任意桌面应用控制或模型修改安全策略。实验性宿主机命令获批后实际拥有当前 OS 用户权限；目录 grant 只决定初始 cwd，不构成命令访问边界。

### V0.2 统一身份认证增量

- [x] 复用 xclaw-manager 的 `/zimoLogin` form-urlencoded 与 `/verify-token` Bearer 协议；
- [x] 登录网络请求只在 Main 执行，生产地址固定 HTTPS，开发覆盖仅限 loopback；
- [x] 密码不持久化，Token 写入 safeStorage SecretStore，SQLite 只保存会话和 secret ref；
- [x] `0014` 会话迁移、严格 IPC、失败映射、超时/重定向/响应上限与安全日志；
- [x] 登录页、账户展示、单元/协议集成/SQLite/Electron E2E 与文档同步；
- [ ] 使用真实账号对生产认证服务执行人工 smoke。

## V0.2 Phase 10：本地 Automation 调度

联网只读 Tool 增量：参考 Abu-Cowork 的 Provider 抽象，在现有受控 Tool/流式 Tool Loop 上增加 `web_search` 与 `web_fetch`；首版支持 Tavily、Brave、公网 HTTPS SearXNG，只有 GET 网页读取，不开放通用 HTTP 写请求、浏览器登录态、私网访问或 Router 自动执行。详见 [ADR 0022](docs/adr/0022-controlled-web-search-and-fetch.md)。

按需能力发现增量：普通会话移除前置 LLM Router 和可见置信度提示，主模型在当前能力不足时调用应用内建 `search_capabilities`。已安装且启用的 Skill、MCP Tool 与知识检索能力可临时加入当前 run，无需二次授权；具体高风险动作继续执行既有审批。本地未命中后只查询 Skill/Agent 目录并给出安装建议。详见 [ADR 0023](docs/adr/0023-on-demand-capability-discovery.md)。

- [x] `0026` 持久化账号隔离的 Automation、专用会话引用、下一次执行时间和运行历史；
- [x] `0027` 将执行限制调整为每日开始/结束时刻，既有开发数据默认迁移为全天；
- [x] 支持单次、间隔、每天、每周以及每日本地时间范围；间隔从保存或重新启用时开始计时；
- [x] 复用会话的模型、Agent、Skill、知识库、Workflow 和 MCP Tool 选择与运行时二次校验；
- [x] Main 以 30 秒节拍发现到期任务，同任务非重叠、每轮最多启动 3 个，重启后最多补跑一次；
- [x] 登录账号隔离、登出/切换账号/退出取消、异常中断恢复和脱敏审计；
- [x] Automation 页面支持创建、编辑、启停、立即运行、下次时间和近期状态；
- [ ] Windows/macOS 打包应用完成休眠恢复、跨天、DST/时区切换和长期运行人工 smoke；
- [ ] 后续评估系统常驻服务、通知投递、失败重试、节假日日历和云端调度；Router 仍不自动执行。

## V0.2 Phase 11：本地浏览器自动化

阶段状态：首版实现中。

1. 以 Zimo 账号级独立 Profile 启动本机 Chrome/Edge/Brave/Chromium，CDP 仅绑定回环地址和随机端口；
2. 实现 tabs、open、focus、snapshot、screenshot、navigate、click、type、press、scroll、wait 十一个小 Tool；按键白名单、滚动距离和等待时长有界，等待直接返回新快照；
3. 浏览器作为账号级内建运行能力，不需要会话绑定或 UI 开关；普通会话、Workflow Agent 节点和 Automation 专用会话均可注入；共享 Profile 的模型运行互斥；
4. 点击和输入使用 snapshot/ref，不开放 CSS Selector、Runtime.evaluate、密码输入或默认 Profile；
5. 浏览器动作按产品决策直接放行，不生成审批请求；Schema、超时、取消、审计和敏感日志约束继续生效；
6. `browser_open` 新建公开网页标签页并返回真实目标 ID；首次 `browser_tabs` 空列表短暂重试一次，招聘 Skill 在无平台标签页时按需打开而非直接要求用户手动操作；
7. 完成 macOS arm64/x64 与 Windows x64 的真实浏览器、打包态和退出清理验收。

详见 [ADR 0024](docs/adr/0024-local-browser-cdp-automation.md) 与[功能说明](docs/features/local-browser-automation.md)。

## 决策检查点

| 检查点                     | 最迟阶段        | 通过标准                                                           |
| -------------------------- | --------------- | ------------------------------------------------------------------ |
| SQLite driver spike        | Phase 1         | 目标 Electron 可打包、migration/contract 通过，无不可接受 ABI 成本 |
| macOS safeStorage 签名行为 | Phase 1/发布前  | 开发态行为有说明，签名构建 Key 读写稳定                            |
| OpenAI-compatible 兼容子集 | Phase 2         | 文档化 request/SSE/error/usage 差异与 fixtures                     |
| 图标版权/发布授权          | 正式发布前      | 所有者提供明确授权；不阻塞开发态复制                               |
| Router 默认模型与延迟      | Phase 4         | 评估数据支持 800ms 预算或新增 ADR 调整                             |
| Windows/Linux 目标         | V0.1 开发验收后 | 决定是否进入正式首发矩阵                                           |
| Phase 9 OS 沙箱            | Phase 9A        | macOS arm64/x64、Windows x64 验收矩阵通过，失败时严格关闭能力      |
