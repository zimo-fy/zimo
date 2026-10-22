# ADR-0016：Electron Main 使用 Bytenode 字节码保护

- 状态：Accepted
- 日期：2026-09-14

## 背景

Electron Builder 的 ASAR 主要用于归档，无法阻止直接提取 JavaScript。Zimo 的 Main bundle 包含大部分 Application、Adapter 和安全边界实现，需要在不降低 Renderer sandbox、IPC 和 SecretStore 控制的前提下提高静态源码提取成本。

## 决策

生产构建将 Main 固定输出为 CommonJS。打包先生成一个自动清理的临时目录应用，将受控编译器设为 Main 入口；临时应用使用锁定的 Bytenode 1.6.0 `compileCode`，在与最终应用相同的 Electron 44.1.1 打包态 Main 入口阶段生成压缩 `.jsc`。所有 chunks 成功后才把源 `.cjs` 替换为最小 Bytenode 加载器并执行最终 Electron Builder；产物校验失败会阻止最终包。

字节码必须在目标操作系统和架构上生成。`package:mac` 只接受 macOS，`package:win` 只接受 Windows x64。Electron/Bytenode 版本或目标平台变化必须重新构建和 smoke。

不保护 Renderer。Preload 继续保持 `sandbox:true`，不会采用要求关闭 sandbox 的字节码加载。开发服务器和普通 `pnpm build` 不执行 Bytenode 编译；发布必须使用项目提供的 `package:*` 两阶段命令。

Main CommonJS 输出关闭 Rollup `externalLiveBindings`。Transformers 仍打入受保护的 Main chunk，但不使用会对 Electron 内建模块 namespace proxy 读取缺失属性描述符的默认互操作包装；这避免本地 Embedding 延迟加载在 CJS 构建中失败。

## 依据

- Bytenode 对 Electron 42+ 要求使用真实 Main 进程编译，以匹配 Chromium V8 snapshot checksum；实测 Electron 44 的未打包与打包上下文 checksum 不同，因此必须在临时打包应用中生成最终字节码；
- electron-vite 的字节码文档明确限制为 Main/Preload，且 Preload 使用时需要关闭 sandbox；
- Bytenode 不支持 `Function.prototype.toString` 依赖，并警告字节码与 V8/平台兼容性，因此发布验证必须启动目标安装包。

参考：[Bytenode](https://github.com/bytenode/bytenode)、[electron-vite Source Code Protection](https://electron-vite.org/guide/source-code-protection)。

## 结果

安装包不再携带可直接阅读的 Main 业务 bundle，但新增 Bytenode 运行依赖、一次临时目录打包、构建时间和目标平台构建约束。字节码仍可能被动态分析，字符串也不天然保密；服务端秘密、SecretStore、签名、公证、ASAR 完整性和供应链治理仍是独立控制。

若依赖出现 V8 崩溃、`cachedDataRejected`、`Function.prototype.toString` 兼容问题或目标平台无法稳定启动，应阻止发布，不能静默回退到携带源码的安装包。
