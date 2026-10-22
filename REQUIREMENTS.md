# Zimo AI Agent 桌面应用需求文档

> 文档状态：V0.1 基线，V0.2 增量实施中
> 当前目标版本：Zimo V0.2
> 更新日期：2026-09-15
> 项目目录：以当前仓库根目录为准

## 1. 文档目的

本文档定义 Zimo 的产品范围、模块边界、技术约束、实施顺序和验收标准，作为后续设计、开发、测试及跨 AI 开发工具交接的统一依据。第 5 节保留 V0.1 基线；V0.2 已批准增量以 `IMPLEMENTATION_PLAN.md` 和 `PROGRESS.md` 为准。

开发过程中必须遵守以下原则：

1. 严格按照阶段实施，不得未经确认同时铺开全部功能。
2. 每个阶段完成后必须运行对应测试、更新进度文档并记录遗留问题。
3. 产品领域模型不得直接绑定某一个模型厂商、Agent 框架或存储实现。
4. 当前版本优先验证桌面端产品形态、登录账号托管模型的对话体验和意图路由交互。
5. 未列入当前阶段的功能可以设计接口和 UI，但不得伪装成已经可用的真实能力。

开发服务器模式允许开发者临时修改登录托管模型的模型标识、API 地址，并可选替换模型 API Key 进行兼容性测试。该入口不得进入打包环境；当前 Key 不回显，留空继续使用登录账号安全下发的 SecretStore 凭据。

V0.2 发布加固要求 Electron 生产构建将 Main 进程业务 bundle 使用与目标 Electron 版本、操作系统和架构一致的 Bytenode V8 字节码替代源码。字节码失败、残留 Main 源 bundle 或跨平台构建必须阻止打包；不得为保护 Preload 而关闭 Renderer sandbox。Renderer、sandboxed Preload、字符串常量和运行时内存不在该保护范围，凭据仍必须使用服务端边界与 SecretStore，不能把字节码描述为不可破解的加密。

V0.2 Phase 7.5 曾接入桌面自动更新。2026-10-19 起客户端不再检查、下载或安装；应用菜单「检查更新…」直接提示已是最新版本。仓库内不再保留远程更新 URL 或 `electron-updater` 打包配置；恢复自动更新前须新 ADR、发布通道与 macOS/Windows 代码签名和跨版本升级验证。

V0.2 Phase 10 增量增加受控联网搜索与公开网页读取：模型通过稳定 `web_search` / `web_fetch` Tool 自主决定是否联网，搜索 Provider 与模型 Provider 解耦；网络只能由 Main 发起，搜索密钥进入 SecretStore，公开网页读取仅限 GET 并拒绝本机、私网、凭据 URL 和无限响应。网页正文属于不可信参考数据，不授予新的文件、命令或外部系统权限。

V0.2 Phase 11 增量增加独立 Profile 的本地浏览器自动化：普通前台会话默认启用、用户可关闭，模型可通过 Main 内 CDP Adapter 获取标签页、页面可访问性结构和截图，并执行导航、点击、普通文本输入、受限按键、有界滚动和最长五秒且返回新快照的等待。首版不附着默认浏览器 Profile，不开放任意 JavaScript、模型提供的 CSS selector、私网、本机地址、密码输入、Workflow 或 Automation。按当前产品决策浏览器动作不进入审批，但仍经过严格 Tool Schema、超时取消和审计。

2026-10-12 增量决策：浏览器改为登录账号下的内建运行能力，不再要求用户在会话中添加或关闭；普通会话、Agent/Skill 所在运行、Workflow Agent 节点和 Automation 专用会话均可按需使用。Automation 仍仅在应用存活期运行，模型须支持 Tool Calling；共享 Profile 的浏览器操作同一时刻只允许一个模型运行持有，冲突明确失败。旧会话字段暂保留以兼容已有数据库和 IPC，但不再决定浏览器 Tool 可用性。

2026-10-12 标签页创建增量：模型可在没有目标站点标签页时通过受控 `browser_open` 新建公开 HTTP(S) 标签页，取得真实目标 ID 再读取页面；`browser_tabs` 初次空结果短暂重试一次。新建标签页不自动判定用户未登录，须读取页面后再决定是否请求人工处理。

## 2. 产品概述

### 2.1 产品名称

Zimo。

### 2.2 产品定位

Zimo 是一个基于 Electron 的桌面 AI Agent 应用，面向需要通过自然语言完成对话、知识检索、Agent 协作和自动化任务的个人或团队用户。

产品长期能力包括：

- 登录账号托管模型的 AI 对话，后续可扩展多模型；
- Agent 创建和管理；
- Skill 创建、安装和管理；
- 知识库与检索增强生成；
- 可视化工作流；
- Plugin 扩展机制；
- MCP 服务接入；
- 微信、Telegram 等消息渠道接入；
- Automation Intent Router；
- 自动化触发、调度、执行和运行历史。

### 2.3 当前版本目标

Zimo V0.1 的核心目标是完成：

