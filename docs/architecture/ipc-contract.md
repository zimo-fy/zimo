# IPC 契约

## 原则

唯一全局入口为 `window.zimo`。Preload 为每项能力提供具名函数，不暴露 `ipcRenderer.send/on/invoke`。所有 request、response 和 event 都在 `packages/contracts` 用 Zod 定义，并通过 `z.infer` 生成类型；Main 在进入用例前校验输入，在返回前校验输出。

通道采用 `zimo:<domain>:<action>:v1`。破坏性变更新增版本，不原地改变含义。

## 通用信封

```ts
type IpcRequest<T> = {
  requestId: string;
  payload: T;
};

type IpcResult<T> =
  | { ok: true; requestId: string; data: T }
  | { ok: false; requestId: string; error: SerializedAppError };

type SerializedAppError = {
  code: string;
  category: "user" | "configuration" | "network" | "model" | "storage" | "security" | "internal";
  message: string;
  retryable: boolean;
  details?: Record<string, string | number | boolean>;
};
```

禁止把 stack、cause、路径、SQL、响应头或秘密放进 `SerializedAppError`。

`zimo:updates:state:v1` 是 Main 到 Renderer 的单向状态事件。事件只包含状态、当前/可用版本、有界进度、纯文本更新日志、通用错误消息和是否由用户主动触发；禁止包含下载 URL、本地包路径、SHA、响应正文或请求头。当前 `check` 不访问更新源，只发布 `up-to-date`。`zimo:models:list-catalog:v1` 不再请求 `ai/model/all`，调用会直接拒绝。

`zimo:automations:task-list-changed:v1` 是 Main 到 Renderer 的单向失效通知，载荷严格为 `{}`。专用会话消息建立、运行终态落库或删除后发送；Preload 仅暴露 `automations.onTaskListChanged(listener)`，Renderer 收到后重新调用现有会话列表 API。事件不携带账号、自动化 ID、指令或消息正文；窗口未打开时依赖初次读取恢复。

## V0.1 invoke 通道

会话人工问答增量：`zimo:user-questions:list-pending:v1` 接收 `{ conversationId }` 并仅返回当前窗口正在展示的一题及题号/总数；`zimo:user-questions:answer:v1` 接收 `{ questionId, answers: [{ id, selected, custom? }] }`，每次只回答当前一题并返回 `{ accepted }`。Main 以 IPC sender 身份核对等待请求，答案必须匹配当前题目与原选项；接受后当前问题 ID 立即失效，多题批次再发布下一题。它不能授予任何动作权限；格式和上限见 `packages/contracts/src/user-questions.ts`。

手动压缩与用户记忆增量：`zimo:conversation:compact:v1` 接收 `{ conversationId }` 并返回最新 `ConversationDetailView`；`zimo:conversation:compact-cancel:v1` 接收 `{ conversationId }` 并返回 `{ accepted }`。`zimo:user-memories:list:v1` 接收 `{}`、返回最多 100 条当前账号记忆；`zimo:user-memories:save:v1` 接收 `{ id?, kind, content, enabled }`、返回记忆 DTO；`zimo:user-memories:delete:v1` 接收 `{ id }`、返回 `{ success: true }`。Main 使用当前有效登录会话解析所有者，Renderer 不能传账号 ID；手动压缩仍通过 `context.compaction.*` 严格流事件展示。

