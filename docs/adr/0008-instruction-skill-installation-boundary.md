# ADR 0008：Instruction Skill 安装边界

状态：已接受  
日期：2026-09-03

2026-09-09 修订：`manifest.json` 的强制与 strict Schema 要求已被“仅 `SKILL.md` 本地兼容安装”决策替代。Manifest 现在可选，且无效或未知字段不会阻止安装；其 command、script、dependency、hook 等字段仍不会被解释。`SKILL.md`、目录边界、符号链接、文件类型和体积限制继续有效。

## 背景

V0.1 的 Skill 安装只修改内存状态，不能形成可使用、可恢复的能力目录。直接支持脚本、依赖安装或远程市场会同时引入供应链、本地代码执行、路径穿越和权限升级风险。

## 决策

V0.2 第一阶段只接受用户通过系统目录选择器明确选择的 instruction Skill 文件夹。包必须包含严格的 `manifest.json` 和普通文件 `SKILL.md`：

- `schemaVersion` 固定为 `1`，`kind` 固定为 `instruction`，`entry` 固定为 `SKILL.md`；
- manifest 拒绝未知字段，不接受 command、script、dependency、hook、网络地址或可执行入口；
- 权限只允许 `context:user-input` 和 `context:conversation`；
- manifest 最大 64 KiB，指令最大 256 KiB；
- manifest 与入口必须是包目录内的普通文件，拒绝符号链接和目录逃逸；
- 安装后将经过校验的指令、元数据和 SHA-256 checksum 写入 SQLite，不依赖原文件夹继续存在；
- Renderer 不接收所选目录路径，日志也不记录路径或指令正文。

Agent/Skill 先使用 SQLite 持久化，其余五类产品模块继续使用 Mock Repository，直到各自运行时立项。

## 后果

用户可以安装、更新和启用纯指令 Skill。只有被 Agent 显式绑定且用户确认该次 Agent 运行后，指令才作为文本上下文注入模型；读取器永不执行其内容。脚本、Tool、MCP、依赖安装、ZIP、远程 Gallery、签名验证和安全执行器需要后续 ADR。
