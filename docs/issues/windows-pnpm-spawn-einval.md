# Windows 打包时 spawn pnpm.cmd 失败

状态：已修复

## 现象与影响

在 Windows x64 执行 `pnpm package:win` 时，主机校验和 VC++ Redistributable 准备均成功，随后 `scripts/package-desktop-bytecode.mjs` 以 `spawn EINVAL` 立即退出，无法进入生产构建或生成安装包。

## 证据与根因

- Node 20+ 修复 CVE-2024-27980 后，Windows 上不能在 `shell: false` 时直接 `spawn("pnpm.cmd")`；
- 打包脚本原先把 Windows 的 pnpm 入口固定为 `pnpm.cmd`，且 `spawn` 未设置 `shell`；
- 本机 Node 22.20.0 因此在第一句 `pnpm run build` 前抛出 `Error: spawn EINVAL`。

## 修复

- 新增 `scripts/resolve-pnpm-cli.mjs`：优先用当前 Node 执行 `npm_execpath` 或 Node 安装目录旁的 `pnpm.cjs`；
- 仅在找不到 CLI 文件时，Windows 才回退到 `pnpm.cmd` 并显式 `shell: true`。

## 剩余风险

直接运行 `node scripts/package-desktop-bytecode.mjs` 且本机没有可解析的 `pnpm.cjs` 时，仍会走 `pnpm.cmd` + `shell: true`。该回退只用于受控构建参数。
