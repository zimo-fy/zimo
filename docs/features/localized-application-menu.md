# Electron 中文应用菜单

状态：已实现
日期：2026-09-08

## 用户体验

Zimo 显式提供中文 Electron 应用菜单，不再依赖 Electron 按操作系统生成的英文默认菜单。菜单保留文件、编辑、视图、窗口和帮助等桌面应用常用操作；macOS 额外保留应用菜单。

“开发者工具”用于打开 Chromium DevTools，只在通过 `electron-vite dev` 启动的开发环境显示。普通构建、本地预览和正式安装包均不创建该菜单项；即使安装包进程带有开发服务器环境变量，也不能启用它。

## 实现边界

- 菜单动作使用 Electron 内置 role，保留各操作系统的标准快捷键和原生行为；
- 开发模式要求应用未打包且存在 electron-vite 注入的 `ELECTRON_RENDERER_URL`；
- 本功能不新增 IPC、Renderer API、权限、依赖或持久化数据；
- 重新加载仍是普通视图操作，DevTools 入口则按运行模式完全省略。

## 验证

- 单元测试覆盖 macOS/Windows 中文菜单结构和开发者工具的显隐；
- Electron E2E 在生产式构建启动中确认中文顶级菜单存在，且没有 `toggleDevTools` role。
