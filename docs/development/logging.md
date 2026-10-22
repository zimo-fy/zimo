# 日志与可观测性

## 目标

日志用于定位应用生命周期、模型调用、路由和存储故障，不用于保存用户内容。生产默认 `info`，开发默认 `debug`；`trace` 必须显式短期开启。

## 事件结构

```ts
interface LogRecord {
  timestamp: string;
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  category: LogCategory;
  event: string;
  message: string;
  context?: {
    traceId?: string;
    conversationId?: string;
    runId?: string;
    workflowId?: string;
    agentId?: string;
    userId?: string;
    providerId?: string;
    durationMs?: number;
    errorCode?: string;
    outcome?: "success" | "failure" | "cancelled" | "fallback";
  };
}
```

分类固定为：`app`、`electron`、`auth`、`conversation`、`model`、`agent`、`workflow`、`tool`、`mcp`、`plugin`、`connector`、`knowledge`、`automation`、`intent-router`、`storage`、`security`、`audit`。

`event` 使用稳定点分名，如 `conversation.run.completed`，便于查询；`message` 是短描述，不拼入输入 payload。

## 级别

- trace：局部诊断步骤，不含正文；
- debug：开发态状态转换和 adapter 元数据；
- info：启动、登录结果、运行完成、配置变更；
- warn：已安全降级、可恢复问题、拒绝的非恶意输入；
- error：当前操作失败但进程可继续；
- fatal：无法安全启动/迁移/保持一致性。

Router 记录 `durationMs`、`confidence`、`intent`、`targetId`、`didFallback`、`fallbackReason` 和输入长度/单向 fingerprint，绝不记录输入全文。

Automation 只记录 `automationId`、`automationRunId`、关联的 conversation run ID、触发类型、状态、安全错误码和耗时。不得记录任务指令、模型输出、Tool 参数值、时间范围之外的账号资料或外部响应正文；调度器空轮询不写普通日志。

登录托管模型配置成功只记录 `model.provider.managed`、固定 Provider ID 和结果；失败沿用安全错误码。事件不得记录 `modelApiKey`、Key hint、Provider URL 或登录响应正文。

### 模型请求诊断

每次会话生成在真正调用 Model Gateway 前记录 `model.request.prepared`。该事件用于确认运行时最终选择了哪个模型、Agent、Skill 和知识库，但不是请求正文转储：

- 会话请求记录 `conversationId/runId`，Workflow Agent 请求记录 `workflowId/runId/nodeId`；两者都记录 `providerId`、`modelId` 和 `agentId`；
- 对实际编译进请求的 Skill 记录 `skillId`、`packageId`、`version` 和指令字符数；
- 记录实际知识库 ID、知识上下文字符数，以及各消息的顺序、角色和字符数；
- 固定记录 `requestContentLogged: false`，禁止记录消息正文、Agent System Prompt、Skill 指令、检索片段、API Key 或完整请求 URL。
- `purpose` 区分正常回答 `conversation_response` 与首轮任务标题 `task_title`；标题生成结果另记 `conversation.title.generated`，仍不记录标题正文。

因此，可以通过 `skills` 数组确认所选 Agent Skill 与会话直接 Skill 是否解析并进入最终请求；选择 Workflow 的会话会把内部 Agent 节点诊断写入同一日志。普通摘要日志不能恢复具体指令；应用启动时把 Electron 日志目录设置为 `userData/system/logs`，文件位于 `app.getPath("logs")/zimo.log`。

模型供应商请求失败时记录 `model.provider.request.failed`。该事件只包含固定请求阶段（连接测试、流式生成、意图分类、Tool 首轮或 Tool 后续轮）、耗时、受白名单限制的错误名称/错误码、最多三层 cause 的安全名称/代码、固定枚举的传输原因和可用的 HTTP 状态码。Tool 请求失败时还记录消息数、工具数、消息文本字符数、其中 Tool 结果字符数和工具描述/Schema 字符数；这些只是应用层规模统计，不等同于最终 HTTP 字节数。不得记录原始异常 message/cause/stack、模型请求正文、响应正文、Provider URL、模型 API Key 或 Tool 输入输出。该诊断事件用于与相邻的 `conversation.run.failed`、`workflow.run.failed` 和 `model.request.prepared` 按时间关联；诊断回调失败不得覆盖原始模型错误。

### 敏感开发诊断

本地开发脚本默认开启独立 payload capture，用于检查最终 Prompt：

```bash
pnpm run dev
```

根目录和 `apps/desktop` 的 `dev` 脚本都会注入 `ZIMO_LOG_LLM_PAYLOADS=1`。该开关还要求存在开发服务器 `ELECTRON_RENDERER_URL`，因此打包应用和普通启动不会生效。成功开启后，普通 `zimo.log` 会出现不含正文的 `model.payload_capture.enabled` 警告；完整的应用层模型请求单独写入 `app.getPath("logs")/llm-payloads.jsonl`，当前即 `userData/system/logs/llm-payloads.jsonl`。升级后的旧日志仍保留在操作系统原日志目录，不自动合并或删除。

