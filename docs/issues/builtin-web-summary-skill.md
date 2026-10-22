# 内置网页摘要 Skill 数据不完整

- 状态：Resolved
- 日期：2026-09-07
- 错误码：`AGENT_SKILL_NOT_AVAILABLE`

## 现象

Agent 可以在编辑页绑定显示为“已安装、已启用”的内置“网页摘要”Skill，但在会话中确认执行 Agent 后提示“Agent 绑定的部分 Skill 未安装或未启用”。

## 根因

早期内置原型数据只给“网页摘要”设置了 `installationStatus: installed` 和启用状态，没有提供 instruction Skill 运行必需的 `skillPackageId`、`skillInstructions` 和 `skillChecksum`。Agent 保存校验只检查安装与启用状态，而运行时还检查非空指令，造成保存成功、执行失败的不一致。

## 修复

- 为内置“网页摘要”补全稳定 package ID、指令、checksum 和能力声明；
- Agent 保存校验与运行校验统一要求非空 Skill 指令；
- 应用启动时识别稳定内置 Skill ID，幂等补全旧 SQLite 记录；
- 兼容修复只补运行字段，不覆盖用户现有的启用和安装状态，也不要求删除数据库。

## 回归保护

种子仓库测试保证内置“网页摘要”始终携带可执行指令；启动兼容测试保证旧记录得到补全且用户状态保持不变；Agent 运行测试继续覆盖 Skill 指令进入最终模型请求。
