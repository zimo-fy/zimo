# Zimo V0.1 威胁模型

状态：Phase 0 初版；Phase 1 安全配置落地后复审。

## 资产与信任边界

高价值资产：登录密码与 Token、模型 API Key、用户会话与消息、会话文档原件/产物、本地配置/数据库、系统权限、模型调用额度、未来 Plugin/MCP 权限。

不可信输入：用户文本、模型输出/Markdown、OpenAI-compatible 响应、导入文件元数据、Provider/MCP URL、Mock manifest JSON、Renderer 发来的全部 IPC、外部链接。

信任边界：Renderer→Preload→Main、Main→模型服务、Main→SQLite/SecretStore、打包资源→运行时。Main 是权限边界而不是天然可信数据源；所有边界均校验。

## 威胁与控制

| ID  | 威胁                                      | 影响                                 | V0.1 控制                                                                                                                                                                                                                              | 验证                                                  |
| --- | ----------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| T01 | Renderer XSS 升级为本地执行               | 系统/数据接管                        | Node 关闭、隔离+sandbox、CSP、Markdown 禁 raw HTML                                                                                                                                                                                     | E2E 注入 payload                                      |
| T02 | Preload 暴露通用 IPC                      | 任意 Main 能力调用                   | 仅具名白名单、去除 event、冻结 API                                                                                                                                                                                                     | API surface snapshot                                  |
| T03 | 伪造/子 frame IPC                         | 越权操作                             | 校验 senderFrame、顶层 frame、精确 origin                                                                                                                                                                                              | Main 集成测试                                         |
| T04 | 非法 IPC/Schema 污染                      | 崩溃、注入、越权                     | strict Zod、长度/URL/ID 限制、未知键拒绝                                                                                                                                                                                               | fuzz/边界测试                                         |
| T05 | API Key 泄露到 UI/DB/日志                 | 额度/账号泄露                        | 登录 modelApiKey 只走 Main 内存链路；safeStorage；DB secretRef；全链路 canary 扫描                                                                                                                                                     | 安全测试                                              |
| T06 | SecretStore 不可用时明文降级              | 持久泄露                             | 阻止保存，仅允许瞬时测试并明示                                                                                                                                                                                                         | 平台故障测试                                          |
| T07 | 恶意模型输出/链接                         | XSS、钓鱼、协议执行                  | sanitize；禁脚本；外链 HTTPS 校验+系统浏览器                                                                                                                                                                                           | Markdown/URL 用例                                     |
| T34 | 浏览器 CDP 被其他进程连接                 | 接管独立 Profile、读取登录页面       | 独立非默认 Profile；随机非零端口；仅回环监听；只接受本次子进程报告且与服务实际返回一致的端点；端点不进 Renderer/日志；应用退出清理                                                                                                     | 回环、端点身份与启动参数测试                          |
| T35 | 模型误操作已登录网页                      | 发送、删除、发布或账号状态变化       | 登录账号下内建能力；模型运行互斥；snapshot/ref；拒绝任意 JS、密码字段和默认 Profile；完整 Tool 审计。产品明确选择不做动作审批，残余风险对用户可见                                                                                      | Tool Schema、过期 ref 与受保护字段测试                |
| T36 | 浏览器导航或新建标签页进入本机或私网      | 内网探测、访问本地管理面             | 导航与 `browser_open` 共用公开 HTTP(S) URL 校验；拒绝凭据 URL、本机、私网、链路本地和保留解析；Workflow/Automation 同样执行 URL 策略                                                                                                   | URL/DNS、新标签页创建单元测试                         |
| T08 | 任意导航/新窗口/WebView                   | 加载恶意远程代码                     | deny navigation/window/webview；本地 app protocol                                                                                                                                                                                      | Electron E2E                                          |
| T09 | Provider URL SSRF/明文传输                | 内网探测、Key 泄露                   | 默认 HTTPS；禁止 file/data；localhost 仅开发显式开关                                                                                                                                                                                   | URL contract tests                                    |
| T10 | 数据库篡改/迁移失败                       | 数据损坏、执行异常                   | 参数化查询、JSON Schema、migration checksum/事务、恢复模式                                                                                                                                                                             | integration                                           |
| T11 | 日志注入或敏感正文记录                    | 隐私泄露、诊断误导                   | 普通日志脱敏/正文禁记；完整 payload 仅开发显式开启、独立 `0600` 文件且不含凭据                                                                                                                                                         | canary scan                                           |
| T12 | 流取消竞态/跨窗口取消                     | 状态破坏、越权                       | run ownership、AbortController、条件终态更新                                                                                                                                                                                           | race tests                                            |
| T13 | MCP 声明升级或模型越权调用                | 数据泄露/外部副作用                  | Server 或会话单 Tool 显式绑定；保存与执行双重校验；本轮暴露集合校验；HTTPS/SSRF、超时、取消、输出上限和审计；无通用 call IPC                                                                                                           | unit/integration/UX                                   |
| T14 | 依赖/打包供应链                           | 代码执行                             | lockfile、最少依赖、审计、签名/来源策略后续落地                                                                                                                                                                                        | CI/release checklist                                  |
| T15 | 本地同账户攻击者读用户数据                | 隐私泄露                             | OS 文件权限、Key 用 SecretStore；DB 全盘加密暂未提供                                                                                                                                                                                   | 文档化残余风险                                        |
| T16 | 恶意或畸形知识文件                        | 内存/CPU 耗尽、路径逃逸              | 格式/大小/数量白名单、拒绝符号链接、解析超时与解压上限、受管目录隔离                                                                                                                                                                   | Adapter/IPC 测试                                      |
| T17 | Embedding 模型供应链或外发                | 代码/数据风险                        | 固定 revision、随包资源 SHA-256、MIT notice、仅 local-only 推理                                                                                                                                                                        | 构建/哈希/推理 smoke                                  |
| T18 | 通信渠道凭据泄露、串号或重放              | 账号接管、跨账号执行、重复指令       | 账号复合主键、微信 SecretStore、固定域名、严格响应、游标恢复、入站去重、原消息 context_token、退出停止、无正文日志                                                                                                                     | unit/integration                                      |
| T19 | 登录凭据泄露、重定向或伪造响应            | 账号接管、会话冒用/模型额度泄露      | Main 固定 HTTPS、拒绝 redirect、15 秒超时、响应上限/Schema、Token 与 modelApiKey 分离存储、无凭据日志                                                                                                                                  | unit/integration/E2E                                  |
| T20 | 恶意 Skill 目录或安装包                   | Token 泄露、Zip Bomb、代码执行       | 固定认证 API；下载不带 Token；公开 HTTPS/逐跳校验；ZIP/文件/解压限额；路径规范化；仅审核包可进入脚本运行时                                                                                                                             | unit/E2E                                              |
| T21 | Skill 脚本越权或失控                      | 用户文件/网络/进程被滥用             | 精确 checksum 审核；仅绑定 Skill；脚本枚举与参数 Schema；无 Shell；最小环境；独立工作区；超时、取消、输出上限和脱敏审计                                                                                                                | unit/manual                                           |
| T22 | Creator 安装任意本地目录                  | 未授权代码进入 Skill 运行时          | 固定 Creator package ID 与权限；目录名 Schema；绑定当前 ID/checksum/workspace；拒绝符号链接和自覆盖；复用包校验与安装服务                                                                                                              | unit/integration                                      |
| T22 | 恶意 Agent 目录或角色定义                 | Prompt 注入、密钥泄露、越权声明      | 固定认证 API；公开 HTTPS/逐跳校验；下载不带 Token；大小/超时限制；远端模型密钥丢弃；用户显式安装且能力仍由本地绑定决定                                                                                                                 | unit/integration/E2E                                  |
| T23 | 安装包静态提取 Main 业务源码              | 逻辑泄露、篡改与逆向复用             | Main 使用目标 Electron 生成 Bytenode `.jsc`；源 bundle 删除；构建门禁拒绝残留源码/跨平台字节码；敏感值仍不硬编码                                                                                                                       | unit/package smoke                                    |
| T24 | 更新源、清单或安装包被篡改                | 供应链植入、降级或拒绝服务           | 固定 HTTPS OSS 源；清单 SHA-512；禁止降级；平台代码签名；载荷先于清单发布；Renderer 不接收 URL/路径；失败默认不安装                                                                                                                    | unit/signed upgrade smoke                             |
| T25 | 恶意或伪造的会话文档                      | 路径逃逸、资源耗尽、内容泄露         | 用户显式选择/拖放；格式签名与 OOXML 目录校验；数量/体积/声明解压预算；拒绝符号链接、加密项、宏/OLE；opaque ID 与受控目录。对话内图片仅经 `zimo-doc:` 协议按 ID 取流，非图像与非法 URL 返回 404，不向 Renderer 暴露路径                 | unit/integration                                      |
| T26 | 恶意仓库内容诱导模型越权                  | 文件破坏、命令执行、数据外带         | 仓库内容始终是不可信数据；文件动作经结构化策略；宿主机命令统一标记高风险。“请求审批”逐次确认；用户主动选择“帮我批准”后可自动执行，当前尚不能识别命令内隐藏的危险意图或阻止命令联网                                                     | unit；adversarial/E2E 待补                            |
| T27 | 路径、链接或 TOCTOU 绕过目录策略          | 读取内部数据或越界修改               | 未授权路径只读；写入先审批并持久授权 canonical 父目录；硬拒绝 system/accounts/安装目录；拒绝链接/可执行/敏感目标，checksum + 元数据复核                                                                                                | unit 已覆盖；platform 待补                            |
| T28 | 宿主机命令误用、Prompt 注入或未来沙箱逃逸 | 当前用户权限、文件、凭据或系统被接管 | Phase 9E0：固定 Shell、有限继承环境、超时/取消、输出上限和进程树回收；“帮我批准”会绕过逐条确认且按账号记忆，明确 cwd 不是边界。首个任务默认询问、账号隔离、既有会话独立保存；目标方案仍为独立签名 helper 与 OS 文件/网络/进程/资源隔离 | host executor unit 已补；platform/security smoke 待补 |
| T29 | 审批伪造、重放或审批疲劳                  | 未经同意执行高风险动作               | 9C：run/window/approval/action digest 绑定、一次性过期消费；自动执行仅来自用户显式保存的会话模式，关键危险和边界违规无批准入口                                                                                                         | unit 已覆盖；E2E 待补                                 |
| T30 | 网络规则绕过或 DNS rebinding              | 内网探测、凭据/源码外带              | 规划：默认断网、一次性域名授权、逐跳 HTTPS/DNS/IP/重定向检查、拒绝私网/回环/直接 IP                                                                                                                                                    | platform/integration 待补                             |
| T31 | 审计正文或路径泄露                        | 用户隐私与秘密暴露                   | 9F：append-only allowlist 审计仅含动作名、目录显示名和相对目标，无正文、参数值、stdout/stderr、绝对路径、digest、env 或凭据；真实授权路径只经当前账号设置页专用 DTO 展示                                                               | unit/integration 已覆盖                               |
| T32 | Automation 串号、重入或运行风暴           | 跨账号执行、额度耗尽、重复副作用     | 账号隔离查询；专用会话；`next_run_at` 事务领取；同任务唯一 running；每轮上限；错过周期只补一次；登出/退出取消；正文不进日志                                                                                                            | unit/integration/manual                               |
| T33 | 网页 Tool SSRF、凭据外发或恶意正文注入    | 内网探测、搜索 Key 泄露、模型被污染  | Main 仅 GET；协议/userinfo/端口/DNS/IP 校验；拒绝私网和元数据；公开页面逐跳复检；带 Key 的搜索请求拒绝重定向；体积/类型/超时限制；正文标记为不可信且不进普通日志                                                                       | unit 已覆盖；真实 Provider 待人工验证                 |

