# ADR 0013：受审核 Skill 脚本运行时

状态：已接受  
日期：2026-09-08

## 背景

ADR 0008 与 ADR 0012 为早期 instruction-only 阶段禁止保存和执行 Skill 代码。实际 Zimo Skill 包除 `SKILL.md` 外还包含 `scripts/`、`resources/` 和任务模板；例如日程管理依赖 `scripts/schedule.py` 写入自己的日程数据。只保存指令会导致模型描述一条命令，却没有任何可执行能力。

产品现明确将 Zimo Skill 上传审核作为代码信任入口，并允许用户安装、绑定和执行审核后的 Skill 脚本。本决策替代 ADR 0012 中“忽略且绝不执行脚本”的部分，下载来源、HTTPS、Token 隔离和压缩包限额仍继续有效。

## 决策

- 安装器保留包根目录下的全部普通文件，拒绝绝对路径、`..`、符号链接、重复/保留路径和超限包；不运行 `setup.sh`、安装 Hook 或包管理器。
- 包存入 `app.getPath("userData")/accounts/local/skill-runtime/packages/<skillId>/<checksum>/`；脚本实际运行前复制到 `data/<skillId>/workspace/`。包文件只读，工作数据按 Skill 隔离并跨会话保留。
- 第一阶段只识别 `.py`、`.js`、`.mjs` 和 `.cjs`。Python 使用系统 `python3`（Windows 为 `python`）；Node 脚本使用当前应用内置 Node 运行时。不接受命令字符串，也不经过 Shell。
- 每个已绑定脚本型 Skill 动态注册一个 `skill.<skillId>.run_script` Tool。模型只能选择安装清单中的脚本路径，并传入最多 32 个、每个最多 4000 字符的字符串参数。
- 用户把 Skill 绑定到会话、Agent 或 Workflow，视为对该 Skill 本轮脚本 Tool 的授权。调用继续经过模型本轮暴露校验、参数校验、30 秒超时、取消、10 万字符输出上限和现有 Tool 审计。
- 子进程只继承最小环境，不继承模型 Key、登录 Token或其他应用秘密。普通日志仅记录 Tool ID、参数键名、耗时、结果和错误码，不记录参数值或输出。
- 卸载删除安装包和该 Skill 的持久化工作数据。更新同 package ID 时复用 Skill ID，并安装新 checksum 对应内容。

## 受控包内文本资源增量（2026-10-07）

- 安装清单中的 `.md/.txt/.json/.yaml/.yml/.csv` 可作为只读模型资源；`SKILL.md`、`manifest.json` 和 `scripts/` 不进入资源枚举。
- 已加载 Skill 动态注册 `skill.<skillId>.read_resource`，Schema 的 `path` 是安装清单生成的枚举。Adapter 再校验 skill ID、checksum、规范化相对路径、文件清单、UTF-8 和 64 KiB 上限。
- 资源读取不复制到脚本工作区，不使用会话 Workspace，不接受绝对路径、`..` 或符号链接，不产生通用文件读取权限。
- Tool result 可把资源正文返回当前模型轮次；普通日志和审计只记录 Tool ID、参数键名、耗时和结果，不记录路径值或正文。

## Creator 直接安装增量（2026-09-11）

- 项目本地安装的 Creator 仅在固定 package ID `zimo.skill-creator` 且安装清单声明 `skill:local-install` 权限时获得 `install_created_skill` Tool。Zimo Store 会用目录 ID 派生自己的 package ID 并覆盖包内权限，因此官方 Creator 商店条目由应用固定的商店 package ID 与不可由压缩包声明的 `Zimo Skill Store` 安装来源共同授权。普通 Skill 即使伪造名称、包内 manifest 或同名脚本也不会获得安装能力。
- Tool 只接受一个符合 Skill 命名规则的目录名。Adapter 将它解析到当前 Creator ID 与 checksum 对应的 `data/<skillId>/workspace/<directoryName>`，拒绝绝对路径、路径分隔、目录逃逸、符号链接、缺失工作区和失效的 Creator 安装包。
- 生成目录继续经过现有本地包读取器的文件数量、大小、路径和符号链接校验，再由 `InstructionSkillInstallationService` 完成包快照与 Repository 保存；不允许 Creator 脚本直接访问 SQLite 或 `packages/`。
- 创建成功属于当前已绑定 Creator 的受控 Tool 调用，沿用本轮工具授权、30 秒超时、取消、输出限制和脱敏审计。返回模型的结果只包含安装后 Skill 的 ID、名称、版本和状态。
- 生成包的 package ID 不得等于 Creator 自身，防止运行中通过生成目录替换特权包。安装 Tool 不可用或失败时，保留显式“本地安装”作为回退。

## 信任与残余风险

这是“受审核本地代码执行”，不是恶意代码沙箱。Python/Node 子进程拥有当前 OS 用户权限；工作目录和最小环境变量只是减少误用面，不能阻止恶意脚本主动访问用户文件、网络或启动其他进程。Electron Renderer 的 Chromium sandbox 不会隔离由 Main 启动的该子进程。

因此上线前必须保证 Zimo Store 的上传审核覆盖代码、依赖、网络目标、文件访问和持久化行为。当前目录没有包签名、审核证明、撤回清单或 OS 级隔离；第三方上传入口不得仅凭“已上传”自动成为可信包。后续应增加签名/内容透明、审核版本绑定、运行权限声明、系统级沙箱和撤回机制。

## 兼容性

旧版本已安装记录只有 `SKILL.md`，本地没有完整包。用户需在 Skill Store 点击“重新安装”同步脚本。依赖第三方 Python/Node 模块、浏览器、Shell、系统命令或后台调度的 Skill 仍可能不可运行；这些能力必须分别设计依赖与权限边界。