1. 安全、可扩展的 Electron 应用基础架构；
2. Zimo 统一身份认证（V0.2 增量已替换 Mock）；
3. 登录账号托管模型和流式 LLM 对话；
4. 会话创建、管理和本地持久化；
5. Automation Intent Router 的输入前置识别；
6. Agent、Skill、知识库、工作流、Plugin、MCP 和 Automation 的高质量 UI 原型；
7. 为后续真实能力预留稳定的数据接口和适配器边界。

### 2.4 当前版本非目标

Zimo V0.1 暂不实现：

- Codex App Server 集成；
- Agent 命令执行沙箱；
- Shell 命令执行；
- 任意文件写入、删除或脚本执行；
- Skill 的真实解析、安装和执行；
- 知识库文档解析、向量化和真实 RAG；
- 工作流真实运行；
- Plugin 动态加载和隔离运行；
- 微信、Telegram 真实连接；
- MCP Tool 真实调用；
- Automation 定时调度和后台执行（V0.1 非目标；V0.2 Phase 10 已批准本机应用存活期首版）；
- Intent Router 自动执行 Agent、Skill 或 Workflow；
- 多 Agent 调度；
- 团队权限与通用云端数据同步（统一身份认证已作为 V0.2 增量接入）。

## 3. 技术方向

### 3.1 基础技术选型

- 桌面容器：Electron；
- 前端：React、TypeScript；
- 样式：Tailwind CSS；
- 包管理：pnpm workspace；
- Agent 与模型抽象：LangChainJS；
- 状态化 Agent 和工作流运行时：LangGraphJS；
- 数据校验：Zod；
- 本地数据库：SQLite；
- 单元测试：Vitest；
- UI/E2E 测试：Playwright；
- 结构化日志：支持分级、分类和上下文字段的日志组件；
- IPC：Electron Preload 暴露的类型安全白名单 API。

具体依赖库须在架构阶段通过 ADR 文档确认，不得仅因示例代码方便而直接写入核心领域层。

### 3.2 架构约束

应用至少划分为以下层次：

```text
Electron Renderer
        ↓ 类型安全 IPC
Electron Preload
        ↓ 白名单能力
Electron Main
        ↓
Application Services
        ↓
Domain / Runtime Adapters / Repositories
        ↓
SQLite / LLM Providers / Future Integrations
```

必须遵守：

- Renderer 不得直接访问 Node.js、文件系统、数据库或系统密钥；
- `nodeIntegration` 必须关闭；
- `contextIsolation` 必须开启；
- Preload 只暴露显式、可校验的 IPC 方法；
- IPC 输入和输出必须经过 Schema 校验；
- 登录下发的 API Key 不得进入前端状态、普通日志或明文配置文件；开发服务器中由开发者主动输入的替换 Key 只能短暂存在于当前表单，保存后立即清空，不得进入全局状态或持久化存储；
- LangChainJS、LangGraphJS 和模型厂商对象不得直接成为产品数据库模型；
- UI 只能依赖 Application API 或 Repository 接口，不得直接依赖 Mock JSON。

### 3.3 预留接口

当前版本不实现安全执行器，但必须预留：

```ts
interface ToolExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}
```

当前版本可提供不包含本地高风险能力的 `DirectToolExecutor`。未来允许增加：

- `CodexToolExecutor`；
- `SandboxToolExecutor`；
- `RemoteToolExecutor`。

## 4. 产品核心概念

### 4.1 Agent

拥有模型、指令、工具、Skill、知识库、记忆和权限策略的执行主体。

V0.1 只实现 Agent 管理 UI 和 Mock Repository，不执行真实 Agent 编排。

### 4.2 Skill

由指令、模板、资源和可选脚本组成的能力包。

V0.1 只实现 Skill UI、Mock 数据和 Repository 接口。不得执行 Skill 中的脚本或安装依赖。

### 4.3 Tool

Agent 可以调用的单个结构化函数。V0.1 的真实对话默认不开放 Shell、任意文件操作等高风险 Tool。

### 4.4 MCP

用于连接外部 Tool、Resource 和 Prompt 的标准协议。

V0.1 只实现 MCP Server 管理页面和连接状态原型，不发起真实 Tool 调用。

### 4.5 Plugin

可安装的扩展包，未来可以包含 Skill、Tool、MCP 配置、Connector 和可选 UI 扩展。

V0.1 只实现 Plugin 管理页面和 Mock 状态。

### 4.6 Connector

微信、Telegram 等外部消息渠道的输入和输出适配器。Connector 可以由 Plugin 提供，但在领域模型中必须独立于普通 Plugin 能力。

### 4.7 Workflow

由节点、连接、条件和输入输出 Schema 构成的确定性或半确定性执行图。

V0.1 只实现工作流列表、详情和画布交互原型，不执行工作流。

### 4.8 Automation

由 Trigger、Intent Router、Execution 和运行记录组成的自动化能力。

V0.1 只实现 Intent Router 前置识别和 Automation 页面原型，不实现调度与自动执行。

### 4.9 Knowledge Base

用户导入并管理的文档知识集合。知识库必须与 Agent Memory、会话消息和 Workflow State 分离。

