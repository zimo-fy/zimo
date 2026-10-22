# Electron 与 Node.js 规范

## 进程职责

- Renderer 只负责 UI，不拥有 Node 权限；Preload 只暴露最小、具名、类型化桥接；Main 负责窗口、协议、IPC 和组合根；
- 业务规则不写在 IPC handler；handler 只做 sender 校验、Schema 解析、调用 Application 和 DTO/错误映射；
- CPU 密集、文件解析、Embedding 和大型数据转换不得阻塞 Renderer；必要时在受控 Worker 中执行并支持取消；
- Main、Preload、Renderer 不共享带运行时副作用的模块，跨进程只共享纯类型、Schema 和 DTO。

## Electron 安全基线

- BrowserWindow 显式保持 `nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`、`webSecurity:true`；禁止 `webviewTag` 和 Electron remote；
- 生产只加载受控 `app://zimo` 内容；开发 URL 只能来自开发构建分支，不能由生产环境变量任意覆盖；
- CSP 默认拒绝 inline/eval/未知网络；任何放宽都需要威胁分析、ADR 和安全测试；
- 导航、新窗口、权限请求、下载、外链和协议处理默认拒绝，只允许用户触发且经过精确 allowlist 的目标；
- 所有 IPC 校验 sender、frame、channel、输入和输出；禁止动态 channel、任意 invoke 代理和向 Renderer 暴露 Electron event；
- Preload 暴露冻结的最小 API；不得暴露 `ipcRenderer`、文件系统、shell、Buffer、进程或任意路径读写。

## 窗口与生命周期

- 窗口创建选项集中管理；新窗口说明所有者、父子关系、模态性、关闭行为和单实例策略；
- 注册事件时保存清理方式，窗口关闭、应用退出和测试 teardown 时移除 listener、timer 和订阅；
- 区分 macOS activate、所有窗口关闭和正式退出；不要假定 `window-all-closed` 在所有平台行为相同；
- 应用退出前停止运行任务、关闭数据库和日志 sink；清理必须有超时，不能无限阻塞退出；
- 不在生产启动阶段执行网络下载、开发 server 探测或未版本化 migration。

## IPC 与流

- request 使用客户端 requestId，长任务返回稳定 runId；事件 envelope 包含类型和关联 ID；
- 每次流只有一个终态，完成/失败/取消竞争必须幂等；Renderer 订阅后能可靠退订；
- 不使用同步 IPC；请求应支持超时，长任务支持 AbortSignal/取消 channel；
- 高频事件聚合或节流，避免每个 token 都导致数据库写入或无界 Renderer 更新；
- 错误映射为稳定 AppError DTO，Renderer 不接收 cause、stack 和供应商响应正文。

## Node.js 代码

- 使用 ESM，Node 内置模块使用 `node:` 前缀；生产路径基于明确的 app/userData/resources 位置，不依赖 cwd；
- 优先 Promise 版异步 API；启动期的小型同步读取需说明范围，热路径禁止同步文件、网络或加密操作；
- 文件、stream、server、Worker 和数据库连接用 `try/finally` 或生命周期对象释放；监听 `error` 并处理 backpressure；
- 外部 IO 设置大小、数量和时间上限；使用 AbortSignal 贯穿调用链，不用不可取消的悬挂 Promise；
- 环境变量只在 composition root 解析；库模块不读取或修改全局环境、cwd、locale 和 process handlers；
- 禁止 `eval`、`Function`、不可信动态 import；`child_process`、Shell 和任意命令执行默认禁止。例外仅限 ADR 0013 的受审核 Skill 适配器，以及 ADR 0019 明确批准的实验性 `WorkspaceCommandExecutor`。后者必须通过模型 Tool、逐次审批、固定平台 Shell、最小环境、超时/取消、输出上限和审计进入；不得新增 Renderer/Preload 通用 Shell IPC，也不得宣称具备 OS 沙箱隔离。

## 文件、路径与网络

- 文件选择由 Main 发起系统对话框；Renderer 不获得真实路径，拖放路径只经 Preload 的受控映射传给 Main；
- 访问前解析 canonical path，校验允许根、文件类型、符号链接、大小和数量；临时目录使用随机专用目录并在 finally 清理；
- 写文件优先原子写入（临时文件 + rename）；覆盖、删除和迁移前明确恢复策略；
- URL 使用标准 URL 解析器，限制 `https:`、host、端口、重定向次数和响应大小；禁止字符串前缀判断来源；
- TLS 校验不得关闭；代理、证书和认证错误映射后返回，不把响应 body 或 Header 写日志。

## 原生依赖与打包

- 原生模块按目标 Electron ABI、OS 和架构安装/验证；不能用开发 Node 可加载代替打包态验证；
- `asarUnpack` 和 `extraResources` 只列运行时必需内容，禁止把整个 workspace、测试、source map、其他平台二进制打包；
- macOS x64/arm64 与 Windows x64 分别构建并 smoke；跨平台生成成功不代表目标系统可运行；
- 签名、公证、自动更新与安装器改变信任边界，接入前必须单独设计并验证回滚；
- 发布产物检查体积、许可证、模型校验和秘密扫描，不提交到 Git。
