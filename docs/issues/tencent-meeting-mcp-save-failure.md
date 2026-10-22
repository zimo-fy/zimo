# 腾讯会议 MCP 测试成功但保存失败

## 现象

在 MCP 页面输入腾讯会议长期 Token 后，“测试连接”可以完成 `initialize` 与 `tools/list`，但点击“保存”只显示“操作未能完成，请稍后重试”。Main 日志中的实际错误为：

```text
CHECK constraint failed: authentication IN ('none', 'bearer', 'oauth')
```

## 根因

腾讯会议目录使用新增认证类型 `header_token`，用于由 Main 注入固定的 `X-Tencent-Meeting-Token` 和 `X-Skill-Version`。Contract、Domain、Application 和 MCP Gateway 已接受该类型，但已有用户数据库的 `mcp_connections.authentication` 仍由 `0015` 约束为 `none/bearer/oauth`。

连接测试不写数据库，因此能够成功；保存握手成功后写 SQLite，触发旧 CHECK 约束并回滚。这与 Token 内容和腾讯会议服务状态无关。

## 修复

`0018_mcp_header_token_authentication.sql` 重建 `mcp_connections`，将认证枚举扩展为 `none/bearer/oauth/header_token`。迁移在同一事务内：

1. 暂存 Agent 和 Workflow 的 MCP Server 绑定；
2. 复制全部既有连接、工具快照和 secret ref；
3. 重建外键关联表和索引并恢复绑定；
4. 不读取、复制或记录 SecretStore 中的真实凭据。

## 回归验证

SQLite 集成测试先执行至 `0015` 并保存既有 Bearer 连接，再在同一数据库应用 `0018`：旧连接必须完整保留，随后保存并读取 `header_token` 腾讯会议连接。Desktop 启动加载器也必须按版本 18 顺序包含该迁移。