V0.1 只实现知识库列表、详情、文档列表和导入交互原型。

## 5. Zimo V0.1 功能需求

### 5.1 登录（V0.1 Mock 基线，V0.2 已替换）

### 功能

- 提供登录页面；
- 支持输入员工账号 ID/注册手机号与密码；
- 登录后进入主应用；
- 支持退出登录；
- Token 通过系统安全存储保存，SQLite 只保存非敏感会话和 secret ref；
- 重启应用后通过远端 Token 校验恢复登录状态。

### 技术约束

必须通过 `AuthProvider` 接口实现：

```ts
interface AuthProvider {
  login(input: LoginInput): Promise<{ session: AuthSession; modelApiKey: string }>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession>;
}
```

V0.1 最初使用 `MockAuthProvider`；V0.2 已替换为 xclaw 协议兼容的 HTTPS `ZimoAuthProvider`。登录成功响应必须包含 `modelApiKey`；该字段仅在 Main 内存链路中流转并立即进入 SecretStore，不返回 Renderer。密码、Token 和 `modelApiKey` 不得进入 Renderer 持久状态、SQLite 或普通日志。

### 5.2 登录账号托管模型

### 功能

- 登录成功后使用响应中的 `modelApiKey` 更新已保存托管模型的密钥，不要求用户填写密钥；
- 模型标识、显示名称和 API 地址只读取系统中已保存的模型配置，不在代码中写死；
- 已保存的托管模型在登录后自动设为默认模型；没有完整配置时提示「请先配置模型再使用」并打开模型配置，可设置是否支持图像模式；
- 支持 OpenAI-compatible Chat Completions API；
- 显示模型连接测试结果；
- 设置页只读展示模型与地址，不提供增加、编辑、删除入口；
- 退出登录时移除当前登录账号对应的模型凭据。

### 能力模型

模型适配器应声明能力，不得假设所有模型能力相同：

```ts
interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  vision: boolean;
  reasoning: boolean;
  promptCaching: boolean;
  maxContextTokens?: number;
}
```

### 安全要求

- 登录响应中的 `modelApiKey` 不得发送到 Renderer；
- API Key 不得写入日志；
- 优先使用操作系统安全存储；
- 如果 V0.1 暂时无法完成安全存储，必须以明确的技术债记录，不得默认明文存储。

### 5.3 流式 LLM 对话

### 功能

- 创建新会话；
- 发送文本消息；
- 流式显示模型输出；
- 停止生成；
- 重新生成最后一次回答；
- 展示 Markdown、代码块和基础表格；
- 展示加载、完成、取消和失败状态；思考中且尚无回复正文、附件或资料引用时不显示空气泡，出现回复内容后再显示；
- 已完成、已停止或失败的助手回复展示本轮合计 token 消耗、该条回复生成时的模型显示名和完成/停止时刻；合计包含主回复/Tool 轮、Router 分类和首轮标题，提供商未返回时省略，不伪造 0；切换输入区当前模型不得改写历史回复上的模型名；用户停止后主回复立刻停字，但会继续读取当前模型流直到 usage 到达或短超时，以便计入已发出请求的消耗；
- 助手回复在气泡上方展示本轮墙钟思考耗时；进行中展开工具步骤，完成、停止或失败后默认折叠，可点击耗时标题展开；不展示深度思考正文、工具原始输出或绝对路径；停止或失败也保留已产生的步骤；
- 会话重命名和删除；
- 保存并恢复会话历史；
- 登录托管模型的最大上下文按 1,200,000 tokens 配置；预计请求达到 80% 时生成检查点摘要，达到 90% 时压缩失败必须停止本轮请求；预算包含 System Prompt、能力指令、工具 Schema、资料上下文、历史和输出预留；
- 上下文压缩不得删除或改写完整消息历史；模型只接收最新有效摘要和摘要后的原始消息，重复压缩合并上一份摘要与后续进展；会话中展示压缩开始、完成、失败、估算 token 和可展开摘要；
- 最新已完成的 AI 回复提供复制与手动压缩当前会话操作；手动压缩不新增消息，不满足压缩边界时提示用户，支持取消；
- 设置页支持当前账号手动维护偏好、目标和未解决问题；启用的有界记忆从新会话首次模型请求起加入上下文，删除或停用后后续请求不再发送；普通会话在既有模型 Tool Calling 请求中暴露结构化记忆保存能力，由模型决定是否调用并写入当前账号，压缩摘要不再触发生产记忆写入；首版暂不进行语义价值和原文出处校验；
- 将会话作为全局“任务”展示，支持从任意页面创建、打开、重命名、置顶/取消置顶和删除；置顶任务优先，其余任务按最近活动时间排序；
- 新建任务先进入不展示在任务列表中的空白草稿，第一条指令发送成功后自动转为当前任务；
- 第一轮回答成功后由当前模型生成简短任务标题，失败时保留默认标题且不影响主回答；
- 在会话中直接选择并持久化 Agent、已安装 instruction Skill、知识库、Workflow 和已连接的 MCP Server；
- 已选择能力在输入框下方以紧凑标签展示，hover 或键盘聚焦时可直接解除对应绑定；默认 Zimo Workspace 仍生效但不占用标签区域；
- 会话直接 Skill 与 Agent Skill 去重合并；选择 Workflow 后将运行结果写回会话，选择 MCP Server 后仅将其当前工具快照暴露给模型，由模型按指令选择具体 Tool；
- MCP 管理提供受信 HTTPS 服务目录：企查查、腾讯会议、GitHub、Sentry、Hugging Face、Context7、Microsoft Learn，以及腾讯文档、高德地图、千图 AI、EdgeOne Pages、有活招工、盈米基金、滴滴出行、今日投资、麦当劳中国和 UAPI；Renderer 只能选择目录项并完成对应的 OAuth、Bearer、固定 API Key、Query Key 或免认证连接，不能覆盖 endpoint、认证放置方式或 Header；
- 所有 MCP Server 统一保存其 `tools/list` 返回的完整工具目录，不按厂商或工具名称过滤；选择 Server 即授权当前快照，模型可以在其中自主选择查询或写入工具；
- 展示当前模型；
- 模型错误时提供可理解的错误信息；
- Router 失败时不影响普通聊天。

