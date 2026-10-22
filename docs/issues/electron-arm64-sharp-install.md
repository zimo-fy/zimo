# Electron ARM64 启动时无法加载 sharp

## 现象

在 x64/Rosetta Node 环境安装依赖、再使用 arm64 Electron 启动应用时，主进程可能在创建窗口前退出：`sharp` 只能找到 `darwin-x64` 原生包，无法加载 `darwin-arm64` runtime。Playwright 表现为 `electron.launch` 一直等待首个窗口。

## 根因

开发终端报告 `darwin-x64`，而 Electron 可执行文件为 arm64。pnpm 默认只物化当前 Node 架构对应的可选依赖，导致知识文档处理链依赖的 `sharp` 缺少 arm64 二进制。

## 修复

- `pnpm-workspace.yaml` 通过 `supportedArchitectures` 同时保留 macOS x64 与 arm64 可选依赖；
- 根 `package.json` 将 `sharp` 纳入 `onlyBuiltDependencies`；
- 重新执行 `pnpm install` 后，两个架构均可获得对应的 `sharp` 与 libvips 包。

## 验证

直接启动 Electron 不再输出 `Could not load the "sharp" module using the darwin-arm64 runtime`，完整 Electron E2E 四项通过。

## 注意事项

不要把本机 `node_modules` 打包或提交。CI 和新开发机必须从 lockfile 安装，并在 Electron 目标架构上执行启动 smoke。正式发布仍需分别验证 macOS arm64/x64 产物中的原生依赖。