每条 `model.request.full_payload` 包含最终 model、temperature、stream 和完整 messages，因此会包含用户消息或 Workflow 输入、Agent System Prompt、Skill 指令及知识上下文。记录通过 `conversationId` 或 `workflowId + nodeId` 区分来源；会话记录还可用 `purpose` 区分正常回答和任务标题请求。

模型进入 Tool Calling 时，每一轮另写一条 `purpose=conversation_tool_round` 或 `purpose=workflow_tool_round` 的记录。`request.tools` 是该轮实际通过 LangChain `bindTools()` 暴露给模型的名称、描述和输入 Schema，`response.toolCalls` 是模型返回的调用 ID、工具名和参数；`round` 从 1 开始。第二轮及后续 `request.messages` 还会包含前一轮 assistant tool call 与 Tool 输出，因此该文件也可能包含 Tool 参数值和输出。它始终不包含 API Key、Authorization Header、SecretStore 值、MCP credential 或 Provider URL。

`purpose=conversation_response` 不复制 Tool Schema；诊断某个会话能力是否实际暴露时，应按同一 `conversationId + runId` 查找 `conversation_tool_round.request.tools`。浏览器内建 Tool 使用稳定的 `browser_tabs`、`browser_focus`、`browser_snapshot`、`browser_screenshot`、`browser_navigate`、`browser_click`、`browser_type`、`browser_press`、`browser_scroll`、`browser_wait` 名称；现由登录账号下的运行链路默认提供，不再依赖会话开关。Workflow 查看对应的 `workflow_tool_round`。

该内容是进入 Model Gateway 的完整应用层请求及模型返回的结构化 Tool Call，不是 SDK 最终生成的 HTTP wire dump；LangChain/OpenAI SDK 仍可能增加协议字段。

敏感日志文件权限固定为当前用户可读写（`0600`），单文件 10MB、最多保留 2 个滚动文件。开发完成后应删除该文件；不得上传、提交 Git 或作为普通问题附件分享。如需临时关闭，可在仓库根目录执行 `ZIMO_LOG_LLM_PAYLOADS=0 pnpm --filter @zimo/desktop exec electron-vite dev`，绕过默认开发脚本。

## 脱敏

Logger 入口执行递归、大小受限的 allowlist/denylist 脱敏：键名匹配 `apiKey|token|secret|password|authorization|cookie|credential` 一律替换 `[REDACTED]`；URL 去掉 userinfo、query 和 fragment；Error 只取受控 name/code/message，生产不落 stack。Header 默认全拒，仅可记录明确安全的 content-type/status。

普通日志默认禁止：用户消息/模型回答、system prompt、Skill 指令、知识检索正文、文件正文、API Key/Token、完整认证头、SecretStore 值、SQL 参数、剪贴板、个人数据库绝对路径。对象深度、数组数量、单字段长度和总记录大小均设上限。上述开发态敏感 payload capture 是独立、显式开启且不经过普通 Logger 的唯一例外。

MCP Streamable HTTP 在 `connect`、`tools_list` 或 `tools_call` 阶段发生传输异常时记录 `mcp.transport.request.failed`。事件只允许包含可信 Server ID、固定阶段、Tool 名称、耗时、受限错误类型/错误码和 HTTP 状态码；不得记录异常 message/stack/cause、endpoint、query、Header、凭据、Tool 参数、HTTP status text 或响应正文。用户取消不记为传输失败，诊断失败不得覆盖原始 MCP 错误。

浏览器 CDP 命令失败记录 `browser.cdp.command.failed`。事件只允许包含格式受限的 CDP 方法名、`timeout/connection_closed/connection_failed/connection_unavailable/protocol_error` 固定原因、耗时与固定错误码；不得记录原始异常 message/stack、URL、CDP 参数、页面快照、截图或用户输入。取消不记为失败；诊断回调失败不替代原始浏览器错误。

日志脱敏失败时丢弃附加字段，只写固定安全事件；不能因日志失败影响主用例。

## Trace 传播

Renderer 为用户动作生成 `requestId`，Main 接收后生成可信 `traceId`；一次模型生成再生成 `runId`。Application 通过显式 context 传递，不使用 Renderer 提供的 user/provider 身份作为可信值。

## 输出与保留

- 开发：结构化 pretty console + 文件；生产：JSON lines 文件，Renderer console 最小化；
- 日志目录由 Electron `userData` 下专用子目录决定，设置页仅展示概念位置；
- 单文件建议 10MB、最多 5 个滚动文件、保留 14 天，启动和每日维护时清理；
- 文件权限采用平台允许的最小权限；日志写入失败降级到安全 console 并节流告警；
- crash report 在 V0.1 不自动上传；未来启用前需单独隐私评审和用户同意。

## 审计事件

`audit` 记录登录/退出、provider 创建/修改/删除、默认模型变化、原型安装/启用状态变化、数据删除确认和受控 Tool 调用。Tool 审计只记录 run/workflow/node/tool/tool-call ID、权限 ID、参数键名、是否确认、耗时、结果和错误码；不记录参数值、查询正文、Tool 输出或凭据。

