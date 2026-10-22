# Agent 人才库与安装

## 用户能力

Agent 页面将本机 Agent 与本地 Agent 目录合并为一个列表：

- 从 `apps/desktop/resources/agents/<目录名>/AGENT.md` 读取名称、分类、版本、简介和角色正文，不请求云端人才库接口；
- 已安装项目优先显示；未安装项目可直接安装，已安装项目可进入会话或卸载；
- 手动创建的本地 Agent 与人才库 Agent 在同一区域展示，仍可编辑、启停、使用和删除；
- 列表版本使用 `AGENT.md` frontmatter 的语义化版本，缺失时为 `1.0.0`；
- 安装完成后创建启用状态的本地 Agent，因此现有会话选择器、Agent 编辑器和 Workflow Agent 节点无需专用分支即可使用；
- 顶部“新建 Agent”继续创建本地 Agent，保存后直接回到统一列表，不依赖单独的旧列表区块。
- 新建/编辑 Agent 不显示标签输入；分类使用统一下拉，从当前本地 Agent 与人才库目录的分类去重生成。编辑时会额外保留该 Agent 的历史分类，避免目录变化导致值丢失。

## 执行链路

```text
Agent 页面
  → typed Preload API
  → strict Agent IPC Schema
  → AgentMarketplaceService
  → LocalAgentCatalogGateway
  → apps/desktop/resources/agents/<目录名>/AGENT.md

点击安装
  → Renderer 只提交 catalogId（目录名）
  → Main 重新读取同一个 AGENT.md
  → 正文保存为 systemPrompt，目录名同时写入 agent_catalog_id 与 agent_remote_id
  → 会话 / Workflow 从现有 Agent Repository 发现能力
```

仓库默认提供招聘协调助手、文稿编辑和资料研究助手。开发运行读取 `apps/desktop/resources/agents`；打包时该目录进入 `resources/agents`。“已安装”表示本机 SQLite 已经保存可运行的 Agent。卸载只删除本机记录，不修改源目录中的 `AGENT.md`。

## 安全与失败

- 目录只枚举配置根目录下带 `AGENT.md` 的直接子文件夹；符号链接和路径跳出不会进入列表；
- 角色正文限制 64 KiB，写入系统提示时最多 20,000 字符；Agent 运行使用用户在 Zimo 中选择的模型；
- 目录、安装和卸载均有超时并随窗口关闭取消；
- 卸载不再检查会话或 Workflow 引用；本地删除事务自动清理会话绑定并禁用引用该 Agent 节点的 Workflow；
- 普通审计仅记录 catalog ID、local Agent ID、结果和错误码，不记录本地路径或角色正文。

## 验证

- Adapter 单测覆盖本地目录列出直接子 Agent、安装读取同一 `AGENT.md`、符号链接和路径跳出被拒绝，以及云端 Gateway 不发起请求；
- Application 单测覆盖目录合并、安装落库（含目录版本）、直接卸载和失败补偿；SQLite integration 覆盖引用级联清理；
- SQLite 集成测试覆盖两个远端关联 ID 跨重启恢复；
- Electron E2E 覆盖人才库展示、分类下拉、无标签表单、安装后进入本地 Agent 列表及数据库不含远端模型密钥。
