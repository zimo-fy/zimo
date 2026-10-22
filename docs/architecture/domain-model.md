# 领域模型

## 设计原则

领域对象是纯 TypeScript 数据与行为，不继承 LangChain、LangGraph、Electron 或 ORM 类型。跨进程对象是独立 DTO，由 Application 显式映射。所有 ID 是带品牌的字符串；所有时间在领域内使用 `Date`，跨 IPC/数据库使用 UTC ISO-8601 文本。

## 聚合与生命周期

| 聚合根                  | 核心子项                            | 删除策略             | V0.1 真实能力          |
| ----------------------- | ----------------------------------- | -------------------- | ---------------------- |
| UserSession             | 云端用户、账号、secretRef、过期时间 | 登出清除             | 真实登录、校验与恢复   |
| ModelProviderConfig     | ModelDefinition、secretRef、能力    | 受引用时禁删/停用    | 配置、连接测试、选择   |
| Conversation            | Message、选用模型                   | 软删除               | 完整持久化与流式更新   |
| WorkspaceGrant          | 会话、Main-only 根引用、模式、状态  | 会话删除级联/可移除  | Phase 9D 受控目录      |
| ApprovalRequest         | run、Tool Call、digest、状态、期限  | 一次消费/重启失效    | Phase 9C 动作审批      |
| AgentDefinition         | Skill/KB/Tool 引用、权限策略        | 软删除               | SQLite CRUD            |
| SkillDefinition         | 版本、来源、指令、checksum、权限    | 软删除               | SQLite CRUD/本地安装   |
| KnowledgeBaseDefinition | DocumentDefinition                  | 软删除               | Mock CRUD/导入状态     |
| WorkflowDefinition      | Node、Edge、配置、端口              | 硬删除（当前版本）   | 本地画布保存、结构校验 |
| PluginDefinition        | 能力清单、权限、Connector           | 软删除               | Mock 安装状态          |
| McpServerDefinition     | 传输配置、能力摘要                  | 硬删除，审计记录保留 | Mock 连接状态          |
| AutomationDefinition    | Schedule、时间范围、专用会话、状态  | 软删除               | 本地调度/运行历史      |
| IntentRouteRecord       | Route、耗时、fallbackReason         | 保留期清理           | 真实记录，不含输入正文 |
| AppSetting              | 键、非敏感值                        | 硬删除               | 真实持久化             |

## 核心值对象

```ts
type EntityId<T extends string> = string & { readonly __entity: T };

interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
}

interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  vision: boolean;
  reasoning: boolean;
  promptCaching: boolean;
  maxContextTokens?: number;
}

interface IntentRoute {
  intent: "chat" | "agent" | "skill" | "workflow" | "unknown";
  targetId?: string;
  confidence: number;
  parameters: Readonly<Record<string, unknown>>;
  reason?: string;
  shouldExecute: false;
}
```

## Conversation 不变量

- 标题去除首尾空格后为 1–120 字符；未命名会话先使用 Application 生成的本地化默认标题，第一轮回答后可由模型生成标题，写入前必须确认用户尚未手动改名。
- 每条 Message 只属于一个 Conversation；角色仅为 `user | assistant | system`，V0.1 UI 不创建 system 消息。
- Message 状态为 `pending | streaming | completed | cancelled | failed`；用户消息写入后即为 `completed`。
- assistant 状态转换：`pending -> streaming -> completed | cancelled | failed`，终态不可逆。
- 同一会话 V0.1 只允许一个活动 run；重复 `requestId` 返回现有 run，不能重复创建消息。
- 删除会话为软删除，默认查询排除；V0.1 不提供恢复 UI，保留 30 天后才允许维护任务清理。
- 失败/取消保留已生成正文；重新生成创建新的 assistant Message，并通过 `replacesMessageId` 关联旧回答。

## WorkspaceGrant 不变量