`web_search` / `web_fetch` 沿用受控 Tool 审计，只允许记录 Tool ID、参数键名、耗时、终态和固定错误码。查询词、完整 URL、网页正文、搜索结果、Provider 响应和搜索 API Key 均不得进入普通日志；仅开发者显式开启的敏感 LLM payload 文件会包含模型实际 Tool 参数与回传消息。

MCP Server 连接、刷新和解绑分别记录 `mcp.server.connected`、`mcp.server.snapshot.refreshed` 与 `mcp.server.disconnected`。事件只包含可信 Server ID、耗时、结果和工具数量，不记录 credential、Authorization Header、远端响应正文或工具 Schema。模型触发的调用继续记录 `tool.execution.completed`，只含工具 ID、参数键名、确认状态、耗时和结果。

MCP Tool 返回体被安全归一化拒绝时记录 `mcp.tool.response.rejected`。该事件只允许包含可信 Server/Tool ID、固定枚举原因、`structured_content/content` 来源、内容块数量与类型、观测到的总字符数/值类型和对应限制；不得记录字段名、字段值、响应正文、订单/业务数据、凭据或完整 URL。Tool 结果不再单独限制嵌套深度或数组/对象项目数量，只限制 JSON 序列化结果最多 90000 字符；非文本内容块和无法表示为 JSON 的值仍按协议拒绝。日志失败不得改变 Tool 调用结果。

MCP `tools/list` 在发现归一化阶段被拒绝时记录 `mcp.discovery.response.rejected`。该事件只包含可信 Server ID、固定原因 `too_many_tools/invalid_tool_name/schema_invalid/schema_too_large/catalog_too_large`、工具序号、观测长度或数量及对应上限；不得记录工具名称、描述、Schema、远端响应、endpoint query 或凭据。诊断回调失败不得改变原始连接结果。

Skill Store 安装和卸载分别记录 `skill.install.marketplace` 与 `skill.uninstall`。事件只含 Skill/Package ID 和结果；本地目录路径、`SKILL.md` 和包内容不得进入普通日志。

Agent 人才库安装和卸载分别记录 `agent.install.marketplace` 与 `agent.uninstall`。事件只含 catalog/local Agent ID 和结果；本地目录路径和角色正文不得进入普通日志。

脚本型 Skill 复用 `tool.execution.completed`：`toolId` 以 `skill.<skillId>.run_script` 开头，权限为 `skill:script:execute` 与 `skill:data:read-write`。日志只记录参数键名 `script/arguments`，不得记录脚本路径选择、参数值、stdout/stderr、工作数据或子进程环境。

Creator 直接安装同样只使用 `tool.execution.completed`：`toolId` 以 `skill.<skillId>.install_created_skill` 结尾，权限为 `skill:local-install`。日志只记录参数键名 `directoryName`、可信 Tool/运行 ID、耗时、确认和结果，不记录目录名值、绝对路径、Skill 文件正文或生成包内容。

统一身份认证记录 `auth.login.succeeded`、`auth.login.failed` 与 `auth.logout.succeeded`。失败事件只含安全错误码和结果，不记录员工账号/手机号、密码、Token、Authorization Header 或远端响应正文。

### Phase 9 工作目录与审批审计

Phase 9F 已使用 SQLite `security_audit_events` 作为审计中心的权威来源，普通结构化日志只写同一事实的脱敏运行摘要。审计事件可记录可信 ID、参数键名数量、固定 action kind/risk/rule/decision、结果和错误码，以及文件动作的有界动作名称、授权目录显示名和相对目标；不记录绝对路径、checksum、recovery ID、文件正文、查找/替换文本或结果内容。副作用 Tool 在 `tool_execution_started` 无法持久化时失败关闭；完成记录失败时仍保留开始事实供诊断。

后续事件：

- `workspace.grant.invalidated`；
- `action.policy.decided`；
- `approval.requested/resolved/expired`；
- `sandbox.execution.started/completed/failed/cancelled`；
- `sandbox.boundary.denied`。

每条事件只允许：可信 event/run/conversation/workspace/approval/tool-call ID，固定 action kind、risk、policy rule/version、decision、outcome、duration、数量/字节数、安全错误码，以及有界目录显示名和相对目标。绝对路径不进入审计事件；设置页的已放行目录清单直接读取当前账号授权表，不从审计日志恢复路径。

禁止记录：文件正文或 diff、用户/模型消息、完整 argv/命令字符串、Tool 参数值、stdout/stderr、环境变量、目录树、绝对路径、网络请求/响应正文、Header、Cookie、Token、API Key 和审批对话正文。

审批拒绝和安全拦截是预期结果，普通单次事件使用 `info/warn`，仅沙箱初始化失败、审计持久化失败或边界异常使用 `error`。任何将执行副作用的动作在审计权威存储不可用时必须 fail closed。只读目录调用沿用受控 Tool 普通审计；审计中心保留周期和用户清理流程仍待确定，不允许 Renderer 删除或改写单条记录。

## 验证

自动测试向各层注入带嵌套秘密、header、URL query、Error cause 和循环引用的对象，扫描 console/file/serialized error/SQLite，确保秘密 marker 不出现。发布前以测试 API Key canary 执行整条模型配置和失败链路。