| 通道                                              | 输入                                                           | 输出                                           | Phase                    |
| ------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- | ------------------------ |
| `zimo:app:get-info:v1`                            | `{}`                                                           | `AppInfoView`                                  | 1                        |
| `zimo:updates:get-state:v1`                       | `{}`                                                           | `AppUpdateStateView`                           | 7.5                      |
| `zimo:updates:check:v1`                           | `{}`                                                           | `AppUpdateStateView`                           | 7.5                      |
| `zimo:updates:install:v1`                         | `{}`                                                           | `{ success: true }`                            | 7.5                      |
| `zimo:auth:get-session:v1`                        | `{}`                                                           | `AuthSessionView \| null`                      | 1                        |
| `zimo:auth:login:v1`                              | `{ username, password }`                                       | `AuthSessionView`（不含 Token）                | 真实认证增量             |
| `zimo:auth:start-onboarding:v1`                   | `{}`                                                           | `AuthSessionView`（不含 Token）                | 桌面开始使用与 E2E       |
| `zimo:auth:logout:v1`                             | `{}`                                                           | `{ success: true }`                            | 1                        |
| `zimo:settings:get:v1`                            | `{ keys?: string[] }`                                          | `AppSettingsView`                              | 1                        |
| `zimo:settings:update:v1`                         | `UpdateSettingsInput`                                          | `AppSettingsView`                              | 1                        |
| `zimo:web-search:get-configuration:v1`            | `{}`                                                           | `WebSearchConfigurationView`                   | 10 增量                  |
| `zimo:web-search:test-configuration:v1`           | `SaveWebSearchConfigurationInput`                              | `{ ok: true, latencyMs }`                      | 10 增量                  |
| `zimo:web-search:save-configuration:v1`           | `SaveWebSearchConfigurationInput`                              | `WebSearchConfigurationView`                   | 10 增量                  |
| `zimo:models:list:v1`                             | `{}`                                                           | `ModelProviderView[]`                          | 2                        |
| `zimo:models:list-catalog:v1`                     | `{}`                                                           | `CatalogModelView[]`                           | 10 增量                  |
| `zimo:models:save-provider:v1`                    | `SaveProviderInput`                                            | `ModelProviderView`                            | 2                        |
| `zimo:models:delete-provider:v1`                  | `{ providerId }`                                               | `{ success: true }`                            | 2                        |
| `zimo:models:test-provider:v1`                    | `{ providerId }` 或未保存配置+key                              | `ModelTestResult`                              | 2                        |
| `zimo:models:get-default:v1`                      | `{}`                                                           | `{ modelId: string \| null }`                  | 2                        |
| `zimo:models:set-default:v1`                      | `{ modelId }`                                                  | `{ modelId }`                                  | 2                        |
| `zimo:conversations:list:v1`                      | `ConversationListQuery`                                        | `ConversationSummaryView[]`                    | 2                        |
| `zimo:conversations:get:v1`                       | `{ conversationId }`                                           | `ConversationDetailView`                       | 2                        |
| `zimo:conversations:create:v1`                    | `{ modelId? }`                                                 | `ConversationDetailView`                       | 2                        |
| `zimo:conversations:rename:v1`                    | `{ conversationId, title }`                                    | `ConversationSummaryView`                      | 2                        |
| `zimo:conversations:set-pinned:v1`                | `{ conversationId, pinned }`                                   | `{ success: true }`                            | 10.1                     |
| `zimo:conversations:change-model:v1`              | `{ conversationId, modelId }`                                  | `ConversationDetailView`                       | 2                        |
| `zimo:conversations:select-catalog-model:v1`      | `{ conversationId, catalogId }`                                | `ConversationDetailView`                       | 10 增量                  |
| `zimo:conversations:change-agent:v1`              | `{ conversationId, agentId: string                             | null }`                                        | `ConversationDetailView` | 5   |
| `zimo:conversations:change-knowledge:v1`          | `{ conversationId, knowledgeBaseIds }`                         | `ConversationDetailView`                       | 6C                       |
| `zimo:conversations:change-capabilities:v1`       | 原子提交 Agent/Skill/知识库/Workflow/MCP Tool ID 集合          | `ConversationDetailView`                       | 7                        |
| `zimo:conversations:delete:v1`                    | `{ conversationId }`                                           | `{ success: true }`                            | 2                        |
| `zimo:conversation:send:v1`                       | `{ conversationId, content, artifactIds[] }`                   | `{ runId, userMessageId, assistantMessageId }` | 2/4/8A                   |
| `zimo:conversation:cancel:v1`                     | `{ runId }`                                                    | `{ accepted: boolean }`                        | 2                        |
| `zimo:conversation:regenerate:v1`                 | `{ conversationId, messageId, requestId }`                     | `{ runId, assistantMessageId }`                | 2                        |
| `zimo:document:list:v1`                           | `{ conversationId }`                                           | `DocumentArtifactView[]`                       | 8A                       |
| `zimo:document:import-selected:v1`                | `{ conversationId }`                                           | `DocumentImportResultView \| null`             | 8A                       |
| `zimo:document:import-dropped:v1`                 | `{ conversationId, sourcePaths }`                              | `DocumentImportResultView`                     | 8A                       |
| `zimo:document:remove-draft:v1`                   | `{ conversationId, artifactId }`                               | `{ success: true }`                            | 8A                       |
| `zimo:document:export:v1`                         | `{ conversationId, artifactId }`                               | `{ exported: boolean }`                        | 8A                       |
| `zimo:document:inspect:v1`                        | `{ conversationId, artifactId }`                               | `DocumentDigestView`                           | 8B                       |
| `zimo:document:read:v1`                           | `{ conversationId, artifactId, selector }`                     | `DocumentSliceView`                            | 8B                       |
| `zimo:prototype:list:v1`                          | `{ kind, query? }`                                             | `PrototypeSummaryView[]`                       | 3                        |
| `zimo:prototype:get:v1`                           | `{ kind, id }`                                                 | `PrototypeDetailView`                          | 3                        |
| `zimo:prototype:mutate:v1`                        | 判别联合 `PrototypeMutation`                                   | `PrototypeDetailView`                          | 3                        |
| `zimo:agent-catalog:list:v1`                      | `{}`                                                           | `AgentCatalogItemView[]`                       | Agent 人才库             |
| `zimo:agent-catalog:install:v1`                   | `{ catalogId }`                                                | `AgentCatalogItemView`                         | Agent 人才库             |
| `zimo:agent-catalog:uninstall:v1`                 | `{ agentId }`                                                  | `{ success: true }`                            | Agent 人才库             |
| `zimo:skill:install-local:v1`                     | `{}`                                                           | `PrototypeDetailView \| null`                  | 5                        |
| `zimo:skill-catalog:list:v1`                      | `{}`                                                           | `SkillCatalogItemView[]`                       | Skill Store              |
| `zimo:skill-catalog:install:v1`                   | `{ catalogId }`                                                | `SkillCatalogItemView`                         | Skill Store              |
| `zimo:skill-catalog:uninstall:v1`                 | `{ skillId }`                                                  | `{ success: true }`                            | Skill Store              |
| `zimo:router:list-targets:v1`                     | `{ type? }`                                                    | `RouteTargetView[]`                            | 4                        |
| `zimo:knowledge:list-documents:v1`                | `{ knowledgeBaseId }`                                          | `KnowledgeDocumentView[]`                      | 6                        |
| `zimo:knowledge:remote-directory-catalog:list:v1` | `{}`                                                           | `RemoteKnowledgeDirectoryCatalogView`          | 6+                       |
| `zimo:knowledge:cloud-sync:bindings:list:v1`      | `{}`                                                           | `KnowledgeCloudDirectoryBindingView[]`         | 6+                       |
| `zimo:knowledge:cloud-sync:directory:sync:v1`     | `{ catalogDirectoryId, mode: import \| update }`               | `KnowledgeCloudSyncResultView`                 | 6+                       |
| `zimo:knowledge:import-selected:v1`               | `{ knowledgeBaseId }`                                          | `KnowledgeImportResultView \| null`            | 6                        |
| `zimo:knowledge:import-dropped:v1`                | `{ knowledgeBaseId, sourcePaths }`                             | `KnowledgeImportResultView`                    | 6                        |
| `zimo:knowledge:delete-document:v1`               | `{ knowledgeBaseId, documentId }`                              | `{ success: true }`                            | 6                        |
| `zimo:knowledge:search:v1`                        | `{ knowledgeBaseId, query, limit? }`                           | `KnowledgeSearchHitView[]`                     | 6                        |
| `zimo:knowledge:embedding-model:get:v1`           | `{}`                                                           | `EmbeddingModelView`                           | 6                        |
| `zimo:communication-channels:list:v1`             | `{}`                                                           | `CommunicationChannelView[]`                   | 通信渠道 V0              |
| `zimo:communication-channels:bind-email:v2`       | `{ email }`                                                    | `CommunicationChannelView`                     | 通信渠道 V0              |
| `zimo:communication-channels:start-weixin:v1`     | `{}`                                                           | 二维码 data URL、session ID、过期时间          | 通信渠道 V0              |
| `zimo:communication-channels:poll-weixin:v1`      | `{ sessionId, verifyCode? }`                                   | 枚举登录状态，不含 token                       | 通信渠道 V0              |
| `zimo:communication-channels:cancel-weixin:v1`    | `{ sessionId }`                                                | `{ success: true }`                            | 通信渠道 V0              |
| `zimo:communication-channels:unbind:v1`           | `{ kind }`                                                     | `{ success: true }`                            | 通信渠道 V0              |
| `zimo:communication-channels:send-weixin-test:v1` | `{}`                                                           | `{ success: true }`                            | 通信渠道 Phase 7.3       |
| `zimo:mcp:list:v1`                                | `{}`                                                           | `McpConnectionView[]`                          | MCP Registry             |
| `zimo:mcp:connect:v1`                             | `{ serverId,name,endpoint,source,authentication,credential? }` | `McpConnectionView`                            | MCP Registry             |
| `zimo:mcp:refresh:v1`                             | `{ serverId }`                                                 | `McpConnectionView`                            | MCP Registry             |
| `zimo:mcp:disconnect:v1`                          | `{ serverId }`                                                 | `{ success: true }`                            | MCP Registry             |
| `zimo:automations:list:v1`                        | `{}`                                                           | `AutomationSummaryView[]`                      | 10                       |
| `zimo:automations:get:v1`                         | `{ automationId }`                                             | `AutomationDetailView`                         | 10                       |
| `zimo:automations:save:v1`                        | 创建或更新定义、计划、时间范围与会话能力                       | `AutomationDetailView`                         | 10                       |
| `zimo:automations:delete:v1`                      | `{ automationId }`                                             | `{ success: true }`                            | 10                       |
| `zimo:automations:set-enabled:v1`                 | `{ automationId, enabled }`                                    | `AutomationDetailView`                         | 10                       |
| `zimo:automations:run-now:v1`                     | `{ automationId }`                                             | `{ automationRunId }`                          | 10                       |

