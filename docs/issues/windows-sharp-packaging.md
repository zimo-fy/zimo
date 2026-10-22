# Windows x64 安装后无法加载 Sharp

## 现象

在 macOS 执行 `pnpm package:win` 可以生成 Windows 安装包，但安装后 Electron Main 进程在创建窗口前退出，并报告无法使用 `win32-x64` runtime 加载 `sharp`。

## 影响

Windows x64 安装包无法启动。错误发生在主进程加载文档解析依赖时，尚未进入 Renderer，因此无法通过页面内错误状态恢复。

## 证据与根因

- 工作区的 `supportedArchitectures.os` 原本只有 `darwin`；
- pnpm 因此只物化 `@img/sharp-darwin-*` 与对应 libvips 可选包；
- 交叉生成的 `win-unpacked` 同样只有 Darwin Sharp 二进制，没有 `@img/sharp-win32-x64`；
- Windows Electron 运行时按 `win32-x64` 加载 Sharp，找不到目标原生模块后立即抛错。

锁文件包含 Windows 包记录不代表该可选依赖已经安装或进入产物。跨平台打包必须同时处理依赖安装目标和 Electron Builder 文件选择。

## 修复

- pnpm 同时物化 Darwin 与 Windows 的 x64/arm64 可选依赖；
- Electron Builder 显式解包 `sharp` 和 `@img`，满足 Sharp 的 Electron 打包要求；
- Windows x64 产物排除 Darwin 与 Windows arm64 Sharp 包；
- macOS 产物排除 Windows Sharp 包；
- 新增 `pnpm package:verify:win`，检查 Windows x64 Sharp 及其内置 libvips DLL 存在，且非目标 Sharp 包未进入产物。

修改 `supportedArchitectures` 后必须重新执行依赖安装，已有 `node_modules` 不会仅因配置改变自动补齐目标平台可选包。

## 验证与剩余风险

本机可以验证依赖物化、构建以及 Windows 产物结构。Windows 原生模块能否加载、应用能否启动，仍需在 Windows x64 干净环境执行安装和启动 smoke；macOS 上成功生成安装包不能代替该验收。
