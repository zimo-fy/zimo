# 手动关闭浏览器后旧 CDP 连接阻断下一轮任务

## 症状与影响

用户在 Zimo 打开 Boss 页面后手动关闭浏览器，再发送浏览器操作指令，收到“浏览器操作失败，请确认 Zimo 浏览器仍在运行”。即使浏览器 Profile 可重新启动，本轮工具调用也未走到启动逻辑。

## 证据与根因

- 2026-10-12 本机日志中，上一轮 `browser_tabs/snapshot/screenshot` 成功；关闭窗口后下一轮 `browser_snapshot` 传入旧的 `target_boss`，`Target.getTargets` 立即以 `connection_unavailable` 失败，耗时 0ms。
- `LocalCdpBrowserGateway` 只在 `connection` 为空时获取 Profile 端点。浏览器退出后 WebSocket 对象仍保存在字段中，因此不调用已有的端点探测/重新启动流程。旧标签页 ID 也不应被当作新进程中的有效 ID。

## 修复

- 发命令前检查连接是否仍处于打开状态；失效时清除连接、活动标签页和快照缓存，再通过 Profile 端点探测重新连接。Profile 端点不可用时沿既有流程启动独立浏览器。
- 连接恰好在发送时断开，只对无 session 的只读 `Target.getTargets` 最多重试一次。点击、输入、导航、创建标签页等操作不自动重放，避免重复副作用。
- 重新连接后仍按真实标签页列表校验 `targetId`。旧 ID 返回 `BROWSER_TARGET_NOT_FOUND`，由现有模型 Tool Loop 提示重新调用 `browser_tabs`；不猜测或自动替换目标。
- 取消后不重连；最终 CDP 失败仍只记录方法名、固定原因枚举及耗时，不记录页面内容或参数。

## 验证与剩余风险

定向单测覆盖缓存连接已关闭、查询时竞态断线、旧 ID、非幂等命令不重放及取消不重试。真实可见 Chrome/Edge 手动关闭后重启、Profile 保留登录状态及 Windows 打包态仍需人工复测。模型若持续传旧 ID，现有错误恢复上限会终止运行。