Phase 3 的统一 prototype 通道只复用传输骨架；Application 内仍分发到各模块专用用例和 Repository，不能形成通用任意 CRUD 后门。

## Stream 通道

- 订阅：Preload 暴露 `onAgentStream(listener): () => void`。
- Main 发送 `zimo:agent:stream:v1`，载荷为 `{ runId, sequence, event }`。
- listener 只接收经过 Schema 校验的普通对象，不接收 Electron event。
- `sequence` 从 0 单调递增，Renderer 忽略重复项；发现跳号时重新读取会话详情恢复。
- unsubscribe 必须移除包装后的原始监听器，页面卸载和应用退出时调用。
- Main 只向发起 run 的 `webContents` 发送；页面销毁时中止其所有 run。
- Phase 6C 增加 `knowledge.retrieved`，只携带助手消息 ID 和最多 8 条来源快照，不携带知识正文或本地路径。
- 助手工具步骤通过同一条 `zimo:agent:stream:v1` 发送 `message.steps.updated`，只含安全标题、可选相对路径和状态；Renderer 不能从步骤事件读取工具参数、输出或绝对路径。会话详情 DTO 的 `messages[].steps` 与 `steps_json` 同源。
- 会话详情 DTO 的 `messages[].modelDisplayName` 是该条助手回复生成时的显示名快照，与会话当前 `modelId` 及输入区选择解耦；升级前 NULL 的消息省略该字段。
- Phase 7 增加只读 `tools.list` 能力摘要，以及 `workflows.run/cancel/onStream`。Renderer 没有通用 Tool execute channel；本次运行确认仅携带已配置 Tool ID，不携带凭据。

