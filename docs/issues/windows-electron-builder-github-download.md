# Windows 打包时 Electron Builder 从 GitHub 重复下载失败

状态：已修复

## 现象与影响

`pnpm package:win` 已通过生产构建后，生成临时 Bytenode 编译器目录包时失败。日志显示 `downloading label=electron` 进度到 100% 后抛出 `RequestError` / `AggregateError`。

## 证据与根因

- 仓库 `node_modules/electron/dist` 已存在匹配的 Electron 44.1.1 运行时；
- Electron Builder 默认仍从 GitHub Releases 再下载一份同版本 zip；
- 当前网络无法稳定完成该 TLS 连接。

## 修复

- 新增 `scripts/resolve-electron-dist.mjs`，校验平台二进制和 version 与 lockfile 一致；
- `package-desktop-bytecode.mjs` 通过 `--config.electronDist` 复用该目录，跳过 GitHub 下载。

## 剩余风险

若本地 dist 缺失或版本不匹配，打包会明确失败，而不会回退到 GitHub。需要先通过可访问的 Electron 下载源或 `ELECTRON_MIRROR` 完成运行时安装。