### 统一流式事件

前端不得直接消费厂商 SDK 的原始事件。Application 层至少统一为：

```ts
type AgentStreamEvent =
  | { type: "message.started"; messageId: string }
  | { type: "message.delta"; messageId: string; text: string }
  | { type: "message.completed"; messageId: string }
  | { type: "route.completed"; route: IntentRoute }
  | { type: "usage.updated"; usage: TokenUsage; messageId?: string }
  | { type: "context.compaction.started"; compaction: ContextCompactionView }
  | { type: "context.compaction.completed"; compaction: ContextCompactionView }
  | { type: "context.compaction.failed"; compactionId: string; errorCode: string }
  | { type: "run.cancelled" }
  | { type: "run.completed" }
  | { type: "run.failed"; error: SerializedAppError };
```

### 5.4 Automation Intent Router V0

### 目标

用户发送消息后，在进入默认聊天链路前，对输入做一次低延迟结构化识别，判断其更接近普通对话、Agent、Skill 或 Workflow。

### 当前执行边界

- 只识别，不自动执行；
- 可以在 UI 中展示识别结果；
- 用户可以选择继续普通对话；
- 未实现的目标显示“功能将在后续版本开放”；
- Router 不能阻塞基本聊天能力。

### 输出结构

```ts
interface IntentRoute {
  intent: "chat" | "agent" | "skill" | "workflow" | "unknown";
  targetId?: string;
  confidence: number;
  parameters: Record<string, unknown>;
  reason?: string;
  shouldExecute: false;
}
```

### 候选实体

```ts
interface RouteTarget {
  id: string;
  type: "agent" | "skill" | "workflow";
  name: string;
  description: string;
  enabled: boolean;
  parameterSchema?: Record<string, unknown>;
}
```

### 路由流程

```text
用户输入
  ↓
规则快速匹配
  ↓ 无明确结果
LLM 结构化分类
  ↓
Schema 校验
  ↓
置信度判断
  ↓
展示结果或回退普通聊天
```

### 降级规则

以下情况必须回退为 `chat`：

- Router 超时；
- 模型调用失败；
- 输出不符合 Schema；
- `confidence < 0.7`；
- `targetId` 不存在或目标已禁用。

Router 默认超时目标为 800ms，后续根据实际模型和本地测试调整。超时只停止等待并降级继续聊天，不 abort 已发出的分类请求；用户取消不转换成普通 fallback，同样不 abort 已发出的分类。路由结果必须记录耗时、置信度和是否回退，但不得记录敏感输入全文。

### 5.5 Agent UI 原型

包括：

- Agent 列表；
- 搜索和筛选；
- 新建、编辑、复制和删除交互；
- Agent 名称、描述、图标和状态；
- 新建/编辑不要求填写标签，分类从当前 Agent 目录分类中选择；
- 模型选择；
- System Prompt 编辑器；
- Skill、知识库和 Tool 绑定区域；
- Memory 和权限策略占位配置；
- 草稿、启用、禁用状态；
- Mock Repository。

### 5.6 Skill UI 原型

包括：

- Skill 列表和卡片；
- 分类、搜索和筛选；
- Skill 详情；
- 新建和编辑表单；
- 安装、启用、禁用交互效果；
- 版本和来源展示；
- 权限声明展示；
- 关联 Agent 展示；
- Mock Repository。

V0.1 不解析 `SKILL.md`，不执行脚本，不安装依赖。

V0.2 Skill Store 按分类展示可安装 Skill。目录列表不得请求 `/ai/skill/zimolist`，改为读取应用内 `resources/skills` 的直接子目录。Skill 只呈现已安装/未安装两态；安装后可绑定到会话、Agent/Workflow，卸载时自动清理会话和 Agent 绑定，并禁用仍引用该 Skill 节点的 Workflow。当前 Skill 通过 Store 或本地包安装，本地包只强制包含非空 `SKILL.md`，`manifest.json` 可选且不得成为执行声明来源；不提供创建不可执行空定义的表单。后续作者表单不要求输入标签，分类必须沿用当前 Skill 目录分类。

