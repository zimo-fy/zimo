# Skill Store 与安装状态

## 用户能力

Skill 页面现在合并展示本地 Skill 目录和本机已安装的 instruction Skill：

- 从 `apps/desktop/resources/skills` 读取每个直接子目录中的 `SKILL.md`，不请求云端目录接口；分类取自包内 manifest 或 frontmatter，缺失时为“本地”；
- 支持名称、描述和分类搜索；
- 分类使用紧凑横向导航，隐藏系统滚动条，并在溢出时提供左右翻页按钮；
- 页面只显示“已安装”和“未安装”两种状态；
- 所有筛选和搜索结果都优先展示已安装 Skill，同一状态内保留目录原有顺序；
- 未安装 Skill 可直接安装，已安装 Skill 可重新安装以同步本地目录中的完整包，也可卸载；
- 本地文件夹安装的 Skill 仍会出现在“已安装”分类；
- Skill 卡片使用高密度响应式布局，只展示名称、分类、版本、简介和安装状态，不展示来源字段；
- 卡片版本使用包内 manifest 或 frontmatter 的语义化版本，缺失时为 `1.0.0`；
- 安装后的 Skill 自动处于可用状态，可在 Agent 编辑器和 Workflow Skill 节点中选择；
- Skill 可直接卸载；会话和 Agent 绑定自动移除，仍引用该 Skill 节点的 Workflow 自动禁用但保留编排。

当前 Skill 的创建入口是上传至少包含非空 `SKILL.md` 的本地包；`manifest.json` 可选且只尽力读取安全展示字段，不再作为安装校验条件。缺少元数据时从 `SKILL.md` frontmatter、一级标题和文件夹名推导，分类默认“本地”。页面不提供只保存元数据、但缺少 `SKILL.md` 和脚本资源的空 Skill 表单。共用作者编辑器已约束为不输入标签，并从当前 Skill 分类中选择；正式开放可用的可视化作者流程时，还需一并设计指令正文、包文件、审核和签名链路。

## 执行链路

```text
Skill 页面
  → typed Preload API
  → strict Skill IPC Schema
  → SkillMarketplaceService
  → LocalSkillCatalogGateway
  → apps/desktop/resources/skills/<目录名>/SKILL.md

点击安装
  → 只提交 catalogId（目录名）
  → Main 在同一本地目录中重新解析该 Skill
  → LocalInstructionSkillPackageReader 读取完整包
  → InstructionSkillInstallationService
  → SQLite Skill Repository + userData/accounts/local/skill-runtime
```

Agent、会话和 Workflow 不直接访问 Skill Store。它们读取 SQLite 中的 `skillInstructions`，并根据本机完整包动态注册脚本 Tool。旧版只安装了 instruction 的 Skill 需点击一次“重新安装”。

## 安全限制

- 完整包只写入应用受管目录，运行副本和业务数据按 Skill ID 隔离；
- 只允许已绑定、已安装清单中的 Python/Node 脚本；不执行 Shell、依赖安装或 Hook；
- 目录项和 `SKILL.md` 均有大小/数量限制；本地 manifest 中的命令、Hook、依赖和未知字段不会被解释或执行；
- 目录只枚举配置根目录下的直接子文件夹；符号链接、路径跳出和缺少 `SKILL.md` 的子目录不会进入列表；
- 普通日志只记录 Skill/Package ID、结果和错误码，不记录本地目录路径、`SKILL.md` 或包内容；
- 列表直接读取本地目录，不请求 `/ai/skill/zimolist`；打包后的应用仍不包含该目录，因此安装包中的 Skill 页面找不到目录。脚本运行边界见 ADR 0013。

## 验证

- Adapter 测试覆盖本地目录只列出直接子 Skill、安装时读取同一目录、符号链接和路径跳出被拒绝；
- Application 测试覆盖目录项与已安装 Skill 合并、安装状态和直接卸载；SQLite integration 覆盖引用级联清理；
- Electron E2E 覆盖本地目录分类、本地安装、两态 UI 和卸载。本次未重跑 E2E。
