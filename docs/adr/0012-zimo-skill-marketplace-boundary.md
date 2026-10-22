# ADR 0012：Zimo Skill Store 安装边界

状态：部分被 ADR 0013 替代  
日期：2026-09-08

## 背景

ADR 0008 只允许用户从本地文件夹安装严格的 instruction Skill，并把远程 Gallery、ZIP 和脚本型 Skill 留到后续决策。现需接入现有 Zimo 系统的 Skill 目录，按分类展示云端 Skill，并提供安装和卸载。

xclaw 参考实现通过登录 Token 调用 `/ai/skill/zimolist`，再根据服务端返回的 `skillUrl` 下载 ZIP 并解压到工作目录。直接照搬会把脚本、依赖及其他文件写入本地，超过 Zimo 当前“不执行 Skill 代码”的阶段边界。

## 决策

Zimo 增加专用 `SkillCatalogGateway` 和 `SkillMarketplaceService`：

- Main/Adapter 从 `SessionStore` 和 `SecretStore` 读取当前登录 Token，分页调用固定 Zimo API；Token 不进入 Renderer、SQLite 或普通日志；
- Renderer 只收到目录 ID、名称、描述、分类、版本、来源及 `installed | not_installed` 状态，不收到 `skillUrl`；
- 安装 IPC 只提交目录 ID。Adapter 重新从可信目录解析对应下载地址，拒绝 Renderer 指定 URL；
- 下载只允许可公开解析、无 userinfo 和自定义端口的 HTTPS，最多三次逐跳校验的重定向；下载请求不携带登录 Token；
- ZIP 最大 2 MiB、最多 200 个目录项，只在内存中读取唯一且不超过 256 KiB 的 `SKILL.md`，不解压到文件系统；脚本、依赖、配置和资源全部忽略且绝不执行；
- 解析后的 instruction、目录元数据和 checksum 使用既有 Skill Repository 持久化，安装后固定可用，不再提供草稿、启用或禁用状态；
- 商城目录派生的 `zimo.market.*` 保持安装、更新和卸载身份；能力编排可从已持久化 `SKILL.md` frontmatter 读取通过格式校验的稳定 package ID，不覆盖商城身份；
- 卸载不再要求先解除引用；SQLite 删除事务自动移除会话和 Agent 绑定，并禁用仍引用该 Skill 节点的 Workflow；
- 本地 instruction Skill 安装入口继续保留，并在同一目录中显示为“已安装”。

本 ADR 当时沿用 ADR 0008 的严格本地 manifest 校验；该部分已由 ADR 0008 的 2026-09-09 修订替代。远程来源、下载与 Token 隔离边界不变；脚本运行边界以后续 ADR 0013 为准。

## 后果

用户可以浏览现有系统中的全部上架 Skill，并将其作为 instruction Skill 用于 Agent 和 Workflow。依赖脚本、浏览器自动化、外部二进制或专用 Tool 的 Skill 在当前版本只会提供文本指令，不能宣称其附带代码能力已经可运行。

当前仍信任 Zimo 目录对 Skill 名称、说明和下载 URL 的关联，不提供发布者签名或内容透明日志。正式开放第三方发布前需要增加签名、审核状态、版本更新和撤回策略。

2026-09-08 起，完整包落盘和受审核脚本执行改由 [ADR 0013](0013-reviewed-skill-script-runtime.md) 约束；本 ADR 的远端目录、HTTPS、Token 隔离和下载校验继续有效。

## 2026-10-19 修订：目录列表改为本地文件夹

桌面端 Skill Store 列表不再调用 `/ai/skill/zimolist`。Main 只枚举 `apps/desktop/resources/skills` 的直接子目录，用其中的 `SKILL.md` 生成目录项。点击安装仍只提交 catalog ID，由 Main 重新读取同一个子目录，再进入既有 `InstructionSkillInstallationService`。Renderer 不接收本地路径。远端目录 Adapter 的列表方法直接拒绝，不会构造或请求 `/ai/skill/zimolist`。安装包继续排除该目录，因此该列表只在包含此文件夹的开发运行中可用。