Agent、Skill、知识库、Workflow 和 MCP Server 删除时不因正在被使用而拒绝操作；持久化层必须在同一事务中移除活动引用。引用被删节点能力的 Workflow 保留定义但自动禁用，历史 AgentRun 保留原能力 ID 作为审计快照。

V0.2 Phase 7.2 增加受审核 Skill 脚本运行时：安装完整包到应用数据目录，允许绑定后的 `.py/.js/.mjs/.cjs` 以受控 Tool 执行。不得暴露通用 Shell、任意命令或包外脚本；脚本选择和参数须校验，并支持超时、取消、输出上限及脱敏审计。上架审核是当前代码信任边界，第三方自动发布前必须补充签名和审核证明。

V0.2 Phase 7.3 增加个人微信文本指令基础链路：渠道绑定按登录账号隔离；Main 在应用存活且账号已登录时运行可取消的 `getupdates` 长轮询，持久化游标并按稳定消息标识去重；合法文本进入该账号专用的“微信助手”普通会话，使用该条入站消息自己的 `context_token` 即时回复。首版不从微信远程授予或切换 Agent、Skill、Workflow、MCP 权限，不执行 Router 建议，也不接收图片、文件或群聊消息。通信渠道页必须展示真实运行状态，并仅在已有有效入站上下文时允许发送测试消息。

### 5.7 知识库 UI 原型

包括：

- 知识库列表；
- 新建、编辑和删除交互；
- 知识库详情；
- 文档列表；
- 文件拖拽和导入交互效果；
- 文档处理状态 Mock；
- 检索测试页面原型；
- 关联 Agent 展示。

V0.1 不解析文件、不生成 Embedding、不进行真实检索。

### 5.8 工作流 UI 原型

包括：

- 工作流列表；
- 新建、编辑、复制和删除交互；
- 基础画布；
- 节点拖拽；
- 节点连接；
- 节点配置面板；
- 开始、Agent、Skill、知识库、条件、人工确认和结束节点的视觉原型；
- 保存 Mock WorkflowDefinition；
- 运行和调试按钮显示为预览或未开放状态。

V0.1 不编译为 LangGraph，不执行工作流。

### 5.9 Plugin UI 原型

包括：

- 已安装和可发现 Plugin 页面；
- Plugin 详情；
- 安装、卸载、启用和禁用交互；
- 版本、作者、来源和权限展示；
- 更新可用状态；
- 微信和 Telegram Connector 示例卡片；
- Mock Repository。

V0.1 不下载、不加载、不运行第三方代码。

### 5.10 MCP UI 原型

包括：

- MCP Server 列表；
- 新建和编辑配置；
- stdio、HTTP 等类型的 UI 选项；
- 连接状态 Mock；
- Tool、Resource 和 Prompt 列表原型；
- 启用、禁用和删除交互；
- 敏感配置遮罩显示。

V0.1 不启动 MCP Server，不调用 MCP Tool。

### 5.11 Automation UI 原型

包括：

- Automation 列表；
- Trigger 类型展示；
- Intent Router 配置入口；
- Agent、Skill、Workflow 目标选择；
- 启用、禁用和运行历史原型；
- 手动、定时、Webhook、消息和文件变化 Trigger 的视觉占位。

V0.1 不执行调度、Webhook 或后台任务。

### 5.12 Automation 本地调度（V0.2 Phase 10）

- Automation 关联一个专用会话，并可选择模型、Agent、已安装 Skill、知识库、Workflow 和 MCP Tool；
- 支持单次定时、固定间隔、每天和每周计划，日/周时刻使用当前电脑本地时区；固定间隔从保存或重新启用时开始计时，不要求单独设置首次执行时间；
- 支持每天 `00:00`–`23:59` 内的开始/结束时间范围，开始晚于结束表示跨午夜，范围外不启动执行；
- 调度只在 Zimo 进程存活且当前账号已登录时运行，重启后到期任务最多补跑一次，不补跑全部历史周期；
- 同一任务禁止重叠执行，启动、完成、失败、取消和异常中断均持久化运行状态；
- 任务按登录账号隔离，模型输出进入专用会话，普通日志不得记录执行指令或模型正文；
- 首版不安装系统服务、不在应用完全退出后唤醒、不提供 Webhook/文件变化 Trigger、重试策略或 Router 自动创建/执行。

### 5.13 设置

包括：

- 个人信息 Mock；
- 模型提供商；
- 默认模型；
- 外观设置；
- 日志级别；
- 数据存储位置展示；
- 关于 Zimo；
- 当前版本与构建信息。

### 5.14 会话文档工作区（V0.2 Phase 8A–8E 已实现首版）

后续 Phase 8 在会话中增加文档附件：导入覆盖与知识库相同的可解析文档/文本格式，创建、有限修改与转换仍限于 DOCX、XLSX、PPTX 和 PDF：

