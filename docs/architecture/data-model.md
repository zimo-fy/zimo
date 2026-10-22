# 本地数据模型

## 存储策略

SQLite 由 Main 进程的数据库 Adapter 独占，开启 foreign keys、WAL 和 busy timeout。所有写操作通过 Repository；多表用例在 Application 的 `UnitOfWork` 中运行。运行时以 `node:sqlite` 连接数据库，并使用 Drizzle ORM 映射 Schema 和实现部分 Repository 查询；Schema 升级不使用 Drizzle Kit migration runner，而是由项目自有的只向前 SQL migration 执行器管理，`schema_migrations(version, name, applied_at, checksum)` 记录版本。

数据库保存产品 DTO 友好的标量与 JSON，不保存 LangChain/LangGraph/React/ORM 对象。所有时间为 UTC ISO-8601 文本；ID 为 UUID 字符串。

## 关系概览

```text
model_providers 1──n models
models          1──n conversations 1──n messages
conversations   1──n document_artifacts 1──n document_revisions
messages        n──m document_artifacts (message_artifact_bindings)
conversations   1──n conversation_workspace_grants
conversations   1──n conversation_context_compactions
user_memories   n──1 登录账号（按 owner_user_id 隔离）
conversations   1──n intent_route_records
agents          1──n conversations (optional default Agent)
agents          n──m skills / knowledge_bases
knowledge_bases 1──n knowledge_documents 1──n knowledge_chunks
workflow_definitions 1──1 workflow JSON definition
automations     1──1 conversations (专用执行会话，能力由会话保存)
automations     1──n automation_runs
communication_channel_bindings ── SecretStore (微信 token、游标和 context_token 通过 secret_ref)
weixin_assistant_routes ── conversations
weixin_inbound_receipts
github_mcp_connections ── SecretStore (PAT 仅通过 secret_ref)
```

## 表定义基线

所有可变实体都含 `created_at`、`updated_at`；支持软删除的表另含 nullable `deleted_at`。

