# ADR-0002：Electron 构建工具与安全基线

- 状态：Accepted
- 日期：2026-09-02

## 背景

Main、Preload 与 Renderer 需要不同构建目标，同时保证开发体验和生产安全配置不会分叉。

## 决策

使用 Electron + React + TypeScript，并以 electron-vite 统一构建 Main/Preload/Renderer；打包器在 Phase 1 比较 electron-builder 与 Electron Forge 后补充发布 ADR。生产通过自定义 `app://zimo` 协议加载本地资源。

所有窗口显式使用 `nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`、`webSecurity:true`。禁 WebView/未知导航/新窗口；CSP 默认仅 self；IPC sender 与 Schema 必须校验。

## 依据

electron-vite 为 Electron 三类入口提供统一 Vite 配置和隔离构建；Electron 官方安全清单要求隔离、sandbox、限制导航、校验 IPC sender，并建议自定义协议而非 `file://`。

- [electron-vite guide](https://electron-vite.org/guide/)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)

## 结果

开发构建简单，Renderer 可用 HMR；同时必须锁定并持续升级 Electron/electron-vite 版本。开发服务器 URL 只能来自开发构建常量，不能成为生产运行时配置。

## Phase 1 验证补充

Phase 1 锁定 Electron `44.1.1`、electron-vite `5.0.0` 和 Vite `7.3.6`。Main 最初使用 ESM；ADR-0016 为生产 Bytenode 字节码将其调整为 CommonJS bundle。由于窗口启用 sandbox，Preload 继续构建为完全打包的单文件 CommonJS `index.cjs`，但不启用需要关闭 sandbox 的字节码加载。生产 `app://zimo` 协议、CSP、导航限制、IPC sender 校验与 Renderer 无 Node 全局均已通过真实 Electron E2E。

开发态的 Vite React Refresh 会向页面注入 inline preamble，因此仅在存在受控 `ELECTRON_RENDERER_URL` 的开发进程中为 `script-src` 增加 `'unsafe-inline'`；生产 `app://zimo` 仍严格保持 `script-src 'self'`。两套策略由单元测试分别锁定。