- “+”菜单以灰色次级操作提供文件入口，优先级低于会话能力；用户也可把文件拖入聊天窗口；
- 附件属于当前消息/会话资产，不自动成为知识库或长期能力绑定；
- 原文件导入应用管理目录，修改创建新版本，只有用户确认“另存为”才写出工作区；
- 模型只使用按本轮格式和意图筛选的产品级文档 Tool，不接触绝对路径、二进制、第三方库 API 或任意脚本；
- 首版采用 JS-first，不依赖系统 Python、Office 或用户安装的 CLI；
- 支持矩阵必须区分结构化创建、模板/有限修改和高保真转换，不得把格式损失或文件改名标记为成功。

具体功能矩阵、交互、Token 策略、安全边界和分阶段计划见 [会话文档工作区与模型工具设计](docs/features/document-workspace-and-tools.md)。已开放受控导入（Office/PDF/Markdown/HTML/JSON/CSV/RTF/OpenDocument/EPUB）、结构/文本预览、渐进读取、四格式结构化创建、有限修改、语义重建转换和另存为；仍不开放任意二进制、可执行文件、通用压缩包、图片、任意路径写入、任意脚本、高保真 Office→PDF、PDF 正文重排或外部 PPTX 无损编辑。

### 5.14 会话编程工作目录与动作审批（V0.2 Phase 9E0）

Phase 9 已统一会话 Workspace、外部目录授权和动作审批。OS 沙箱仍暂缓；项目所有者已批准先开放实验性宿主机命令，并允许用户通过会话级“帮我批准”模式自动执行可执行动作，用于验证编程协助流程。

- 应用数据使用 `system/accounts/workspaces` 三类目录；每个会话自动拥有默认 Zimo Workspace，附件、生成文档和普通输出归入对应会话容器；
- 用户选择的外部目录允许读取和普通低风险写入；“请求审批”模式下高风险修改与删除仍审批；
- 未授权目录允许有界读取普通文本；首次写入必须审批，允许后按登录账号持久记录父目录授权并继续原运行；
- Renderer 只使用 opaque workspace ID；模型仅通过受控 Workspace Tool 使用文件、逐级创建目录和实验性命令能力；不存在通用文件或 Shell IPC；
- `patch/delete` 必须使用最近一次 `read` 返回的 SHA-256 checksum；目标变化、替换文本歧义或预算超限时失败关闭；
- 创建不覆盖已有文件，修改通过同目录临时文件原子替换，修改和删除前保存受管恢复副本；秘密、`.git`、依赖/构建目录、二进制、符号/硬链接和可执行文件不可写；
- 已提供“请求审批 / 帮我批准”策略模式和一次性审批卡片；最近选择按登录账号保存，新建任务和下次启动沿用，既有会话仍保留自己的模式；副作用 Tool 必须先生成受信 `PlannedAction` 并在执行前经策略判定；
- “帮我批准”会自动放行文件写入、删除和 `run_command` 等当前可执行动作；关键危险操作、路径边界违规和未注册能力仍直接拒绝；“请求审批”的动作批准只消费一次，目录读写授权可按账号持久化并撤销；
- `run_command` 在 Main 的可替换 Adapter 中启动固定平台 Shell，默认 120 秒、最大 360 秒，支持取消、进程树终止和有界输出；“请求审批”逐条确认，“帮我批准”自动执行；
- 会话存在用户添加的外部目录时，Shell 必须在该项目目录启动；隐藏的默认 Zimo Workspace 只作为附件/输出容器和没有外部目录时的回退，不能优先于用户选择；
- 当前命令不是 OS 沙箱，获批后拥有当前 OS 用户权限，cwd 不能限制目录或网络访问；生产安全目标仍是由已验收 Sandbox Worker 替换该 Adapter；
- 设置页已增加只读审计中心，记录策略判定、放行、拒绝和执行终态，不记录正文、命令输出、绝对路径或秘密；当前提供风险/结果筛选和最近 100 条视图，保留清理与更多筛选后续补齐。

当前已开放普通 UTF-8 文本文件的创建、精确修改和可恢复删除、账号级目录授权及实验性宿主机 Shell。文件 Tool 仍拒绝 `userData/system`、`userData/accounts`、生产安装目录、数据库、密钥、日志、审计和安装资源；宿主机 Shell 不具备同等强制边界。独立网络和外部应用 Tool 仍未开放；恢复副本暂无用户恢复 UI。完整设计见[会话工作目录、持久目录授权与逐动作审批](docs/features/conversation-workspace-sandbox-and-approvals.md)。

## 6. UI 与交互要求

### 6.1 设计风格

- 极简优雅，参考 Apple 和 Notion 的视觉语言；
- 浅色背景以 `neutral-50` 为基础；
- 主文本以 `neutral-800` 为基础；
- 使用克制的单色系点缀色；
- 避免大面积高饱和渐变；
- 避免沉重、粗糙和高对比边框。

### 6.2 布局

- 使用单列或双列响应式布局；
- 桌面端优先，但窗口缩小时必须保持可用；
- 页面区块间保留充足的 padding 和 gap；
- 主导航、内容区和详情/配置区层次清晰；
- 对话页应优先保障消息阅读和输入空间。