| 表                                 | 关键列                                                                                                                                                                                     | 约束/说明                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `user_sessions`                    | `id`, `auth_provider`, `external_user_id`, `account_id`, `display_name`, `email`, `token_secret_ref`, `expires_at`                                                                         | Token 在 SecretStore；最多一个 active                                                   |
| `model_providers`                  | `id`, `name`, `base_url`, `secret_ref`, `key_hint`, `kind`, `enabled`                                                                                                                      | 唯一 `(name, deleted_at)`；绝不含 key                                                   |
| `models`                           | `id`, `provider_id`, `name`, `display_name`, `capabilities_json`, `enabled`                                                                                                                | FK provider；唯一 provider+name                                                         |
| `conversations`                    | `id`, `title`, `model_id`, `agent_id`, `skill_ids_json`, `knowledge_base_ids_json`, `workflow_id`, `mcp_tool_ids_json`, `active_run_id`, `is_pinned`, `deleted_at`                         | FK model/Agent/Workflow；能力选择快照与任务置顶状态                                     |
| `messages`                         | `id`, `conversation_id`, `role`, `content`, `status`, `position`, `replaces_message_id`, `error_code`, `usage_json`, `knowledge_citations_json`, `model_display_name`                      | 唯一 conversation+position；助手消息可选保存生成时模型显示名                            |
| `conversation_context_compactions` | `id`, `conversation_id`, `version`, `status`, `trigger`, `source_from/to_message_id`, `covered_through_position`, `retained_from_position`, `summary`, `input/output_tokens`, `error_code` | 模型 Surface 检查点；完整消息不变；每会话版本唯一                                       |
| `user_memories`                    | `id`, `owner_user_id`, `kind`, `content`, `enabled`, `created_at`, `updated_at`                                                                                                            | 当前账号手动维护或由普通会话模型工具写入的长期记忆；与会话检查点分离，单条最多 500 字符 |
| `document_artifacts`               | `id`, `conversation_id`, `display_name`, `media_type`, `format`, `size_bytes`, `status`, `current_revision_id`                                                                             | 只保存安全元数据与当前 revision ID；`0045` 允许 png/jpeg/webp                           |
| `document_revisions`               | `id`, `artifact_id`, `parent_revision_id`, `storage_key`, `checksum`, `size_bytes`, `created_by`                                                                                           | storage key 为应用管理目录内的 opaque 相对引用                                          |
| `message_artifact_bindings`        | `message_id`, `artifact_id`, `revision_id`, `relation`, `created_at`                                                                                                                       | 消息固定到具体 revision；同一 artifact 可分别作为输入和输出                             |
| `conversation_workspace_grants`    | `id`, `conversation_id`, `root_ref`, `display_name`, `mode`, `status`                                                                                                                      | Main-only 根引用；Renderer/模型只接收 opaque ID 和显示名                                |
| `prototype_definitions`            | Agent/Skill 共用定义；Agent 保存 catalog/remote ID，Skill 保存 `skill_package_id`、指令和校验值，并保存模型与绑定字段                                                                      | Agent catalog ID 唯一；Skill 编排身份从已保存指令解析，冲突时拒绝精确加载               |
| `agents`                           | 早期独立 Agent 表，当前 Agent 产品读写使用 `prototype_definitions`                                                                                                                         | 后续迁移清理遗留表                                                                      |
| `skills`                           | `id`, `name`, `description`, `version`, `source`, `status`, `manifest_json`, `deleted_at`                                                                                                  | 原型定义，不含脚本正文                                                                  |
| `knowledge_bases`                  | `id`, `name`, `description`, `status`, `config_json`, `deleted_at`                                                                                                                         | 原型定义                                                                                |
| `knowledge_documents`              | `id`, `knowledge_base_id`, `name`, `media_type`, `size_bytes`, `checksum`, `storage_key`, `status`, `chunk_count`, `error_code`                                                            | 内容摘要去重；路径不出 Main                                                             |
| `knowledge_chunks`                 | `id`, `knowledge_base_id`, `document_id`, `ordinal`, `text`, `metadata_json`, `embedding`                                                                                                  | FTS5 外部内容索引；向量为 Float32 BLOB                                                  |
| `workflows`                        | `id`, `name`, `description`, `status`, `definition_json`, `deleted_at`                                                                                                                     | definition 经 Schema 校验                                                               |
| `plugins`                          | `id`, `name`, `version`, `author`, `source`, `install_status`, `enabled`, `manifest_json`, `deleted_at`                                                                                    | Mock，不存第三方代码                                                                    |
| `communication_channel_bindings`   | `owner_user_id`, `kind`, `status`, `account_label`, `secret_ref`, `config_json`, `bound_at`, `updated_at`                                                                                  | 复合主键隔离账号；邮箱只存地址；微信运行秘密使用 secret_ref                             |
| `weixin_assistant_routes`          | `owner_user_id`, `conversation_id`, `updated_at`                                                                                                                                           | 每个账号固定映射一个“微信助手”会话                                                      |
| `weixin_inbound_receipts`          | `owner_user_id`, `dedupe_key`, `status`, `received_at`, `finished_at`, `error_code`                                                                                                        | 不保存消息正文、微信用户 ID 或 context_token；用于重放去重                              |
| `github_mcp_connections`           | GitHub 单例连接字段                                                                                                                                                                        | `0013` 迁移来源，运行时不再写入                                                         |
| `mcp_connections`                  | `server_id`, `name`, `endpoint`, `source`, `authentication`, `secret_ref`, `server_name`, `server_version`, `tools_json`, `connected_at`, `updated_at`                                     | 认证支持 none/bearer/oauth/header_token/api_key/query_token；凭据仅存引用               |
| `mcp_servers`                      | `id`, `name`, `transport`, `enabled`, `config_json`, `secret_ref`, `mock_capabilities_json`                                                                                                | 敏感值拆入 SecretStore                                                                  |
| `automations`                      | `id`, `owner_external_user_id`, `conversation_id`, `name`, `prompt`, `enabled`, `schedule_json`, `time_window_start/end`, `next_run_at`, `last_run_status`                                 | 账号隔离；专用会话保存能力；每日本地时间窗；软删除配置时保留有消息的历史会话            |
| `automation_runs`                  | `id`, `automation_id`, `conversation_run_id`, `trigger`, `status`, `scheduled_for`, `started_at`, `finished_at`, `error_code`                                                              | 每任务最多一个 running；不重复保存模型正文                                              |
| `intent_route_records`             | `id`, `conversation_id`, `run_id`, `input_fingerprint`, `input_length`, `intent`, `target_id`, `confidence`, `duration_ms`, `did_fallback`, `fallback_reason`                              | 不保存输入全文                                                                          |
| `app_settings`                     | `key`, `value_json`, `updated_at`                                                                                                                                                          | allowlist key；非敏感                                                                   |
| `schema_migrations`                | `version`, `name`, `checksum`, `applied_at`                                                                                                                                                | migration 账本                                                                          |

