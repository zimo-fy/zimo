# 桌面更新提示

应用菜单提供「检查更新…」。点击后左下角直接显示「已是最新版本」和当前安装版本。启动时不检查，也不下载或安装新版本。

## 运行流程

1. Windows 和 Linux 的入口在「帮助」；macOS 的入口在应用菜单「Zimo」。
2. 菜单点击调用 Main 的 `DesktopUpdateService.check(true)`。服务不访问任何远程更新源，立即发布 `up-to-date`。
3. 浮层只在用户主动检查后出现。关闭浮层不影响应用。
4. 安装 IPC 仍存在，但当前没有已下载的安装包，调用会拒绝。

更新状态契约仍包含 `disabled | idle | checking | downloading | ready | up-to-date | error`。当前检查只会发布 `up-to-date`。

## 打包与发布

仓库内未配置 Electron Builder `publish` 或固定 OSS/HTTPS 更新地址。正式恢复自动更新前，需新增 ADR、打包配置、签名与跨版本验证，并重新接入 `electron-updater`（或等价方案）。
