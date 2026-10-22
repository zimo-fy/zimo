# 代码规范

本文是日常编码规则的总入口。跨项目工程约束和各技术栈详细规范见：

- [项目工程规范](project-standards.md)：架构、依赖、配置、数据、安全、性能、完成定义与评审；
- [TypeScript 编码规范](typescript-standards.md)：类型设计、控制流、异步、导入导出和禁止模式；
- [React 前端规范](react-standards.md)：组件、状态、Hook、表单、设计系统、可访问性和前端测试；
- [Electron 与 Node.js 规范](electron-node-standards.md)：进程职责、安全基线、IPC、生命周期、文件、网络和打包；
- [Git 协作规范](git-standards.md)：分支、Commit、历史整理、PR、Tag 和发布。

本文件保留必须在代码评审中快速检查的通用规则；专项文档是这些规则的细化，不是可选建议。

## TypeScript

- 全仓 `strict: true`，并启用 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、`useUnknownInCatchVariables`；
- 禁止 `any`；确需接收不可信值时使用 `unknown`，经 Zod 或类型守卫收窄；
- 公共函数、端口、DTO 和事件显式标注返回类型；局部简单表达式允许推断；
- 用判别联合表达状态，不用多个可能冲突的 boolean；所有 `switch` 使用 `assertNever` 穷尽检查；
- 不用 TypeScript `enum`，使用 `as const` 或字面量联合；
- 可变集合不跨层暴露，公共输入输出优先 `Readonly` / `readonly`；
- 金额、token 数、时间、ID 等不可互换概念使用值对象或品牌类型。

## 命名与文件

- 变量/函数 `camelCase`，类型/组件 `PascalCase`，常量 `UPPER_SNAKE_CASE`；
- boolean 以 `is/has/can/should/did` 开头；事件用过去式，如 `message.completed`；
- 文件统一 kebab-case，按职责后缀：`.repository.ts`、`.adapter.ts`、`.use-case.ts`、`.schema.ts`；
- 禁止 `utils.ts` / `helpers.ts` 大杂烩，名称应表达领域职责；
- 每个模块通过 `index.ts` 暴露最小公共 API，禁止跨包深层导入。

## 文件与模块规模

行数按仓库中文件的物理行数计算，可用 `wc -l <file>` 检查。限制适用于手写的生产 `TypeScript` / `TSX` 文件：

- 默认目标不超过 400 行；超过目标时，评审必须确认文件仍保持单一职责；
- 600 行是拆分门槛。新文件不得超过 600 行，未登记例外的既有文件也不得增长到 600 行以上；
- React 页面/组件优先控制在 300 行内，把数据加载、运行状态和复杂交互提取到 feature hook/reducer，把独立区域提取为具名组件；
- Application Service、IPC 注册、Repository Adapter 和 Contract 按领域拆分，不允许以单个 `index.ts` 长期承载多个不相关用例；`index.ts` 应优先作为最小公共 API 的 re-export 入口；
- 测试文件建议不超过 600 行，并按行为场景拆分；SQL migration、生成文件、第三方资源和固定模型资产不受行数门槛约束；
- 不能只为减少行数创建无领域含义的碎片文件。拆分边界应对应功能、用例、端口、Repository、Schema、hook 或 UI 区域。

现有超限文件使用棘轮规则治理：

1. 必须登记到 [超大模块治理清单](../issues/oversized-modules.md)，写明职责拆分方向、优先级和退出标准；
2. 新能力优先写入拆分后的新模块，不继续堆入已登记的超限文件；
3. 修改超限文件时原则上不得增加其净行数。确有必要临时增长时，必须在同一变更中更新治理清单，说明原因和后续拆分点；
4. 拆分只移动职责，不顺带改变行为；先保持公共 API，再通过单元、集成和 E2E 门禁确认等价；
5. 清单中的超限文件全部降到 600 行以内后，将门槛加入 ESLint/CI，禁止回退。

## 模块与依赖

- 依赖方向遵循 `docs/architecture/directory-structure.md`；
- 优先组合与小接口，不建多层基类；
- 构造函数注入端口；业务逻辑不读取全局单例、环境变量或 Electron API；
- 外部 SDK 类型在 Adapter 边界结束；Application/Domain 只接触产品类型；
- 时间、ID、随机数通过 `Clock`、`IdGenerator` 等端口注入，以便确定性测试。

## React