关联表：`agent_skills(agent_id, skill_id)`、`agent_knowledge_bases(agent_id, knowledge_base_id)`、`agent_tools(agent_id, tool_id, config_json)`、`agent_mcp_server_bindings(agent_id, server_id)` 和 `workflow_mcp_server_bindings(workflow_id, server_id)`。所有 FK 明确 `ON DELETE RESTRICT` 或 `CASCADE`，不使用默认行为。

## 索引

- `conversations(is_pinned DESC, updated_at DESC)`，过滤 `deleted_at IS NULL`；
- `conversations(agent_id)`，仅索引非空的会话默认 Agent；
- `conversations(workflow_id)`，仅索引非空的会话 Workflow；
- `messages(conversation_id, position)`；
- `intent_route_records(created_at DESC)` 和 `(run_id)`；
- 所有外键列；
- 原型列表的 `status, updated_at`；
- `prototype_definitions(agent_catalog_id)`，仅索引非空的 Agent 人才库条目且唯一；
- `knowledge_documents(knowledge_base_id, updated_at)` 与唯一 `(knowledge_base_id, checksum)`；
- `knowledge_chunks(knowledge_base_id, document_id, ordinal)`；知识文本通过 `knowledge_chunks_fts` FTS5 trigram 索引。

## JSON 列规则

写入前用版本化 Zod Schema 校验，顶层包含 `schemaVersion`。读取失败返回 storage error 并保留原始行用于诊断，但日志不输出 JSON 正文。迁移负责结构升级，UI 不兼容处理旧 shape。

## 秘密处理

`secret_ref` 是随机 opaque ID。登录托管模型时先把 `modelApiKey` 写入 SecretStore，再保存固定 Provider/Model 及 ref；若数据库失败则补偿删除新秘密。重新登录采用新 ref 成功切换后删除旧 ref，退出登录时停用托管 Provider 并删除秘密。遗留手动 Provider 为保持引用完整性只停用、不删除。

Phase 1 用 `safeStorage` 封装实现操作系统保护；若当前平台报告加密不可用，登录会在发起网络请求前失败，不降级明文。

## Migration 纪律