### 6.3 组件细节

- 卡片使用轻微圆角，建议 `rounded-lg`；
- Hover 可以使用 `hover:shadow-md transition`，但避免所有元素均浮起；
- 使用细微分隔和背景层级代替粗边框；
- 所有异步操作必须有加载、成功、空状态和失败状态；
- Mock 或未开放功能必须明确标识，不得给用户已经执行成功的错觉；
- 键盘焦点、对比度和表单标签必须满足基本可访问性要求。

### 6.4 产品图标

原始图标来源：

```text
/Users/vb/Downloads/icon.png
```

实施时必须将源文件复制到项目资源目录，例如：

```text
apps/desktop/resources/icon.png
```

项目代码和打包配置不得长期依赖 `/Users/vb/Downloads` 绝对路径。后续按平台生成 macOS、Windows 和 Linux 所需图标格式。

## 7. 数据与存储要求

V0.1 至少需要以下本地数据实体：

- UserSession；
- ModelProviderConfig；
- ModelDefinition；
- Conversation；
- Message；
- AgentDefinition；
- SkillDefinition；
- KnowledgeBaseDefinition；
- WorkflowDefinition；
- PluginDefinition；
- McpServerDefinition；
- AutomationDefinition；
- IntentRouteRecord；
- AppSetting。

要求：

- 数据库必须使用版本化迁移；
- 所有实体使用稳定 ID；
- 包含 `createdAt` 和 `updatedAt`；
- Mock Repository 和 SQLite Repository 遵循相同接口；
- 删除行为需明确软删除或硬删除策略；
- 会话删除前需要确认；
- 不在数据库中明文保存模型 API Key。

## 8. 日志与可观测性

### 8.1 日志级别

- trace；
- debug；
- info；
- warn；
- error；
- fatal。

### 8.2 日志分类

- app；
- electron；
- auth；
- conversation；
- model；
- agent；
- workflow；
- tool；
- mcp；
- plugin；
- connector；
- knowledge；
- automation；
- intent-router；
- storage；
- security；
- audit。

### 8.3 上下文字段

日志应按需携带：

- traceId；
- conversationId；
- runId；
- workflowId；
- agentId；
- userId；
- providerId；
- durationMs。

### 8.4 隐私要求

- 禁止记录 API Key、Token、密码和完整认证头；
- 默认不记录完整用户消息和模型回答；
- 默认不记录文件正文；
- 错误对象序列化前必须脱敏；
- 开发日志与生产日志使用不同配置；
- 日志文件需要滚动和保留周期设置。

## 9. 错误处理要求

- 定义统一 `AppError`；
- 区分用户错误、配置错误、网络错误、模型错误、存储错误和内部错误；
- 前端显示适合用户理解的信息；
- 日志保留可定位问题的内部错误码；
- 流式请求失败时保留已生成内容并允许重试；
- Router 错误只做降级，不得导致消息发送失败；
- Renderer 不展示内部堆栈和敏感路径。

## 10. 代码规范与工程要求

Phase 0 必须创建独立代码规范文档，至少覆盖：

- TypeScript 严格模式；
- 命名规范；
- 文件和目录规范；
- 模块依赖方向；
- React 组件和 Hooks 规范；
- IPC 定义规范；
- Zod Schema 规范；
- 错误处理规范；
- 异步和取消规范；
- 日志规范；
- 测试规范；
- 注释和文档规范；
- Git 提交建议；
- 禁止事项。

核心原则：

- 优先组合而不是深度继承；
- UI 不包含领域逻辑；
- 核心领域不依赖 Electron；
- 核心领域不依赖具体 LLM SDK；
- 所有外部系统通过 Adapter 接入；
- 所有持久化通过 Repository 接入；
- 禁止滥用 `any`；
- 禁止静默吞掉异常；
- 长时间任务必须支持 AbortSignal 或等价取消机制。

## 11. 测试要求

### 11.1 单元测试

至少覆盖：

- Intent Router 规则；
- Router 置信度和降级逻辑；
- Schema 校验；
- Model Adapter 事件转换；
- Repository；
- 会话状态更新；
- 错误映射；
- 日志脱敏。

### 11.2 集成测试

至少覆盖：

- Electron Main 与本地数据库；
- IPC 输入输出校验；
- OpenAI-compatible 流式接口；
- 消息中止；
- 会话恢复；
- Mock Repository 与 UI。

### 11.3 E2E 测试

至少覆盖：

- 真实登录、Token 校验、恢复与退出；
- 创建会话；
- 发送消息并接收流式输出；
- 停止生成；
- 重启应用后恢复会话；
- 切换模型；
- Router 结果展示；
- Router 失败后正常聊天；
- 主要页面导航。

### 11.4 安全测试

至少覆盖：

- Renderer 无法直接访问 Node；
- 非白名单 IPC 被拒绝；
- IPC 非法输入被拒绝；
- API Key 不出现在 Renderer 和日志中；
- 外部链接不会在 Electron 内以不安全方式直接打开；
- Mock 页面不能触发本地命令或任意文件操作。

