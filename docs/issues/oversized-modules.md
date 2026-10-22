# 超大模块治理清单

- 状态：Active
- 建立日期：2026-09-04
- 适用阶段：Phase 7.1 及后续功能开发
- 规范依据：[代码规范：文件与模块规模](../development/code-style.md#文件与模块规模)

## 背景

项目从 V0.1 原型演进到真实 Agent、知识检索、Workflow 和受控 Tool 后，早期集中式 `index.ts` 与页面组件已经承载多个职责。继续在这些文件中直接增加 MCP、数据源和 Workflow 能力，会扩大回归范围并削弱领域边界。

本治理任务只做可验证的职责提取，不进行全仓重写，也不在拆分时改变产品行为。所有后续功能必须遵守 400 行目标、600 行拆分门槛和既有超限文件“只减不增”的棘轮规则。

## 2026-09-04 基线

| 优先级 | 文件                                                                           | 当前行数 | 主要问题                                                           | 计划拆分方向                                                                                    |
| ------ | ------------------------------------------------------------------------------ | -------: | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| P0     | `packages/application/src/index.ts`                                            |     2673 | Prototype、Agent、Knowledge、Tool、Workflow、Conversation 用例集中 | 按 `tools`、`workflows`、`knowledge`、`agents`、`conversations` 分模块；根入口只 re-export      |
| P0     | `apps/desktop/src/main/index.ts`                                               |     1216 | 生命周期、组合根、窗口和全部 IPC 注册集中                          | 提取 bootstrap/window、composition root，以及 models、knowledge、workflow、tools IPC registrar  |
| P0     | `apps/desktop/src/renderer/src/features/prototypes/workflow-canvas.tsx`        |     1297 | 图模型映射、编辑状态、节点、配置侧栏和测试面板集中                 | 提取 workflow model/mappers、editor hook、node components、inspector、test panel                |
| P1     | `packages/adapters/database-sqlite/src/index.ts`                               |     1286 | 数据库生命周期、migration 和多领域 Repository 集中                 | 提取 database lifecycle/migrations 与 conversation、prototype、knowledge、workflow repositories |
| P1     | `apps/desktop/src/renderer/src/features/prototypes/product-prototype-page.tsx` |     1005 | Agent/Skill/Plugin/MCP/Automation 表单与详情共用单体页面           | 保留目录壳，按产品类型提取表单、详情和动作面板                                                  |
| P1     | `packages/contracts/src/index.ts`                                              |      951 | 多领域 IPC Schema 和 DTO 集中                                      | 按 app/auth、models、conversation、prototype、knowledge、workflow、tools 分文件并统一 re-export |
| P2     | `apps/desktop/src/renderer/src/features/chat/chat-page.tsx`                    |      699 | 会话加载、运行状态、Agent/知识选择和消息呈现集中                   | 提取 conversation hook、composer、run confirmation、message list                                |
| P2     | `packages/domain/src/index.ts`                                                 |      677 | 多领域实体、端口、错误和 Tool 类型集中                             | 按 entities、ports、stream、tools、errors 分文件并统一 re-export                                |

`apps/desktop/src/preload/index.ts`（375 行）和 `packages/adapters/database-sqlite/src/schema.ts`（272 行）当前未超目标上限，暂不列入拆分任务；后续增长仍受代码规范约束。

## 执行顺序

1. 修正文档、Workflow UI 和 Runtime 中与 Phase 7 当前能力冲突的旧状态描述；
2. 在接入远程 MCP 前，先从 Application 提取 Controlled Tool 与 Workflow Runtime；
3. 提取 Main 的 Tool/Workflow IPC registrar 和组合根；
4. 拆分 Workflow Canvas 的状态、节点、配置与测试面板；
5. 按 Repository 拆分 SQLite Adapter；
6. 拆分 Contracts 与 Domain，同时保持包级公共导入路径不变；
7. 拆分通用 Prototype 页面和 Chat 页面；
8. 全部生产文件降到 600 行以内后启用 ESLint/CI `max-lines` 门禁。

每一步单独提交，先做等价重构，再开始依赖该边界的新功能。不得在同一提交中同时进行大规模移动和产品行为变更。

## 治理进度

### P0 第一批（2026-09-04）

- [x] 建立根目录 `AGENTS.md`，让普通开发任务也默认读取项目规范和治理清单；
- [x] 修正 Phase 7 当前能力与需求、计划、架构、数据模型、Workflow UI/Runtime 的旧描述；
- [x] 从 Application 提取 `prompt-compilation.ts`（26 行）、`tool-runtime.ts`（308 行）、`workflow-runtime.ts`（467 行）和 `conversation-run.ts`（179 行）；Application 原入口由 2673 行降至 1926 行；
- [x] 从 Main 提取 IPC、Workflow、会话日志、敏感模型诊断、加密后端和原型初始化职责；Main 原入口由 1216 行降至 1019 行；
- [x] 将 Workflow Canvas 拆为 549 行入口以及 model、node components、inspector、test panel 四个 153–344 行模块；
- [x] 从 Domain 提取 `errors.ts`（31 行）和 `tools.ts`（69 行），Domain 入口由 677 行降至 580 行并关闭该超限项；
- [x] Prototype 页面拆为 350 行目录壳、260 行知识管理、249 行编辑器和 218 行响应式操作列表；取消列表下方详情，并关闭该超限项；
- [x] Chat 页面拆为页面编排、输入指挥台、消息呈现、滚动状态、窗口结构和流事件映射模块；入口由 699 行降至 349 行并关闭该超限项；
- [x] format、lint、typecheck、62 项 unit/contract、11 项 integration、build 和 4 项 Electron E2E 通过。

该批次仅完成 Tool/Workflow 的先行边界提取；Application 与 Main 当时仍高于 600 行，后续治理结果见下节。

### P0 完成（2026-09-07）

- [x] Application 入口按认证与设置、知识、原型目录、Skill 安装、意图路由、模型配置和会话服务拆分；`index.ts` 从 1907 行降至 29 行，只保留包级公共导出；
- [x] Electron Main 将 App/Auth、模型、会话、原型与知识 IPC 分为独立 registrar，并提取目录 View mapper 与统一 IPC 组合；`index.ts` 从 972 行降至 391 行；
- [x] 新增 Application 生产模块均低于 600 行，新增 Main 模块均低于 220 行；公共 `@zimo/application` 导入路径、IPC channel、持久化格式和运行语义保持不变；
- [x] Application 与 Main 已从 P0 超限项移除。SQLite Adapter 与 Contracts 仍属于 P1，继续执行只减不增规则；在所有生产文件降到 600 行以内前不启用全仓 `max-lines` 门禁。
- [x] `format:check`、lint、typecheck、75 项 unit/contract、12 项 integration、build 和 4 项 Electron E2E 通过。

### 会话 Agent 绑定增量（2026-09-07）

- [x] 新增会话默认 Agent 持久化并采用“选择即使用”后继续遵守超限文件“只减不增”：Contracts 入口 951 → 914 行、Application 入口 1926 → 1906 行、SQLite 入口 1286 → 1255 行、Main 入口 1019 → 992 行；
- [x] IPC channel、会话记录映射、会话 View 映射分别提取到 42、68、43 行的职责模块；Chat 入口为 362 行，Preload 为 380 行，均未超过 400 行目标；
- [x] 该增量发生时登记的 Application/Main 超限已在上方 P0 完成项关闭；SQLite 与 Contracts 继续保持清单 Active。

### Workflow 模型诊断增量（2026-09-07）

- [x] Workflow 请求摘要与完整 payload 结构提取到 `workflow-model-request.ts`（101 行），Main 的 Workflow 日志适配提取到 `workflow-run-logging.ts`（43 行）；
- [x] Main 入口保持 992 行、Workflow IPC 由 66 行降至 55 行，未将诊断逻辑写回超限组合根；
- [ ] Workflow Runtime 当前 505 行，仍低于 600 行门槛但高于 400 行目标；后续增加节点类型前提取 Agent 节点执行器。

### GitHub HTTPS 只读 MCP 增量（2026-09-07）

- [x] GitHub MCP 的 Domain、Application、SDK Gateway、SQLite Repository、IPC、Preload 与 Renderer 页面均按职责独立落盘，没有将新能力写回已完成治理的聚合入口；
- [x] Main 入口 392 行、Preload 入口 385 行，保持在 400 行目标内；Contracts 入口 922 行、SQLite 入口 1257 行，两个 P1 项继续执行只减不增规则；
- [x] 新增生产模块均低于 400 行目标；远程能力当前仅连接、身份诊断和只读工具发现，不开放通用执行入口。

### GitHub MCP 受控仓库搜索增量（2026-09-07）

- [x] 新增 74 行的 GitHub Tool 本地映射模块；SDK Gateway 253 行、GitHub Application Service 270 行，均低于 400 行目标；
- [x] Main 入口仅组合新增能力和审计字段，当前 397 行；Preload、Contracts 和 SQLite 聚合入口未因本增量增长；
- [x] Workflow Runtime 只复用既有通用 Tool 执行分支并生成 `toolCallId`，当前 511 行且未增加 GitHub 专用职责；GitHub 搜索的参数、权限和调用逻辑没有写入 Runtime。

### 通用 MCP Registry 增量（2026-09-08）

- [x] 通用协议、Registry、动态 Tool 映射、模型 Tool Loop 与 Streamable HTTP Gateway 均拆入独立模块；新增生产文件都低于 400 行目标；
- [x] SQLite MCP 绑定读写提取到独立 `prototype-mcp-bindings.ts`，SQLite 聚合入口由本轮中间态 1268 行回落至 1229 行，继续遵守 P1 “只减不增”；
- [x] Workflow Canvas 当前 595 行、Conversation Service 与 Workflow Runtime 均为 548 行，仍低于 600 行硬门槛；下一次扩展对应职责前分别提取 MCP 绑定面板、模型运行策略和 Agent 节点执行器；
- [ ] Contracts 聚合入口因 Agent/Workflow 的 `mcpServerIds` 公共契约暂为 914 行；后续 P1 拆分时优先迁移 Prototype/Workflow Schema，并将入口恢复为纯 re-export。

### Zimo Skill Store 增量（2026-09-08）

- [x] Skill Store 的 Domain 端口、Application 用例、远端 Adapter、IPC registrar、Preload API 和 Renderer 页面均按职责独立落盘；新增生产文件均低于 400 行；
- [x] Product Prototype 页面由 363 行降至 355 行，Preload 入口由 385 行降至 379 行，Domain 入口由 589 行降至 574 行；
- [x] Contracts 新契约位于独立 `skill-marketplace.ts`；聚合入口格式化后仍为 914 行，未扩大该 P1 超限项；

### 会话直接能力绑定增量（2026-09-08）

- [x] 会话能力领域契约、严格 IPC Schema、SQLite Repository、能力校验服务和 Workflow 桥接均按职责独立落盘；
- [x] Chat 页面将能力变更提取到独立 Hook，入口由本轮中间态 413 行回落至 345 行；
- [x] Conversation Service 将模型执行策略提取为 372 行的 `conversation-execution-service.ts`，入口由本轮中间态 570 行降至 277 行；
- [x] Workflow 通用校验、错误和引用归一化提取后，Runtime 从本轮中间态 578 行回落至 535 行；下一次增加节点类型前仍应提取 Agent 节点执行器；
- [x] SQLite 会话 Repository 与 migration loader 从聚合入口提取；SQLite 入口降至 954 行。Contracts 新绑定契约位于独立模块，聚合入口当前 908 行；两个 P1 项继续只减不增。
- [ ] Main 入口因新增组合与生命周期接线暂为 414 行，仍低于 600 行拆分门槛；下一项 Main 能力前应将迁移装配提取为专用模块并恢复到 400 行目标内。

### Migration checksum 跨平台兼容修复（2026-09-15）

- [x] SQLite migration 应用、checksum 规范化及历史文档 migration 版本碰撞修复提取到独立模块；SQLite 聚合入口由 992 行降至 919 行，继续遵守 P1 “只减不增”；
- [x] 新 migration 模块低于 120 行，仅兼容同一 SQL 的 LF、CRLF、CR 与 UTF-8 BOM 表示，其他内容差异仍保持失败。

### Phase 9B 只读工作目录增量（2026-09-15）

- [x] Workspace Domain、Application、SQLite Repository、Main 文件 Adapter、IPC、Preload 和 Renderer 均按职责独立落盘；新增生产模块均不超过 400 行；
- [x] Main 组合入口通过提取 `tool-composition.ts` 保持 394 行，Chat 页面通过提取拖放判定保持 393 行，Preload 为 397 行；
- [x] Conversation Execution 通过提取模型解析保持 400 行；Contracts 的 Desktop API 移入独立模块，聚合入口从 916 行降至 775 行；
- [x] SQLite 聚合入口保持 919 行，Workspace Repository 通过受控 package subpath 导出；SQLite 与 Contracts 两个 P1 项继续只减不增。

### Phase 10 Automation 调度增量（2026-09-16）

- [x] Automation 的 Domain、Application、Schedule、SQLite Repository、IPC、Preload、Scheduler 与 Renderer 均按职责独立落盘；新增生产模块均低于 400 行目标；
- [x] Main 将 Automation 与微信后台生命周期组合提取到 `background-services-composition.ts`，并与 Phase 9B 工作目录接线合并后保持 386 行，没有把调度职责堆回组合根；
- [x] SQLite 将 AppSettings Store 提取到独立模块，聚合入口由 919 行降至 875 行；Contracts 继续使用独立 Desktop API，并将 App/Settings Schema 提取后把聚合入口降至 740 行，两个 P1 项继续遵守“只减不增”；
- [x] Automation 编辑器拆为页面、编辑器、表单控件和表单值模块，最长 335 行；Preload 入口为 399 行，仍处于 400 行目标内。

### Phase 9C 动作审批增量（2026-09-16）

- [x] 策略、审批服务、会话授权接线、流事件 Schema、SQLite Repository、IPC、Preload 与 Renderer 均按职责独立落盘；新增生产模块均不超过 400 行；
- [x] Contracts 聚合入口通过提取 `conversation-stream.ts` 从 775 行降至约 685 行；Main 入口保持 394 行，Preload 入口保持 399 行；
- [x] Chat 页面与 Conversation Execution 的新增职责已分别提取到 stream subscription、approval hook 和 tool-round capture 模块，保持在 600 行硬门槛内；后续继续拆至 400 行目标内。

### Phase 9D 受控文件修改增量（2026-09-16）

- [x] 路径安全、文件写入 Adapter、Tool 参数、Mutation Tool 分属独立职责；新增生产模块分别约 173、338、50、247 行，均低于 400 行目标；
- [x] Main、Preload、Chat 页面与 Conversation Execution 入口保持约 395、399、394、399 行，没有把写入职责堆回公共入口；
- [x] Contracts 聚合入口保持约 684 行并继续只减不增；本阶段未增加通用 helper 或 utils 模块。

### Phase 9F 基础审计中心增量（2026-09-16）

- [x] 审计 Domain、Application、SQLite Repository、IPC、Preload API 和设置页视图按职责独立落盘，新增生产模块均低于 200 行；
- [x] Settings 页面保持约 208 行；Contracts 聚合入口约 685 行并继续只减不增；
- [ ] Main/Preload 入口因新增组合与 bridge 暂为约 405/401 行，仍低于 600 行门槛；下一项能力前提取安全服务组合并恢复到 400 行目标内。

## Phase 7.1 同步待处理

- [x] 修正 Workflow 测试面板仍称 Tool 关闭的文案；
- [x] 修正 Workflow Runtime 注释及“不支持节点”提示遗漏 Tool 的问题；
- [x] 将 `REQUIREMENTS.md`、`IMPLEMENTATION_PLAN.md` 和架构总览同步到 V0.2/Phase 7 实际边界；
- [x] 将数据模型文档的 migration 列表更新到 `0008_workflow_definitions.sql`；
- [x] 将 Prototype 页面及其编辑、知识管理和列表职责全部降到 400 行目标以内；
- [x] 将 Chat 页面入口降到 400 行目标以内，新增会话组件均低于 400 行；
- [ ] 继续完成 P1 的 SQLite Adapter、Contracts 拆分；
- [ ] 重新生成最新 macOS 安装包并执行打包态知识检索 smoke；
- [ ] 增加 CI 后，将 600 行门槛转为自动检查。

## 每一步退出标准

- 生产行为、IPC channel 和持久化格式不因纯拆分改变；
- 包级公共 API 保持稳定，不引入跨层深层导入；
- 被处理文件降到 600 行以内，新增文件以 400 行为目标；
- `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test` 通过；
- 涉及 Main、IPC 或数据库时运行 `pnpm test:integration`；影响用户关键路径时运行 `pnpm test:e2e`；
- 更新本清单中的基线行数、完成状态和尚存例外。

## 暂不包含

- 不为了行数引入循环依赖、通用 `utils` 或无业务含义的薄包装；
- 不在等价拆分中改变 Tool 权限、Workflow 执行语义或数据库 Schema；
- 不把 stdio MCP、写入 Tool、Plugin 动态加载或操作系统常驻 Automation 调度混入本治理任务。
