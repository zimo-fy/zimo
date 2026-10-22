# “帮我批准”模式仍弹出命令审批

## 症状与影响

用户在会话中选择“帮我批准”后，模型调用 `zimo.workspace.run_command` 仍进入 `waiting_for_approval`，必须逐条点击允许。“帮我批准”的界面名称与实际仅自动放行低风险文件修改的旧语义不一致。

## 证据与根因

安全日志先记录 `workspace.approval_mode.changed` 的 `mode=auto_low_risk`，随后同一会话的命令仍记录 `approval.requested`，规则为 `experimental_host_command_requires_approval`。因此模式已经正确保存并传入 Application，不是 Renderer、IPC 或 SQLite 状态丢失。

根因是 `ActionPolicyService` 在判断模式前无条件把未沙箱化命令判为 `ask`；旧 ADR 同时规定“帮我批准”只能自动放行低风险文件修改。

## 修复

- 产品语义统一为：“请求审批”逐次确认；“帮我批准”自动放行文件写入、删除和宿主机命令等当前已注册、可执行动作；
- `critical` 动作、路径逃逸、Zimo 内部敏感目录、非法目标和未注册能力仍拒绝，不能借自动模式绕过 Adapter 边界；
- 内部模式从 `auto_low_risk` 改为 `auto_approve`，策略版本更新以便审计区分；
- `0033_workspace_auto_approve_mode.sql` 通过新表复制，把已有会话模式迁移为新值，不修改已发布 migration；
- UI 文案明确包含命令和删除，避免再次被理解为仅低风险修改。

## 回归覆盖

- Domain/Application：请求审批模式仍询问命令；自动模式放行中高风险写入、删除和未沙箱化命令；critical 仍拒绝；
- Approval：自动命令不创建 `ApprovalRequest`；审计写入失败仍失败关闭；
- Contract/Renderer：只接受并提交 `ask | auto_approve`；
- SQLite：旧 `auto_low_risk` 行升级为 `auto_approve`，旧值在新约束下被拒绝。

## 剩余风险

当前 `run_command` 不是 OS 沙箱。选择“帮我批准”后，模型可以在没有逐条弹窗的情况下以当前 OS 用户权限执行命令，命令可能访问目录外文件、联网或启动子进程。固定 Shell、有限环境、超时、取消和审计不能替代 OS 隔离；发布级安全仍依赖后续 Sandbox Worker。