## 12. 实施阶段

### Phase 0：架构和规范

只完成设计文档，不实现业务页面。

交付物：

- `docs/architecture/overview.md`；
- `docs/architecture/directory-structure.md`；
- `docs/architecture/domain-model.md`；
- `docs/architecture/ipc-contract.md`；
- `docs/architecture/stream-events.md`；
- `docs/architecture/data-model.md`；
- `docs/development/code-style.md`；
- `docs/development/testing.md`；
- `docs/development/logging.md`；
- `docs/development/error-handling.md`；
- `docs/security/threat-model.md`；
- `docs/adr/` 下的关键技术决策；
- `IMPLEMENTATION_PLAN.md`；
- `PROGRESS.md`。

验收后才进入 Phase 1。

### Phase 1：Electron 基础与设计系统

交付内容：

- Electron Main、Preload、Renderer；
- 安全 IPC 骨架；
- React 和 Tailwind；
- 主导航和响应式布局；
- 基础 UI 组件；
- 图标资源；
- 统一身份认证；
- 设置页面骨架；
- 日志、错误边界和测试骨架。

### Phase 2：真实模型对话

交付内容：

- Model Gateway；
- OpenAI-compatible Provider；
- 登录托管模型配置；
- 流式事件；
- 会话和消息持久化；
- 停止、重试、重命名和删除；
- Markdown 和代码块；
- 对应单元、集成和 E2E 测试。

### Phase 3：产品模块 UI 原型

交付内容：

- Agent UI；
- Skill UI；
- 知识库 UI；
- Workflow UI；
- Plugin UI；
- MCP UI；
- Automation UI；
- Mock Repository 和状态展示。

### Phase 4：Intent Router V0

交付内容：

- RouteTarget 目录；
- 规则路由；
- LLM 结构化路由；
- 参数抽取；
- Schema 校验；
- 置信度和超时降级；
- 路由结果 UI；
- 路由日志和基础评估用例；
- 不自动执行目标。

## 13. 阶段工作规则

每个阶段必须：

1. 开始前阅读本需求文档、`IMPLEMENTATION_PLAN.md` 和 `PROGRESS.md`；
2. 明确本阶段包含和不包含的范围；
3. 只修改本阶段需要的文件；
4. 为新增核心逻辑编写测试；
5. 运行类型检查、Lint、单元测试和适用的集成/E2E 测试；
6. 更新 `PROGRESS.md`，记录完成项、验证结果和遗留问题；
7. 如发生架构决策，新增或更新 ADR；
8. 阶段完成后停止，等待人工确认再继续。

## 14. Zimo V0.1 总体验收标准

满足以下条件才视为 V0.1 完成：

- 应用可以在目标开发环境正常启动和退出；
- 统一身份认证可用并能安全恢复登录状态；
- 至少一个 OpenAI-compatible 模型配置可以完成流式对话；
- 支持停止生成和失败重试；
- 会话与消息能够在应用重启后恢复；
- Router 在消息发送前完成识别或安全降级；
- Router 不会自动执行 Agent、Skill 或 Workflow；
- Agent、Skill、知识库、Workflow、Plugin、MCP、Automation 页面视觉和交互完整；
- 所有 Mock 和未开放功能有清晰标识；
- Renderer 不直接访问 Node.js 和敏感凭据；
- API Key 不出现在前端状态和日志中；
- 核心单元测试、集成测试和主要 E2E 测试通过；
- 项目架构、规范、实施状态和运行说明完整；
- 新的开发人员或 AI 工具可以仅通过仓库文档继续下一阶段工作。

## 15. 后续版本候选能力

以下内容不属于 V0.1，后续根据优先级单独立项：

- Agent 真实运行与 Agent Registry；
- Skill 文件格式、解析、安装、版本和权限；
- 知识库解析、Chunk、Embedding、混合检索、Rerank 和引用；
- Workflow DSL 和 LangGraph 编译执行；
- Human-in-the-loop 和工作流恢复；
- MCP 连接、Tool 调用和权限控制；
- Plugin SDK、签名、隔离和版本管理；
- 微信、Telegram Connector；
- Automation Trigger、Scheduler、Queue、Retry 和运行历史；
- Intent Router 自动执行和用户确认机制；
- Agent Tool 权限系统；
- 本地安全执行器或 Codex App Server 适配器；
- 多 Agent 调度；
- 团队、权限和通用云端同步。

## 16. 待确认事项

以下事项在对应实施阶段开始前确认，不阻塞 Phase 0：

1. 后续恢复多模型时的账号策略和迁移方案（当前固定 `deepseek-v4-flash`）；
2. 跨平台 safeStorage 的发布签名与恢复策略（当前实现已拒绝明文降级）；
3. SQLite ORM 或查询层选型；
4. 工作流画布组件选型；
5. UI 组件库是自建还是基于现有无样式组件；
6. 首批目标操作系统：macOS、Windows、Linux；
7. 是否在 V0.1 中加入深色主题；
8. Intent Router 使用的默认模型和成本/延迟目标；
9. Zimo 图标源文件的最终版权和发布授权状态。
