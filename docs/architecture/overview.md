# Zimo 架构总览

状态：V0.2 Phase 7 已更新
适用版本：V0.1–V0.2

## 目标与边界

Zimo 是本地优先的 Electron 桌面应用。V0.1 完成安全桌面壳、模型流式对话、会话持久化、意图识别和产品原型；V0.2 已增量接入登录账号托管的 DeepSeek 模型、本地与 Zimo Skill Store、受审核 Python/Node Skill 脚本、Agent 运行、本地 RAG、受限 Workflow Runtime、通信渠道、多 Server HTTPS MCP Registry、Agent 模型 Tool Calling、逐条审批的实验性宿主机命令，以及应用存活期的本地 Automation 调度。Plugin 动态运行、邮件收取、通知自动投递、stdio/私网 MCP、操作系统常驻调度和 Router 自动执行仍未开放。

架构首先保护三条边界：Renderer 无本地权限；领域模型不依赖 Electron、LangChain 或模型厂商；所有外部能力经端口与适配器进入应用。

## 系统上下文

```text
用户
 │
 ▼
Renderer (React) ── typed window.zimo API ──► Preload
                                                │ validated IPC
                                                ▼
Electron Main ──► Application Services ──► Domain Ports
                       │                       │
                       │                       ├─ SQLite repositories
                       │                       ├─ Secret store
                       │                       ├─ LangChain model adapter
                       │                       ├─ Zimo Skill Store adapter
                       │                       ├─ 通用 Streamable HTTP MCP adapter
                       │                       └─ Mock repositories
                       ▼
                 Stream session registry
```

## 层与依赖方向

| 层          | 职责                                         | 可以依赖                  | 禁止依赖                                       |
| ----------- | -------------------------------------------- | ------------------------- | ---------------------------------------------- |
| Renderer    | 页面、状态呈现、输入、可访问性               | Application DTO、共享契约 | Node、Electron Main、数据库、厂商 SDK、API Key |
| Preload     | 暴露最小白名单、桥接事件、移除 IPC event     | Electron IPC、共享契约    | 业务规则、数据库、凭据                         |
| Main        | 生命周期、窗口、安全策略、IPC 注册、组合根   | Application、Adapters     | Renderer 状态                                  |
| Application | 用例编排、事务、取消、DTO 映射、统一流事件   | Domain ports、共享契约    | React、厂商原始事件                            |
| Domain      | 实体、值对象、策略、Repository/Provider 端口 | TypeScript 标准能力       | Electron、LangChain、SQLite、React             |
| Adapters    | SQLite、密钥库、认证、模型、日志及 Mock 实现 | Domain ports、外部库      | Renderer                                       |

依赖只能朝向 Domain。`packages/contracts` 是跨进程 DTO 与 Schema 的边界包，不承载领域行为。

## 运行时关键流程

### 登录

Renderer 调用具名 `auth.login` IPC；Main 校验员工账号/手机号与密码后，Application 调用 `AuthProvider`。`ZimoHttpAuthGateway` 按 xclaw 的 form-urlencoded 协议访问固定 HTTPS 登录服务，Token 只写入 SecretStore，SQLite 只保存非敏感会话与 secret ref。恢复时通过 `/verify-token` 校验 Bearer Token，Renderer 只得到不含凭据的 `AuthSessionView`。

### 发送消息

1. Renderer 通过 `conversation.send` 提交 `conversationId`、`modelId`、文本和客户端生成的 `requestId`。
2. Main 校验发送者与输入，Application 原子写入用户消息并创建 assistant 占位消息。
3. 普通会话不再运行前置 LLM Router；显式 Agent/Workflow 绑定直接解析，其他能力由主模型在需要时调用 `search_capabilities` 发现。兼容性的 `route.completed` 不再由 Renderer 展示。
4. Application 按模型上限计算完整请求预算；达到软水位时把较早消息生成版本化检查点摘要，完整 `messages` 不变，模型 Surface 改为“最新摘要 + 未覆盖原文”。
5. `ModelGateway` 接收领域消息，通过 LangChain 适配器访问 OpenAI-compatible 服务。
6. Application 把厂商/LangChain 事件转换为 `AgentStreamEvent`，Main 按 `runId` 发送给发起窗口；压缩生命周期同样作为会话事件展示。
7. 每段增量进入内存缓冲，按时间/大小节流持久化；完成、取消或失败时强制落库。

### 取消

Main 维护 `runId -> AbortController` 注册表。`conversation.cancel` 只允许取消当前窗口发起且仍存活的运行。终态仅允许出现一次；取消后保留已生成文本。

### Automation 调度

Automation 保存计划与账号所有者，并关联一个复用完整会话能力链的专用 Conversation。Main 的生命周期调度器每 30 秒查询当前登录账号的到期任务；Application 原子占用任务、推进 `nextRunAt` 后，通过 ConversationService 发送固定执行指令。应用关闭期间不驻留系统服务，恢复时只补跑一个到期周期；登出、账号切换和退出会取消活动运行。

## 安全默认值

