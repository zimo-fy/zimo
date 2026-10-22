# Electron 开发运行时缺失

状态：已修复

## 现象与影响

完成依赖安装或重建 `node_modules` 后执行 `pnpm run dev`，Renderer 开发服务器可以启动，但 electron-vite 在启动 Main 进程前抛出 `Error: Electron uninstall`。

## 证据与根因

故障环境中 `node_modules/electron` 包存在，但 `path.txt` 与 `dist/Electron.app` 不存在。Electron 44 会在模块入口首次加载时按需下载运行时；electron-vite 5 的启动检查则直接读取 `path.txt`，不会先加载 Electron 模块，因此无法触发下载并给出上述错误。

依赖安装被中断会更容易形成这种只有 JavaScript 包、没有平台运行时的状态。该问题与 Zimo 应用代码、Main 构建结果和系统是否安装过其他 Electron 应用无关。

## 修复

- desktop 的 `predev` 先运行 `scripts/ensure-electron-installed.mjs`；
- 脚本加载 Electron 官方模块入口，仅在平台运行时缺失时触发其下载逻辑；
- 下载结束后校验返回路径存在，再允许 electron-vite 启动；
- 下载失败时保留失败状态并显示不含本地敏感数据的排查提示。

## 回归验证

- 预检脚本在运行时已存在时成功退出；
- `pnpm run dev` 可以完成 Main、Preload、Renderer 构建并进入 `starting electron app...`；
- `pnpm format:check`、`pnpm lint` 与 `pnpm typecheck` 继续作为静态门禁。

## 剩余风险

首次安装 Electron 仍然需要能访问 Electron 下载源。代理、镜像或网络不可用时预检会明确失败，应用不会以缺少运行时的半安装状态继续启动。