- 组件只负责呈现和用户意图；领域判断位于 Application，复杂呈现状态位于 feature hook/reducer；
- 服务端/IPC 数据使用 query 层管理，临时 UI 状态留在组件；不复制同一来源状态；
- Hook 只能在顶层调用，effect 必须清理订阅/AbortController，依赖完整；
- Props 使用具名 interface/type，不使用 `React.FC` 的隐式 children；
- 列表 key 使用稳定实体 ID；禁止用数组下标表示可增删数据；
- 表单有可见 label、错误关联、键盘焦点；仅图标按钮必须有 accessible name；
- 不以颜色单独表达状态；动画遵守 reduced-motion；
- Markdown 使用禁用原始 HTML 的解析器并经过 allowlist sanitization，代码高亮不得执行内容。

完整规则见 [React 前端规范](react-standards.md)。

## Electron 与 Node.js

- Renderer 无 Node 权限；Preload 只暴露冻结的具名 API；Main 只负责进程能力、IPC 和组合根，业务规则进入 Application/Domain；
- 保持 context isolation、sandbox、web security、CSP、导航/窗口/权限默认拒绝，禁止通过降低安全设置解决功能问题；
- IPC 必须异步、校验 sender 和输入输出；长任务具有 request/run ID、取消、超时和唯一终态；
- 文件、网络、stream、Worker、数据库和事件监听具有范围限制并在 finally/生命周期结束时释放；
- Node 使用 ESM、`node:` 内置模块和异步 API；环境变量只在 composition root 解析；Shell/child process 默认禁止；
- 原生依赖和打包资源必须按 Electron ABI、目标 OS/架构及打包态验证。

完整规则见 [Electron 与 Node.js 规范](electron-node-standards.md)。

## IPC 与 Schema

- Contract 先于实现；Zod Schema 是运行时真相，TypeScript 类型由其推导；
- Schema 默认 strict，字符串设 trim/长度限制，数组设最大项数，URL/ID 专门校验；
- 输入、输出、事件分别建 Schema，不能以类型断言跳过校验；
- Preload 只包装已批准的具名 channel；回调去除 Electron event；
- 新增或变更 IPC 必须同时更新契约文档、contract test 和安全测试。

## 异步与取消

- 超过单次内存运算的外部调用接受 `AbortSignal`；Application 将同一 signal 传至 Router、Model 和可取消存储操作；
- Promise 必须 await、return 或显式 `void` 且附错误处理；禁止 floating promise；
- 资源使用 `try/finally` 释放；超时以可测试的 timeout helper 实现；
- 并发写入需说明顺序、一致性与幂等键；不以延时规避竞态；
- 捕获错误后必须恢复、映射或重新抛出，禁止空 catch。

## 错误与日志

- 只抛 `Error` 子类，Adapter 将未知错误转为 `AppError`；
- 用户消息与内部诊断分离；Renderer 永不见 stack/cause；
- 日志使用结构化 logger 和固定分类，字段 allowlist；禁止字符串拼接对象；
- 凭据、认证头、消息正文、文件正文、完整 URL query 默认禁止记录。

## 注释与文档

注释解释“为何、约束、风险”，不复述代码。公共端口与复杂不变量用 TSDoc；临时决策使用带 issue/日期的 TODO。架构变化更新 ADR，操作变化更新 README/实施文档。

## 格式与质量门禁

Prettier 负责格式，ESLint 负责语义。提交前至少通过 format check、lint、typecheck、unit tests；涉及 Main/IPC/DB 再跑 integration，用户关键路径变更再跑 E2E。

代码评审同时检查本次新增或修改的生产文件行数。若触及已登记的超限文件，必须核对治理清单和棘轮规则；在自动化门禁启用前不得忽略这一人工检查。

提交使用 Conventional Commits，例如 `feat(conversation): ...`、`fix(ipc): ...`、`docs(adr): ...`。每次提交聚焦一个可验证意图，不提交秘密、构建产物、个人数据库或日志。分支、历史整理、PR 与发布要求见 [Git 协作规范](git-standards.md)。

## 禁止事项

- `@ts-ignore`、无说明的 non-null assertion、大范围类型断言；
- Renderer 访问 Node/数据库/密钥或直接调用模型；
- 领域层导入 Electron、LangChain、React、SQLite；
- 动态 IPC channel、任意文件路径、任意 SQL/命令执行；
- API Key 明文持久化或进入 UI 全局状态；
- 用 Mock 成功提示伪装真实执行；
- 降低 Electron 安全开关来解决开发问题。
