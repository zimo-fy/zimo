# Phase 9 OS 沙箱技术 Spike 与验收矩阵

> 状态：官方机制调研完成；原生原型、目标平台矩阵与签名包验证待执行。Phase 9E0 已另行批准实验性宿主机命令，不代表已具备沙箱。
>
> 日期：2026-09-15

## 目标

选择一个能在 Electron 打包应用中稳定运行、且独立于具体 LLM 的本地命令沙箱。沙箱必须以操作系统边界强制文件、网络、进程和资源限制；任何平台无法建立边界时应禁用命令 Tool，不能回退为普通 `child_process`。

## 候选方案

### A. Zimo 自有 Sandbox Broker + 平台 helper（推荐进入 Spike）

- Main 只向 helper 发送经过 Schema 校验的 workspace ID、argv、资源预算和一次性网络能力；
- macOS 候选为受限子进程配合平台 sandbox profile、最小文件映射和进程组控制；必须验证目标 macOS 版本、签名、公证和未来兼容性；
- Windows 候选为受限 Token/AppContainer、Job Object、ACL 和网络隔离组合；必须验证安装权限、用户目录 ACL、子进程继承和卸载清理；
- 优点是模型无关、可与当前 Tool Runtime 集成；代价是原生工程、签名和长期维护成本最高。

### B. 复用成熟编码代理运行时

- 通过受支持的 Agent/App Server 协议委托沙箱、审批和 Tool 运行；
- 优点是更快获得成熟能力；代价是运行时许可、模型/账号耦合、协议兼容和包体积需要单独评估；
- 只有在权限事件、工作区绑定、取消和审计均能映射到 Zimo 契约时才可采用。

### C. 仅 Node `child_process` + 路径校验

拒绝。`cwd`、`shell:false`、最小 env 和路径校验是纵深防御，但不能限制进程读取其他目录、联网、生成子进程或调用系统 API。

## 2026-09-16 机制调研结论

当前开发机为 macOS 14.0 x64。系统仍存在 `/usr/bin/sandbox-exec`，但 Apple 已明确说明 SBPL 不是面向第三方的受支持接口，不应作为产品基础。因此不进入基于 `sandbox-exec` 或私有 `sandbox_init` 的实现，即使本机 smoke 能通过也不能关闭发布门禁。

macOS 采用受支持的 App Sandbox + 独立 XPC/helper 路线继续 Spike。helper 必须独立签名、声明最小 entitlement，通过安全作用域 bookmark 获得用户选择目录，并限制可启动的工具；直接由未沙箱化 Electron Main 启动普通子进程不合格。当前 Electron 包仍为 `identity: null`，未建立 App Sandbox entitlement、bookmark bridge 或 helper 签名，因此 macOS 项全部保持未验收。

Windows 采用稳定的 AppContainer/LPAC + Job Object 路线继续 Spike。AppContainer负责凭据、文件、网络和进程隔离；Job Object 禁止 breakaway，并负责资源限制与进程树回收。Microsoft 另有 `Experimental_CreateProcessInSandbox`，但官方仍标注实验性、API 可能变化、最低 Windows 11 且没有公开 Header，当前不得作为生产基线。

结论：生产目标仍选择方案 A 的双平台原生 helper。项目所有者于 2026-09-17 另行接受临时残余风险，批准逐条人工审批的宿主机 `run_command` 验证编程体验；该 Adapter 不关闭本报告任何沙箱门禁，也不得作为发布级安全能力。下一次关闭门禁至少需要 macOS arm64/x64、Windows x64 构建机、签名身份和安装包测试环境。

## Spike 原型约束

- helper 使用独立协议和固定版本；Main 不传任意环境变量或绝对目标路径；
- 输入长度、argv 数量、运行时间、输出和资源均有硬上限；
- stdout/stderr 被视为不可信内容，截断后才返回；
- helper 崩溃、签名失效、规则无法加载或平台能力缺失时 fail closed；
- 安装包只携带目标平台/架构 helper，并纳入哈希、签名、SBOM 与更新完整性检查；
- Spike 不连接真实用户仓库、凭据或生产服务。

## 必须回答的问题

1. 沙箱策略能否限制所有后代进程，而不仅是第一层命令？
2. 文件权限是否抵抗 symlink/junction、hard link、路径大小写与执行时替换？
3. 默认断网是否覆盖 IPv4/IPv6、DNS、代理、重定向和直接 IP？
4. 单域批准能否只持续当前动作，且不能借重定向进入私网？
5. 取消、超时、应用崩溃和退出能否清理完整进程树？
6. helper 是否会继承 Zimo 的 Token、API Key、Cookie、日志路径或数据库句柄？
7. macOS 签名/公证及 Windows 签名/安装升级后是否仍能运行？
8. 不支持平台或策略初始化失败时，UI 是否明确禁用而非静默降级？

## macOS / Windows 验收矩阵

| 场景                      | macOS arm64/x64 | Windows x64 | 通过标准                           |
| ------------------------- | --------------- | ----------- | ---------------------------------- |
| 工作目录普通文件读写      | 必测            | 必测        | 授权根内按策略成功                 |
| 目录外读写                | 必测            | 必测        | 系统层拒绝，不能只依赖预检         |
| symlink/junction 逃逸     | 必测            | 必测        | 创建前、打开时和执行时均拒绝       |
| `.git` 与敏感配置保护     | 必测            | 必测        | 命中规则时询问或拒绝               |
| 子进程继承限制            | 必测            | 必测        | 后代进程不能扩大文件/网络权限      |
| 环境变量隔离              | 必测            | 必测        | canary 秘密不可读取                |
| 默认无网络                | 必测            | 必测        | DNS、IPv4、IPv6、直接 IP 均失败    |
| 单域一次授权              | 必测            | 必测        | 仅当前 action、目标域、HTTPS 生效  |
| 重定向/私网/DNS rebinding | 必测            | 必测        | 逐跳校验并拒绝不允许目标           |
| 超时与用户取消            | 必测            | 必测        | 进程树退出、run 单终态、无孤儿进程 |
| CPU/内存/输出上限         | 必测            | 必测        | 超限受控终止，应用保持可用         |
| 提权/进程注入/设备访问    | 必测            | 必测        | 直接拒绝或由系统阻断               |
| helper 篡改或缺失         | 必测            | 必测        | 启动能力失败且不降级               |
| 开发未签名包              | 记录限制        | 记录限制    | 行为有明确说明，不替代发布验证     |
| 签名安装包                | 必测            | 必测        | 安装、首次启动、升级后 smoke 通过  |

## 决策门禁

Spike 报告必须记录原型版本、目标 OS build、架构、沙箱策略、失败样例和打包体积变化。只有上表全部目标平台通过、威胁模型复审、项目所有者批准并把本报告状态改为“Accepted”，Phase 9E 才能实现或展示命令执行入口。

## 参考

- [OpenAI Codex permissions](https://learn.chatgpt.com/docs/permissions)
- [OpenAI Codex sandboxing](https://learn.chatgpt.com/docs/sandboxing)
- [OpenAI Codex auto review](https://learn.chatgpt.com/docs/sandboxing/auto-review)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Apple App Sandbox](https://developer.apple.com/documentation/security/app_sandbox)
- [Apple：诊断 App Sandbox 与独立 helper](https://developer.apple.com/documentation/security/discovering-and-diagnosing-app-sandbox-violations)
- [Microsoft：AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation)
- [Microsoft：Launch an AppContainer](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)
- [Microsoft：Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
- [Microsoft：实验性 Create Process in Sandbox](https://learn.microsoft.com/en-us/windows/win32/secauthz/createprocessinsandbox)