当前 migration 为 `0001_initial.sql` 至 `0044_conversation_catalog_vision.sql`。`0012` 保存旧 GitHub MCP 单例连接；`0013` 将其迁移到通用多 Server Registry并增加 Agent/Workflow MCP Server 绑定；`0014` 将会话升级为真实认证元数据与 Token secret ref；`0015` 增加 MCP `catalog/custom` 来源及 OAuth 认证类型；`0016` 为会话增加直接 Skill、Workflow 和逐项 MCP Tool 绑定；`0017` 保存 Agent catalog ID 与远端用户 Agent ID；`0018` 增加 Header Token 认证；`0019` 为五类能力删除增加事务级引用清理，并使历史 AgentRun 不再以外键阻止 Agent 删除；`0020` 增加目录专用 API Key Header 与 Query Token 认证；`0021` 增加渠道账号隔离、微信助手路由与入站去重收据；`0022` 增加会话文档资产、revision 和消息绑定；`0023` 把 revision 来源扩展为用户导入、模型创建、模型修改和转换；`0024` 让消息绑定固定到具体 revision，并允许同一 artifact 的原始输入与最终输出分别展示；`0025` 增加会话工作目录 grant；`0026` 增加账号隔离的 Automation、专用会话引用、下一次执行时间和运行历史；`0027` 将 Automation 的执行范围改为每日本地开始/结束时刻；`0028` 增加一次性动作审批事实；`0029` 增加 append-only 安全审计事实；`0030` 区分 managed/external grant；`0031` 增加账号级目录授权；`0032` 增加任务置顶状态；`0033` 将旧 `auto_low_risk` 迁移为 `auto_approve`；`0034` 保存账号级审批偏好；`0035` 保存会话上下文检查点；`0036` 保存账号记忆；`0037` 保存消息工具步骤；`0038` 保存浏览器能力开关，`0039` 保存会话云端模型快照；`0040` 默认启用既有非 Automation 会话的浏览器能力；知识库云端目录链接为版本 41（文件名仍为 `0039`）；`0042` 将会话文档 `format` 约束扩展为知识库可解析的导入白名单；`0043` 为助手消息保存生成时的模型显示名，切换会话模型不回写历史消息；`0044` 为会话云端模型快照保存 `catalog_model_vision`（目录 `supportImages`）。所有文件均进入 checksum 账本，禁止原地修改。

1. 文件名 `0001_initial.sql`，已发布 migration 永不修改；
2. 启动时在创建窗口前备份策略检查、校验 checksum、事务应用；SQL checksum 以移除开头 UTF-8 BOM、统一 LF 换行后的文本为准，旧账本仅允许等价换行符/BOM checksum 自动归一化；
3. 新列先 nullable/带默认值，再回填，再在后续版本收紧；
4. 破坏性迁移采用新表复制、校验行数、重命名；
5. migration 失败则应用进入只读恢复页，不启动部分版本 Schema；
6. 测试覆盖空库升级、逐版本升级、重复启动和失败回滚。

历史开发构建存在两条已确认的版本碰撞序列：Automation 曾以 25/26 写入账本，Phase 9 审批/审计/授权也曾以 26–29 写入账本。当前正式序列固定为 Workspace 25、Automation 26–27、Phase 9 28–31。启动时只在旧名称与规范化 SQL checksum 逐项精确匹配、且目标版本未被其他记录占用时，于单个事务内倒序移动账本版本；未知内容继续按 checksum mismatch 拒绝启动，禁止通过覆盖 checksum 掩盖 Schema 差异。

浏览器与云端模型曾同时使用 `0038` 文件前缀。若账本记录云端模型为 38、浏览器为 39，启动时在两条名称和 SQL checksum 精确匹配后事务性交换版本；仅云端模型 38 时将其移至 39，再应用浏览器 38。原浏览器 38 的数据库无需账本改写，直接应用新的云端模型 39。详见[版本碰撞记录](../issues/browser-catalog-migration-version-collision.md)。

## 保留与删除

- Conversation 及原型实体软删除；V0.1 UI 不自动物理清理；
- 远程 session 登出、过期、Token 缺失或校验失败时删除，并同步清理 SecretStore Token；旧 Mock session 在升级后失效；
- IntentRouteRecord 默认保留 30 天，未来由维护任务清理；
- 用户主动“清除本地数据”属于后续高风险操作，需二次确认和可恢复方案；
- SQLite 文件位置只由 Main 决定，设置页仅显示脱敏后的用户数据目录标签。
- 知识原文件位于 userData 的应用管理目录；用户删除文档/知识库时物理删除管理副本、文本块和向量。
- 会话文档位于 `userData/workspaces/<conversationId>/`；普通输出位于其 `files/`，附件和生成文档使用 artifact/revision 子目录。删除任务时删除对应资产记录，并尽力清理托管副本，不触碰外部用户原文件。
- Agent、Skill、知识库、Workflow 和 MCP Server 可直接删除；活动绑定自动清理，引用被删节点能力的 Workflow 自动禁用，AgentRun 历史 ID 保留。