## Electron 基线

BrowserWindow 显式设置 `nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`、`webSecurity:true`。禁用 experimental/Blink features、webviewTag 和不安全混合内容。生产只加载 `app://zimo` 打包内容；权限请求默认拒绝；下载、导航、窗口创建均由 allowlist handler 控制。依据 [Electron 官方安全清单](https://www.electronjs.org/docs/latest/tutorial/security)。

开发服务器是较弱边界：只在开发构建启用精确 localhost origin，生产包中移除相关分支；不允许通过环境变量把生产窗口指向任意 URL。

生产打包把 Main CommonJS bundle 使用 Bytenode 转为与目标 Electron/V8 和操作系统架构一致的压缩字节码，原始 Main bundle 只在全部编译成功后替换为最小加载器。Main 产物残留 `.js`、source map、缺失 `.jsc` 或跨平台构建时必须失败。Preload 不为字节码关闭 sandbox，Renderer 不进入该机制。字节码不是加密或可信执行环境，不能阻止动态调试、内存提取、字符串分析或已控制本机账户的攻击；秘密继续依赖 SecretStore 和服务端边界。

桌面「检查更新」不访问更新源，只向当前窗口提示已是最新版本。Renderer、IPC 和生产环境变量仍不能指定 feed。恢复自动更新前，正式通道必须同时依赖 macOS/Windows 平台代码签名、受控 OSS 写权限和清单校验；未签名构建不得宣称完成供应链防护。

## LLM 特有风险

模型文本始终视为数据。旧 Intent Router 的 `shouldExecute` 仍永远 false，普通会话已改为 ADR 0023 的按需发现。模型可搜索当前账号本地已安装并启用的能力；Application 只把可信注册表中实际存在的 MCP/Skill/知识检索 Tool 临时加入当前 run，拒绝模型编造 ID。已安装能力无需二次授权，但具体文件、命令、脚本和外部副作用继续执行动作策略与审批。模型不能决定 IPC channel、任意命令、包外脚本路径、URL 自动打开、Plugin 安装或市场自动安装。MCP/Skill/市场描述作为不可信有界 Tool result，不授予额外权限。

Phase 6C 将知识片段放入独立 System 上下文并明确标记为不可信参考数据；最多注入 8 个文本块和 6000 字符正文。知识内容不能覆盖 Agent/System 指令，也不能授予 Tool/MCP 权限。实际使用的来源以不含正文和路径的快照随助手消息保存。

## 文件与原型边界

Phase 6 知识库允许 Main 读取用户明确选择或拖放的白名单文件，限制数量、单文件大小、解析时长、解压大小和表格单元格数，禁符号链接、附件、OCR、iframe 与图片提取；原文件复制到隔离管理目录。拖放路径只在 Preload 转换并送入具名 IPC，不进入 Renderer 响应或日志。本地 Embedding 模型以固定 revision 随安装包分发，加载前校验关键资源 SHA-256，且 Transformers 运行时禁止远程模型。

Phase 8 会话文档只在 Main 中导入 DOCX/XLSX/PPTX/PDF，限制 20 MB/文件和 10 文件/消息。OOXML 校验中央目录、必需结构、目录逃逸、加密位、宏/OLE、目录项数量和声明解压规模；标准空 `embeddings/` 目录可存在，但任何实际嵌入条目均拒绝。文件复制到 `workspaces/<conversationId>/` 后只通过 artifact/revision ID 访问；Renderer 不接收路径或二进制，导出位置只来自原生另存为。相关模型请求最多接收 6,000 字符并明确标记为不可信资料，普通日志不记录正文。解析具备 30 秒超时和运行态解压预算，但首版仍位于 Main，尚未获得 Utility Process 的进程级隔离。

本地与 Zimo Store Skill 会在有界解析后把完整普通文件写入应用受管目录；目录 Token 不转发给下载域名。Skill 指令仍是不可信 Prompt 内容，只有用户安装并绑定后才进入模型上下文。包内 Python/Node 脚本按 ADR 0013 注册为受控 Tool，不执行 Shell、Hook 或依赖安装。当前子进程不是恶意代码沙箱，审核失误可能导致当前 OS 用户权限内的数据和网络风险。Plugin 仍不下载、不 `eval`、不安装依赖。

项目维护的 Creator 可声明专用 `skill:local-install` 权限。只有固定 package ID 与该权限同时满足时，Application 才注册安装 Tool；参数不能携带路径，只能指定 Creator 当前 workspace 下的一个规范目录名。Adapter 绑定可信 Skill ID/checksum，拒绝目录逃逸、符号链接和 Creator 自覆盖，再复用普通本地包解析与安装链路。该能力不会给 Renderer 增加路径或通用 Tool IPC，也不允许 Creator 脚本直接写数据库。

Zimo Agent 人才库由 Main 读取应用内 `resources/agents` 的 `AGENT.md`；Renderer 不接收本地路径。用户点击安装后，Main 把同一文件的正文保存为 system prompt。目录与角色正文均不授予 Skill、MCP、Shell、文件或网络权限；这些能力仍由本地显式绑定决定。

Phase 7 MCP Registry 只连接公开可解析的 HTTPS Streamable HTTP 地址，拒绝 userinfo、自定义端口、私网/回环解析和 MCP redirect；Bearer、OAuth、固定 Header 与 Query Key 凭据进入 SecretStore。目录专用 Header/Query 名称只由 Main 受信配置决定，SQLite 保存不含凭据的基础 endpoint，普通日志不得记录临时拼接的请求 URL。OAuth 授权页只由 Main 交给系统浏览器，一次性 loopback 回调校验随机 state 并在 5 分钟后失效，Renderer 不接收 Token、client secret 或授权回调。完整 `tools/list` 快照按数量、名称、Schema 深度和大小限制后进入 Main/Application 注册表。Agent/Workflow 的 Server 绑定是当前测试版授权边界；模型只能调用本轮已暴露工具，且经过有界 JSON 参数校验、20 秒超时、取消、输出限制和脱敏审计。远端 annotations 和输出均不可信；Renderer 没有通用 Tool execute IPC，stdio、私网 MCP 和本地代码执行仍未开放。剩余风险是 DNS rebinding、系统浏览器中的钓鱼式授权页、Query Key 可能被远端基础设施访问日志记录，以及绑定整个 Server 后权限过宽；正式发布前需固定解析代理层、连接器来源展示并增加 Toolset/单 Tool 授权。

通信渠道只允许内置微信和邮箱 Adapter。微信二维码、token、游标、`context_token`、微信用户 ID 与消息正文不写普通日志，也不返回 Renderer；微信只访问固定腾讯 HTTPS 端点及校验后的跳转域名。绑定以认证服务的 `externalUserId` 隔离，二维码会话锁定发起账号，登录切换、退出、解绑和应用退出均停止旧监听。入站只接受有界文本，稳定标识按账号去重并进入无附加能力的“微信助手”普通会话；回复必须使用该条消息自己的 `context_token`。微信不能远程绑定 Agent、Skill、Workflow、MCP 或提升 Tool 权限，Router 仍不执行建议。邮箱绑定只接受完整地址，不接收凭据、不解析用户指定主机且不发起网络连接，因而不形成 SMTP SSRF 面。

真实登录只由 Main 访问部署配置的远程认证基址；仓库内不嵌入固定生产 URL。未配置时远程账号密码登录拒绝；开发覆盖 `ZIMO_AUTH_BASE_URL` 只允许 loopback 假服务。密码不持久化，Token 与登录响应中的 `modelApiKey` 使用不同随机引用经 safeStorage 加密并与 SQLite 分离；既有模型密钥不返回 Renderer。模型端点、模型标识和显示名称只读取已保存配置，代码不提供固定地址或模型名。没有完整配置时登录仍成功，但对话不可用，直到用户在模型配置中保存地址、标识和图像模式。开发服务器页面可提交 HTTPS/loopback 地址、模型名和可选新 Key，但 Application 只接受固定 Provider/Model ID，把显示名称同步为模型标识，只接受图像模式变更，并忽略提供商改名、其他能力和停用请求，同时拒绝其他 Provider。再次登录不覆盖已保存的模型标识、显示名称和 API 地址。新 Key 保存后清空页面并轮换 SecretStore 引用。SecretStore 或模型配置失败时登录整体回滚；升级后若旧会话缺少托管模型密钥，则清除会话并要求重新登录。远端错误正文不进日志，恢复校验发现 Token 失效或云端用户不一致时清除会话。

Automation 仅在 Electron Main 存活和用户已登录时运行。任务、专用会话与历史按 `externalUserId` 隔离，Renderer 不能传入可信账号；账号切换、退出登录与应用退出会取消已接纳运行。数据库原子领取并限制同一任务一个 running，单轮最多启动 3 个；休眠或关机错过多个周期时最多补一次。能力由专用会话显式绑定并在执行时再次校验，Router 不会自动扩权。

## 隐私与残余风险

用户手动保存或由普通会话模型工具写入的长期记忆存于账号隔离的本地 SQLite 表；Renderer 与模型不能指定所有者，工具执行时核对当前账号与运行快照。记忆正文只在当前账号设置页和经有界选择的模型请求中出现，不进入普通日志。首版对模型提交的记忆不做原文出处、敏感性或长期价值判断，可能保存不准确或不应长期保留的信息；用户可在设置页删除或停用。开发态敏感 payload capture 会包含记忆与模型工具参数；本地数据库仍依赖 OS/磁盘安全，已发送请求不能追溯撤回。记忆文本不授予系统权限或工具访问。

- 对话正文存 SQLite，未做应用层数据库加密；依赖 OS 账户与磁盘加密。这是 V0.1 明示风险，发布前需隐私说明；
- OpenAI-compatible 服务会收到所选会话上下文，发送前 UI 应明确当前 provider/model；
- `safeStorage` 的保护强度随平台与用户环境变化，必须检查可用性；
- 本地恶意软件、已控制用户账户或被篡改的签名应用不在 V0.1 可完全防御范围；
- 知识文本、向量和管理副本未做应用层加密；内置模型会增加安装包体积并需要在每次模型更新时复核许可证与哈希；
- 会话文档管理副本同样未做应用层加密，依赖 OS 账户和磁盘加密；任务删除后的文件清理当前为尽力执行，后台任务阶段需增加可重试残留清理；
- 开发者显式开启 `ZIMO_LOG_LLM_PAYLOADS=1` 后，独立诊断文件包含用户、Agent、Skill 和知识正文；它不写凭据但仍是敏感数据，排障结束后必须关闭并删除；
- 自动更新的客户端检查、下载和安装已停用；签名、公证、OSS 发布权限、回滚演练与 SBOM 仍未完成，开发预览不可宣称生产安全。
- Phase 9D 已注册受控普通文本文件创建、精确替换和可恢复删除，但尚未完成 macOS/Windows 签名安装包人工验收；原子替换、权限位、junction/硬链接等平台差异仍需平台矩阵复核。Phase 9E0 的宿主机 `run_command` 没有 OS 文件、网络、进程或资源隔离，命令可读取目录外内容、联网、修改系统可写位置或启动后代进程；用户选择“帮我批准”后连逐条确认也不会发生，有限环境和超时不能形成安全边界。发布级命令仍必须通过 ADR-0019 平台 Spike。

## 安全响应

发现安全校验失败：默认拒绝操作，返回通用 `SECURITY_REQUEST_REJECTED`，记录不含 payload 的 security 事件。连续异常只做本地节流，不上传。发布前建立漏洞报告渠道、依赖响应流程、日志/本地数据清除说明。