## `window.zimo` 草案

```ts
interface ZimoDesktopApi {
  app: { getInfo(): Promise<IpcResult<AppInfoView>> };
  automations: AutomationDesktopApi;
  auth: {
    getSession(): Promise<IpcResult<AuthSessionView | null>>;
    login(input: IpcRequest<LoginInput>): Promise<IpcResult<AuthSessionView>>;
    startOnboarding(): Promise<IpcResult<AuthSessionView>>;
    logout(input: IpcRequest<Record<string, never>>): Promise<IpcResult<{ success: true }>>;
  };
  conversations: {
    list(input: IpcRequest<ConversationListQuery>): Promise<IpcResult<ConversationSummaryView[]>>;
    get(input: IpcRequest<{ conversationId: string }>): Promise<IpcResult<ConversationDetailView>>;
    create(input: IpcRequest<{ modelId?: string }>): Promise<IpcResult<ConversationDetailView>>;
    changeAgent(
      input: IpcRequest<{ conversationId: string; agentId: string | null }>,
    ): Promise<IpcResult<ConversationDetailView>>;
    changeCapabilities(
      input: IpcRequest<ChangeConversationCapabilitiesInput>,
    ): Promise<IpcResult<ConversationDetailView>>;
    send(input: IpcRequest<SendMessageInput>): Promise<IpcResult<SendAccepted>>;
    cancel(input: IpcRequest<{ runId: string }>): Promise<IpcResult<{ accepted: boolean }>>;
    onStream(listener: (envelope: AgentStreamEnvelope) => void): () => void;
  };
  artifacts: {
    list(conversationId: string): Promise<IpcResult<DocumentArtifactView[]>>;
    select(conversationId: string): Promise<IpcResult<DocumentImportResultView | null>>;
    importDropped(
      conversationId: string,
      files: readonly File[],
    ): Promise<IpcResult<DocumentImportResultView>>;
    removeDraft(conversationId: string, artifactId: string): Promise<IpcResult<{ success: true }>>;
    export(conversationId: string, artifactId: string): Promise<IpcResult<{ exported: boolean }>>;
    inspect(conversationId: string, artifactId: string): Promise<IpcResult<DocumentDigestView>>;
    read(
      conversationId: string,
      artifactId: string,
      selector: DocumentSelectorView,
    ): Promise<IpcResult<DocumentSliceView>>;
  };
}
```