## Phase 9 数据模型（9D 文件修改与 9F 基础审计中心已实现）

Phase 9 从 `0025` 起增加独立表，不把路径、审批或审计 JSON 堆入 `conversations`：

| 表/规划表                             | 关键列                                                                                                                                                                              | 安全/生命周期                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `conversation_workspace_grants`       | `id`, `conversation_id`, `root_ref`, `display_name`, `kind`, `mode`, `status`, `created_at`, `updated_at`                                                                           | `managed` 默认工作区不可移除；外部 grant 删除不删除用户目录                                    |
| `workspace_directory_authorizations`  | `id`, `owner_user_id`, `root_ref`, `display_name`, `created_at`, `updated_at`                                                                                                       | 登录账号级持久目录授权；仅设置页专用 IPC 可列出/撤销；不进入模型 Prompt                        |
| `workspace_approval_mode_preferences` | `owner_user_id`, `mode`, `updated_at`                                                                                                                                               | 登录账号最近审批模式；新任务初始化时读取，既有会话仍以 grant 为准                              |
| `approval_requests`                   | `id`, `conversation_id`, `run_id`, `tool_call_id`, `action_kind`, `action_digest`, `risk`, `policy_version`, `status`, `expires_at`, `resolved_at`, `created_at`                    | 不保存原始命令、文件正文、diff、Tool 参数或秘密；重启后所有 pending 过期                       |
| `security_audit_events`               | `id`, `conversation_id`, `run_id`, `approval_id`, `event_type`, `action_kind`, `risk`, `decision`, `outcome`, `rule_id`, `error_code`, `duration_ms`, `metadata_json`, `created_at` | append-only Application API；`metadata_json` 使用版本化 allowlist Schema，不含参数值与绝对路径 |

Migration 状态：

1. `0025_conversation_workspace_grants.sql`：已落地工作目录绑定、状态与索引；
2. `0026_automation_scheduler.sql` 与 `0027_automation_daily_time_window.sql`：已由 Phase 10 使用，禁止为审批功能复用或重新编号；
3. `0028_action_approval_requests.sql`：已落地一次性审批、防重放和恢复失效；
4. `0029_security_audit_events.sql`：已落地 append-only 审计事实与查询索引；保留清理任务待实现。
5. `0030_workspace_grant_kind.sql`：区分默认受管 Workspace 与外部目录；
6. `0031_workspace_directory_authorizations.sql`：保存账号级外部目录授权。
7. `0032_conversation_pinning.sql`：保存任务置顶状态并建立置顶优先、最近活动次序的列表索引。
8. `0033_workspace_auto_approve_mode.sql`：把旧低风险自动模式迁移为明确的完整自动批准模式。
9. `0034_workspace_approval_mode_preferences.sql`：按登录账号保存最近审批模式；单账号升级时继承最近会话选择。
10. `0035_conversation_context_compactions.sql`：保存版本化模型 Surface 检查点、覆盖边界、状态和估算 token；不删除原始消息。

`root_ref` 首版不是 SecretStore 凭据，但仍属于本机敏感数据，普通日志、模型 Prompt 和 append-only 审计事件不得包含绝对路径。设置页通过专用、当前账号范围的授权 DTO 展示真实目录，便于用户识别和撤销；它不是通用文件 IPC。审计元数据仅允许动作名称、授权目录显示名、相对目标、文件数量、字节数、argv 数量和域名策略结果等明确字段。

Phase 9D 的修改/删除恢复副本保存在 `userData/system/workspace-recovery/<recoveryId>/`，内容文件与只含相对路径、checksum、时间的元数据均使用仅当前用户可读写权限。

待审批记录只用于状态恢复与审计，不是延迟执行队列。应用启动、用户登出、会话删除、workspace 移除或策略版本变化时，所有相关 `pending` 原子更新为 `expired/cancelled`。动作批准不可复用；只有外部目录普通文件读写边界通过独立授权表按账号持久化。
