# 会话添加文档无反馈

## 症状与影响

Renderer 热更新出现“添加文件”入口后，点击系统选择器或把文件拖入聊天窗口可能没有任何可见反馈；附件不会显示，错误也没有呈现。用户无法判断操作是否开始、失败或需要重启。

## 证据与复现

- 运行中的用户数据库不存在 `document_artifacts` 表，说明新增 `0022` migration 尚未由 Electron Main 进程执行；
- 同期普通日志没有 `document.import.completed`，说明请求未进入新版 Main handler；
- 点击和拖放共用 `window.zimo.artifacts`，旧 Preload 没有该具名桥接；Renderer 对桥接缺失和 `ipcRenderer.invoke` 拒绝没有 `try/catch`；
- Electron Renderer 可以热更新，但新增 Preload/Main API、IPC handler 和 migration 必须完整重启桌面进程。

## 根因

这是跨 Renderer、Preload、Main 和 migration 的开发态版本漂移。新 Renderer 已显示入口，运行中的 Preload/Main 仍是旧版本。调用不存在的 bridge/channel 会拒绝 Promise，而附件事件处理器只处理 `IpcResult`，没有处理 Promise rejection，因此 UI 静默失败。

## 修复

- 新增 `useChatArtifacts`，统一管理加载、选择、拖放、移除和导出；所有桥接调用均捕获异常并显示“完全退出并重新启动 Zimo”的安全提示；
- 文件处理期间在输入框下方显示 `正在添加文件…`，成功后在同一区域显示紧凑附件项；
- “添加文件”移动到能力菜单底部，改为小号灰色次级操作，不与 Agent、Skill、知识库、Workflow、MCP 争夺视觉优先级；
- 完整重启后 Main 会应用 `0022` migration 并注册文档 IPC，正常导入继续使用既有安全校验。

## 回归覆盖

- Hook 组件测试覆盖缺少新版 artifact bridge 时显示重启提示；
- 附件组件测试覆盖导入中反馈、成功展示、移除和导出；
- 继续运行文档文件 Adapter、SQLite 消息绑定、Desktop typecheck、build 和 Electron E2E。

## 剩余风险

Electron-vite 无法让已创建窗口中的 contextBridge 原地增加新 API；涉及 Main/Preload/migration 的开发改动仍必须完全退出并重启应用。该限制属于 Electron 进程生命周期，不应通过放宽 IPC 或绕过 migration 解决。