## Handler 防护顺序

1. 检查 `event.senderFrame` 存在且是主窗口顶层 frame；
2. 检查 URL 属于生产 `app://zimo` 或开发服务器精确 allowlist；
3. 用对应 Zod Schema `safeParse` 输入，设置长度、数组大小和 URL 限制；
4. 从 Main 侧会话解析用户身份，不信任 Renderer 传入的 userId；
5. 执行用例并校验输出；
6. 错误映射与脱敏后返回；
7. 记录 channel、requestId、durationMs、result 和 errorCode，不记录 payload。

## 关键限制

- 文本消息默认上限 100,000 UTF-16 code units，进入模型前还需按模型上下文预算校验；
- 会话文档导入白名单含办公文档、常见文本和 PNG/JPEG/WebP，每个不超过 20 MB、每条消息最多 10 个；发送时 artifact ID 与用户消息在同一事务绑定。仅本轮附件或明确文档后续请求可向模型提供总计最多 6,000 字符的不可信预览；预览 IPC 最多 2,000 字符，读取 IPC 单次最多 12,000 字符。对话内图片展示走 `zimo-doc:` 协议，不经 IPC 传二进制；
- ID 使用 UUID Schema，禁止路径、SQL 片段和未定义对象键；
- Provider URL 只允许 `https:`；开发 localhost 例外由 Main 配置决定；
- 生产 UI 不再接收模型 API Key，只读接收已保存的地址与模型名；既有手动模型 mutation IPC 在打包环境由 Application 拒绝。开发服务器页面可用同一严格 IPC 更新固定托管 Provider 的地址、模型标识和可选新 Key，但不能读取旧 Key、新增/删除 Provider 或改变模型能力；
- 登录密码仅瞬时跨 Preload 到 Main；云端 Token 与登录响应的 `modelApiKey` 分别进入 SecretStore，认证 IPC 响应仍只返回安全会话视图；账号、密码、Token、模型密钥、认证头和远端响应正文不得进入普通日志；
- 邮箱 bind 只接收规范化地址，不接收密码、授权码或服务器配置；微信 bot token 只由 Main 从腾讯响应写入 SecretStore，不出现在响应或普通日志；
- 通信渠道 list 只返回当前 Main 认证账号的绑定，并为微信返回 `runtimeStatus`、`canSendTestMessage` 和可选 `lastInboundAt`；游标、微信用户 ID、`context_token` 与错误响应正文不进入 Renderer；
- Automation IPC 不接收 userId；Main 从当前会话解析账号。列表摘要不返回指令正文，详情仅返回当前账号的专用会话能力和近期运行。时间计划、ID 集合和正文长度均经严格 Schema；Renderer 没有直接触发任意会话或绕过非重叠领取的调度入口；
- MCP connect 只接受公开 HTTPS 与 `none|bearer|oauth|header_token|api_key|query_token` 严格枚举；后 3 类只允许 Main 受信目录 ID，Renderer 不能指定 Header/Query 名称。凭据瞬时进入 Main/SecretStore，响应不含 credential、Authorization Header、secret ref 或完整工具 Schema；Renderer 没有通用 `tools/call` IPC；
- 文件选择和 Skill 目录选择只由 Main 发起系统选择器；文件拖放路径只在 Preload 通过 Electron `webUtils` 取得并发送给 Main，Renderer 业务代码、响应和日志均不获得路径。会话文档导入后只返回 opaque artifact/revision ID 与安全元数据，导出路径也只来自 Main 原生另存为对话框；本地 instruction Skill 强制读取受限的 `SKILL.md`，可选 manifest 只用于尽力补充元数据，不解释执行声明；
- Skill Store 目录由 Main 读取应用内 `resources/skills` 的直接子目录，不请求云端目录接口；Renderer 安装时只提交目录名形式的 catalog ID，不接收本地路径。安装仍由 Main 重新读取该子目录并保存完整受审核包；
- Agent 人才库由 Main 读取应用内 `resources/agents` 的直接子目录，不请求云端人才库接口；Renderer 只接收展示字段并提交目录名形式的 catalog ID 或 local Agent ID，不接收本地路径；
- 未登记的 channel 不注册 handler，测试验证调用失败。

