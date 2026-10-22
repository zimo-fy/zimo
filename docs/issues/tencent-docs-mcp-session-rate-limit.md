# 腾讯文档 MCP 重复初始化触发 429

- 状态：已修复
- 日期：2026-09-14
- 影响范围：会话与 Workflow Agent 中的连续 MCP Tool Calling

## 现象与证据

腾讯文档连接测试和工具快照刷新正常，PPT 创建及多个编辑 Tool 也能成功，但紧邻的下一次调用偶发提示“无法连接 MCP 服务”。安全诊断记录失败发生在 `connect` 阶段，HTTP 状态为 429，距离上一个成功 Tool 只有 64ms；该 Tool 的 `tools/call` 尚未执行。

失败前滚动 60 秒内只有 5 次腾讯文档 Tool 尝试，未达到腾讯文档公开的 `fileID 150 次/分钟` 或 `openID 300 次/分钟`。原实现每次 Tool 都新建 Session，重复执行 MCP `initialize`，扩大了 MCP 网关连接请求数量和突发频率。

## 根因

Zimo 的 Gateway 原先将 Session 生命周期限定为单个 `tools/call`，而模型 Tool Loop 会连续调用多个工具。每次调用都执行 `connect/initialize → tools/call → close`，没有利用 Streamable HTTP 的有状态 Session，容易触发 MCP endpoint 独立于 OpenAPI 业务接口的连接频控。

## 修复

- Gateway 按可信 `runId + serverId` 复用已经初始化的 Session；
- `runId` 从受控 Tool 执行上下文传递，不接受 Renderer 提供的 Session key；
- `runModelToolLoop` 在 `finally` 中统一关闭本轮 Session，覆盖成功、失败和取消；
- 传输失败时立即从池中淘汰并关闭 Session，下一次调用重新连接；
- 不跨 Conversation/Workflow 运行或应用重启复用，不持久化 Session 或凭据。

## 回归覆盖

- 同一运行连续两个 Tool 只创建和初始化一个 Session；
- 运行结束后 Session 关闭；
- 失败 Session 被淘汰，下一次调用重新建立连接；
- Tool Loop 正常完成和异常退出都调用运行清理。

## 剩余风险

腾讯文档仍可能对 `tools/call`、单个 OpenAPI、用户或文件设置频控。Session 复用只消除重复初始化，不替代对 HTTP 429 `Retry-After`、异步进度轮询间隔和幂等重试策略的后续支持。
