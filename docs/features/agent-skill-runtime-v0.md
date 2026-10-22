# Agent + Skill Runtime V0

## 目标闭环

V0.2 按以下顺序交付：

1. 本地导入 instruction Skill；
2. 校验、安装、升级、启用并跨重启恢复；
3. Agent 选择模型、编写 System Prompt、绑定已安装 Skill；
4. 在 Agent 编辑页测试，在聊天中手动选择或 `@Agent`；
5. 用户选择 Agent 后，将其作为会话默认执行能力；
6. 保存 AgentRun 和事件记录；
7. 最后才允许 Router 建议执行，Router 本身不越过确认步骤。

## 当前实现：Phase 5

Phase 5 建立 Agent/Skill SQLite 目录、本地 instruction Skill 安装入口和会话 Agent 绑定运行。当前只强制要求包根目录存在非空 `SKILL.md`；`manifest.json` 已改为可选的兼容元数据。存在时可使用以下字段：

```json
{
  "schemaVersion": 1,
  "kind": "instruction",
  "packageId": "local.example.summary",
  "name": "本地摘要",
  "version": "1.0.0",
  "description": "总结用户提供的文本",
  "category": "写作",
  "tags": ["摘要"],
  "permissions": ["context:user-input"],
  "entry": "SKILL.md"
}
```

Manifest 缺失、JSON 无效、字段缺失或含未知字段都不会阻止安装。安装器会依次从可用 manifest 字段、`SKILL.md` frontmatter、首个一级标题和文件夹名推导展示元数据，默认版本 `1.0.0`、分类“本地”、标签为空、权限 `context:user-input`，并基于本地目录生成不暴露路径的稳定 package ID。再次从同一目录安装会保留 Zimo 实体 ID 和关联关系，并更新指令与 checksum。

内置“网页摘要”同样按 instruction Skill 提供稳定 package ID、非空指令和 checksum。应用启动时会幂等修复早期版本已写入 SQLite、但缺少 instruction 字段的内置记录，同时保留用户设置的启用和安装状态。

Agent 可选择模型并绑定已安装 Skill。聊天页手动选择或接受 Router 建议后，会先通过独立的会话绑定 IPC 校验并保存 Agent；后续消息直接从会话读取 Agent，编译其 System Prompt 与 Skill 指令并进入现有模型流。发送 IPC 不接受临时 Agent ID，Router 的 `shouldExecute` 仍固定为 false，因此 Router 只能建议、不能自行绑定或执行。

聊天中选择的 Agent 作为会话默认能力写入 SQLite，选择动作即代表授权该会话后续消息使用该 Agent。会话也可直接多选已安装 instruction Skill；直接 Skill ID 独立持久化，运行时与 Agent `skillIds` 去重合并。切换会话或应用重启后从会话详情恢复。取消 Agent 不会删除会话直接 Skill；Agent 自带 Skill 在菜单中标记为“随 Agent”。Tool/MCP 仍按各自权限策略校验。

运行时会在 Model Gateway 调用前写入安全的 `model.request.prepared` 诊断事件。事件列出实际 Agent、Skill package/version、知识库和消息角色/长度，可用于核对绑定是否生效；它不会持久化用户消息、System Prompt、Skill 指令或知识正文。

除下述受限 Skill Store 增量外，当前仍不包含脚本、依赖或 Router 自动执行。

## Zimo Skill Store 增量

Skill 页面的目录列表现在读取 `apps/desktop/resources/skills`，不请求云端目录接口。点击安装仍通过既有安装服务把该本地目录写入 instruction Skill Repository 和 `skill-runtime`。Skill 页面不再提供草稿、启用或禁用操作；安装即启用。脚本运行边界见 ADR 0013。

## 后续验收切片

- Phase 6：知识检索、受控 Tool/MCP、Workflow/LangGraph。