## Phase 9 IPC

Phase 9C 已新增具名工作目录模式和审批通道；Phase 9F 增加只读 `security-audit:list:v1`，返回脱敏事件枚举、Tool ID、风险、结果、错误码、耗时，以及文件动作的授权目录显示名和相对目标，不返回 Tool 参数、正文、digest 或绝对路径。账号级已放行目录使用独立、具名的列表/撤销 IPC；不得新增通用文件、Shell 或任意 invoke IPC。

| Channel                                    | 输入摘要                                 | 输出摘要                       | 约束                                                       |
| ------------------------------------------ | ---------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| `zimo:workspaces:select:v1`                | `{ conversationId }`                     | `WorkspaceGrantView \| null`   | Main 原生目录选择器；响应不含路径                          |
| `zimo:workspaces:attach-dropped:v1`        | `{ conversationId, sourcePath }`         | `WorkspaceGrantView`           | Preload 用 `webUtils` 解析 File；Renderer API 不接收路径   |
| `zimo:workspaces:list:v1`                  | `{ conversationId }`                     | `WorkspaceGrantView[]`         | 自动确保默认 grant；只返回 ID、名称、kind、模式和状态      |
| `zimo:workspaces:remove:v1`                | `{ conversationId, workspaceId }`        | `{ success: true }`            | 默认 grant 不可移除；外部 grant 同时撤销账号授权，不删目录 |
| `zimo:workspaces:change-mode:v1`           | `{ conversationId, mode }`               | `{ success: true }`            | 已实现；仅 `ask`、`auto_approve`                           |
| `zimo:workspaces:authorizations:list:v1`   | `{}`                                     | `WorkspaceAuthorizationView[]` | 设置页专用；返回当前账号明确放行目录及本机位置             |
| `zimo:workspaces:authorizations:revoke:v1` | `{ authorizationId }`                    | `{ success: true }`            | 撤销当前账号授权并移除同根外部 grant，不删除目录           |
| `zimo:approvals:list-pending:v1`           | `{ conversationId }`                     | `PendingApprovalView[]`        | 已实现；只返回当前窗口内存中的待审批请求                   |
| `zimo:approvals:resolve:v1`                | `{ approvalId, decision, actionDigest }` | `{ accepted: boolean }`        | 已实现；仅一次允许/拒绝                                    |
| `zimo:audit:list:v1`                       | 有界筛选与 cursor                        | `AuditEventPageView`           | 规划；不返回正文、路径或秘密                               |
| `zimo:audit:get:v1`                        | `{ auditEventId }`                       | `AuditEventDetailView`         | 规划；只返回 allowlist 摘要                                |

现有 `WorkspaceGrantView` 使用 opaque `workspaceId`、脱敏 `displayName` 与 `managed|external` kind。所有模型文件 Tool 从 Application 进入 Main 文件 Adapter；绝对路径只允许出现在模型 Tool 参数、用户审批视图及设置页已放行目录专用 DTO，不进入普通日志或 append-only 审计事件。Renderer 不获得 `runCommand`、`readPath`、`writePath` 或 `executeTool` IPC。

审批 resolve 是对流事件中既有请求的应答，不接受 Renderer 自报的 action、risk、command、path、domain 或 user ID。所有新输入/输出必须在 `packages/contracts` 使用 strict Zod Schema；批准后若目标文件 checksum、目录 grant、策略版本或 run 状态改变，Application 应拒绝陈旧请求。
