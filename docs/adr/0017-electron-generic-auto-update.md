# ADR-0017：Electron generic HTTPS 自动更新

状态：Superseded（2026-10-19 移除远程更新源配置）  
日期：2026-09-15

## 2026-10-19 修订

客户端不再执行启动检查、下载或安装。「检查更新…」只提示当前安装版本已是最新版本，不访问任何远程目录。Electron Builder `publish`、固定 OSS URL 与 `electron-updater` 依赖已从仓库移除。若将来恢复自动更新，应通过新 ADR 重新选定发布通道、签名策略与 IPC 边界，不得复活历史硬编码 URL。

## 历史决策（仅供归档）

曾计划使用 `electron-updater` 与 Electron Builder generic provider，由 Main 独占检查、下载与安装，Renderer 仅经严格 IPC 接收有界状态。macOS 使用 ZIP 与 `latest-mac.yml`，Windows 使用 NSIS 与 `latest.yml`，并依赖清单 SHA-512 与平台代码签名。该方案未在仓库中保留具体 HTTPS 更新根地址。