- 每个会话有一个 `managed` 默认 grant，并可有最多 5 个 `external` grant，按 canonical root 去重；
- grant 的 `rootRef` 只在 Main/Repository 使用，跨 IPC 和模型 Prompt 只暴露 opaque workspace ID 与显示名；未授权目录访问使用 Tool Call 中单一、严格校验的 `absolutePath`，不把它升级成通用 IPC；
- Phase 9D 允许 `list/search/read/create/mkdir/patch/delete`；grant 内使用规范化相对路径，未授权路径只读或先审批授权；`mkdir` 逐级创建，修改和删除必须绑定最近读取的 checksum；
- 创建不覆盖，修改原子替换；修改/删除前写入应用管理恢复区，恢复区不属于用户 workspace grant；
- 外部目录首次写入批准后，以 `ownerUserId + canonical root` 持久授权；以后可在其他会话自动复用，移除外部 grant 会撤销账号级授权但不删除目录内容；
- 未授权绝对路径只允许有界读取；写入必须先形成审批动作。Zimo `system/accounts` 与安装目录始终拒绝通用文件访问；
- 文件系统根和 Home 不允许作为写入授权根；只读仍受敏感文件、内部根、符号链接、二进制与体积预算限制。

## ModelProviderConfig 不变量

- 托管 Provider 的 `baseUrl`、模型标识和显示名称只读取已保存配置。开发服务器模式允许保存 HTTPS 或 localhost HTTP(S) 测试地址。
- 登录后把已保存的托管模型设为默认并停用遗留 Provider。没有完整配置时仍可登录，并进入设置中的模型配置。开发服务器模式可更新该 Model 实体的 API 名称和图像模式，但不能改变其 ID 或默认状态。
- 数据实体只保存随机 `secretRef` 和 `keyHint`（如末四位），不保存 API Key。
- 默认模型必须属于已启用 provider 且已启用。
- capabilities 是配置/探测后的产品值对象，不能从 UI 对厂商名称进行推断。
- 删除前必须检查 Conversation、Agent 和 AppSetting 引用；有引用时要求先迁移。

## 原型聚合规则

- `status` 明确区分 `draft | enabled | disabled`；安装型实体另有 `not_installed | installed | update_available`。
- 原型交互只改变 Mock Repository 状态；运行/调试/连接按钮返回 `capability_unavailable`，UI 标注“预览”或“后续版本开放”。
- Definition 保存产品自有 JSON Schema 子集，不保存 Zod 对象、React 节点或 LangGraph 实例。
- 引用对象仅保存稳定 ID；查询详情时由 Application 组装名称等展示字段。

## 端口

```ts
interface AuthProvider {
  login(input: LoginInput): Promise<{ session: AuthSession; modelApiKey: string }>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession>;
}

interface ConversationRepository {
  create(conversation: Conversation): Promise<void>;
  getById(id: ConversationId): Promise<Conversation | null>;
  list(query: ConversationQuery): Promise<readonly ConversationSummary[]>;
  saveMessage(message: Message): Promise<void>;
  appendMessageText(id: MessageId, delta: string): Promise<void>;
  updateMessageStatus(id: MessageId, status: MessageStatus): Promise<void>;
  rename(id: ConversationId, title: string): Promise<void>;
  softDelete(id: ConversationId, deletedAt: Date): Promise<void>;
}

interface IntentRouter {
  route(input: RouteRequest, signal: AbortSignal): Promise<IntentRoute>;
}
```

`AuthSession` 的本地 `id` 与云端 `externalUserId` 分离；Token 只由 Main 通过 `tokenSecretRef` 读取，跨 IPC 的 View 不包含该引用。邮箱是可选资料，员工账号/手机号是稳定的登录展示字段。

Agent、Skill、Knowledge、Workflow、Plugin、MCP、Automation 各有专用 Repository；不使用暴露任意表名或任意过滤对象的通用数据库接口。Automation 由登录账号、计划和专用 Conversation 共同约束；能力权限以 Conversation 为唯一运行时来源，每次执行前重新解析。

## Router 决策规则

ADR 0007 的规则/LLM 分类保留为历史契约，任何旧 route 都固定 `shouldExecute: false`。ADR 0023 起普通会话不再运行该分类；显式绑定的 Agent/Workflow 直接形成兼容 route，其余请求固定为 chat，并由主模型通过 `search_capabilities` 按需发现本地能力。

能力发现结果不是新的持久聚合：它从 Prototype Repository、受控 Tool Registry 与市场目录派生，只在当前 run 内存在。动态 Tool ID 必须在加入模型暴露集合前重新确认仍存在于可信注册表；临时加载不修改 Conversation 的能力字段。