- `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`；
- Renderer 只加载打包资源，不加载远程应用代码；
- 使用自定义 `app://` 协议，生产环境不依赖 `file://`；
- CSP 默认 `default-src 'self'`，模型访问仅由 Main 发出；
- 阻止未知导航、新窗口、WebView 和未经允许的权限；
- 每次 IPC 校验 sender、channel、输入和输出；Preload 不透传 `ipcRenderer`；
- 外链仅允许 `https:`，经 URL 解析和用户动作触发后交给系统浏览器；
- 登录接口返回的 `modelApiKey` 只在 Adapter → Application → Main 内存链路中流转，不进入 IPC 响应；数据库只保存 `secretRef`，真实值保存在操作系统安全存储；
- Main 使用已保存的模型标识、显示名称和 API 地址，并设为默认模型。没有完整配置时提示先配置模型，并打开设置中的模型配置。开发服务器 Renderer 可提交固定 Provider 的模型标识、地址、图像模式和可选新 Key，Application 再次校验开发边界；
- 日志先结构化再脱敏，不记录消息正文、凭据和认证头。

安全依据见 [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) 与 [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)。

## 可替换边界

```ts
interface ModelGateway {
  testConnection(input: ModelConnectionTest, signal?: AbortSignal): Promise<ModelTestResult>;
  stream(input: ModelRunRequest, signal: AbortSignal): AsyncIterable<ModelStreamEvent>;
}

interface Repository<T> {
  getById(id: string): Promise<T | null>;
  list(query?: unknown): Promise<readonly T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

interface SecretStore {
  set(ref: string, secret: string): Promise<void>;
  get(ref: string): Promise<string | null>;
  delete(ref: string): Promise<void>;
}

interface ToolExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}
```

Phase 7 使用 Main/Application 持有的 `ControlledToolService` 注册表。Renderer 只能读取能力摘要；Agent/Workflow 绑定 MCP Server 后，模型可在该 Server 完整快照中选择 Tool。脚本型 Skill 在安装完整包后注册为 `skill.<skillId>.run_script`，会话、Agent 或 Workflow 的 Skill 绑定构成本轮授权。固定身份和权限的 Creator 还可注册 workspace 限定的生成 Skill 安装 Tool，安装继续复用既有包读取器与 Application 安装服务。所有调用均经过参数边界、硬超时、取消、输出上限和脱敏审计。

按 ADR 0023，支持 Tool Calling 的普通会话始终获得应用内建 `search_capabilities`。模型仅在当前能力不足时搜索本地已安装能力；命中的 MCP Tool、受审核 Skill Tool 和知识检索 Tool 可临时加入当前 run，无需再次确认安装状态。动态加载不修改持久会话绑定，也不绕过具体工具的动作审批、参数校验和审计。Agent/Workflow 首版只发现，不在当前 Tool Loop 内递归运行。

Phase 9 采用 `system/accounts/workspaces` 数据布局，每个会话自动拥有默认 Workspace。模型稳定获得 `list/search/read/create/mkdir/patch/delete/run_command` 八个产品 Tool：授权目录使用 opaque workspace ID，未授权目录只允许受保护的绝对路径读取，首次写入按会话策略审批或自动放行后按账号持久授权。`mkdir` 只创建一个已有父目录下的子目录，不隐式递归；文件 Adapter 强制执行路径、链接、类型、预算和 checksum 校验；实验性命令 Adapter 以当前 OS 用户权限运行固定平台 Shell。“请求审批”对命令逐次确认，“帮我批准”自动执行当前可执行动作；关键危险和边界违规仍拒绝。用户添加的外部项目目录优先于默认内部输出目录；模型误选默认 ID 时 Application 仍把命令路由到最近添加的外部 grant。它没有 OS 文件或网络隔离，cwd 不是安全边界；Renderer 仍不存在通用文件或 Shell IPC。

Phase 9F 基础审计以 `security_audit_events` 保存 append-only 脱敏事实。策略自动放行/拒绝、审批生命周期及 Tool 开始/终态分别写入；副作用 Tool 无法写入开始事实时失败关闭。Renderer 只有有界只读列表接口，不能查询正文、路径、参数值、digest 或修改单条事件。

## 质量属性

- 安全：最小权限、默认拒绝、秘密不跨 Renderer 边界。
- 可恢复：会话与不完整回答可恢复；流终态幂等。
- 可测试：Application 用例对端口编程，Mock 与 SQLite 实现跑同一契约测试。
- 可观察：每次发送产生 `traceId` 和 `runId`，记录耗时、状态、token 使用及错误码，不记录正文。
- 可演进：V0.1 原型实体与未来运行时定义分离；数据库迁移只向前追加。

## V0.1 不允许的捷径

- 在 React 组件中导入 Electron、SQLite、LangChain 或 Mock JSON；
- 用事件总线绕过类型安全 IPC；
- 把 LangChain message/agent/graph 对象直接持久化；
- 把 API Key 放入 Zustand/React Context/localStorage/SQLite/日志；
- 在 Renderer 拼接 SQL、模型请求或系统提示词；
- 为原型按钮伪造“已执行”结果。
