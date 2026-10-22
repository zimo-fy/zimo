# Windows 原生 alert/confirm 后无法聚焦输入框

状态：已修复

## 现象与影响

Windows 上在删除任务、卸载 Skill、确认退出工作流等场景点击原生 `alert`/`confirm` 后，会话输入框和其他输入控件无法获得焦点，必须切换窗口或重启应用才能继续输入。

## 证据与根因

- Renderer 使用 `window.alert` / `window.confirm`，由 Chromium 交给操作系统模态框；
- Electron 在 Windows 上关闭该模态框后，BrowserWindow 内的 webContents 有时不再接收焦点；
- 该问题只出现在原生对话框路径，应用内固定层（文档预览、更新提示）关闭后输入仍正常。

## 修复

- `@zimo/ui` 提供 `AppDialogProvider` / `useAppDialog()`，用 `role="alertdialog"` 的应用内对话框替代原生弹窗；
- 打开时在对话框内做焦点循环，Escape 取消确认；关闭时仅在焦点仍留在对话框内时归还触发器，避免抢走后续输入框焦点；
- Desktop App 根节点挂载 Provider，原先 1 处 alert 与 9 处 confirm 全部改为该 API。

## 回归验证

- 组件测试覆盖确定、Escape 取消和焦点归还；
- 相关 Electron E2E 改为点击「确定」，不再接收原生 `dialog` 事件。

## 剩余风险

系统文件选择器仍是操作系统对话框；若未来在选文件后出现同类失焦，需要单独处理 BrowserWindow 焦点恢复，而不是改回 `alert`/`confirm`。
