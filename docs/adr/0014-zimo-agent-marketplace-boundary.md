# ADR 0014：Zimo Agent 人才库安装边界

状态：已接受  
日期：2026-09-08

## 背景

xclaw 前端已经接入 Zimo 服务的人才库、创建和删除 Agent 接口，但其安装流程同时创建 OpenClaw 工作区、注入服务端模型密钥并安装关联 Skill。Zimo 当前以本地 Agent Definition、用户模型配置和受控能力绑定为运行边界，不能直接复制该运行时。

## 决策

- 复用人才库分类、目录、用户 Agent 列表、`add_agents` 和 `delAgents` 五类远端协议，新建专用 Gateway 与 Application service；
- Renderer 只获得展示目录并只提交 catalog ID 或 local Agent ID，所有认证、远端 ID 解析和网络调用留在 Main；
- 安装创建一个现有 `PrototypeDefinition(kind=agent)`，角色 Markdown 映射为 system prompt，因而复用会话和 Workflow 的已有 Agent 运行链路；
- catalog ID 与远端用户 Agent ID 分列持久化，catalog ID 设为 Agent 范围唯一；
- 安装前按 catalog ID 查询用户 Agent 列表，复用同一账号在其他客户端已经创建的远端记录；只有本机具备完整 Agent Definition 时才标记为已安装；
- 远端 `modelApiKey` 永久忽略，Zimo Agent 继续使用本地模型配置；
- 不创建 OpenClaw Gateway、不接收远端绝对路径、不自动安装关联 Skill；这些能力若需要必须另立运行时和权限决策；
- 角色 Markdown 是用户显式安装的不可信行为配置，下载遵守公开 HTTPS、SSRF、重定向、大小、超时和 Token 隔离限制。

## 后果

现有 Zimo 人才库可以直接服务当前桌面客户端，安装后的 Agent 与手建 Agent 使用一致的选择和执行体验。代价是 xclaw 专属的独立 Gateway、工作区和云端模型配额不会随安装生效；依赖这些能力的 Agent 只能获得角色指令，不能宣称已经具备未授权的外部执行能力。

远端创建与本地 SQLite 不共享事务。当前在本地保存失败时执行远端补偿删除；卸载按“远端删除 → 本地事务删除并级联清理引用”执行，最后一步失败需重试。历史 AgentRun 保留原 Agent ID 快照。未来若服务提供幂等键或事务状态接口，应使用 local Agent ID 作为幂等键并增加恢复队列。

## 2026-10-19 修订：目录改为本地文件夹

桌面端 Agent 人才库不再请求 `/label/management/list`、`/ai/agents_management/list`、`/system/agents/list`、`add_agents` 或 `delAgents`。Main 枚举 `apps/desktop/resources/agents` 的直接子目录，读取 `AGENT.md` 的 frontmatter 和正文。点击安装仍只提交 catalog ID，由 `AgentMarketplaceService.install` 重新读取同一文件并保存本机 Agent。云端 Gateway 的列表、安装和卸载方法直接拒绝，不会发出请求。打包时该目录通过 `extraResources` 放到 `resources/agents`。
