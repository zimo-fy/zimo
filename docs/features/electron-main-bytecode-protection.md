# Electron Main 字节码保护

## 目标

Zimo 的生产构建使用 Bytenode 将 Electron Main 业务 bundle 转换为 V8 字节码，减少安装包中可直接阅读的模型、数据库、Workflow、Skill、MCP 和通信渠道实现源码，提高静态逆向与直接复制的成本。

该能力不改变开发模式、Renderer/Preload 权限、IPC 或产品数据格式。

## 构建流程

1. electron-vite 把 Main 固定构建为 CommonJS 入口和 chunks；
2. Electron Builder 生成一个自动清理的临时目录包，其 Main 入口是受控编译器；
3. 临时包中的最终形态 Electron 加载 Bytenode 1.6.0，在入口早期一次性生成全部压缩 `.jsc`；
4. 所有 bundle 编译成功后，原 `.cjs` 被替换为只加载 Bytenode 和对应 `.jsc` 的最小入口；
5. 产物检查确认加载器/字节码一一对应，不存在 `.js`/`.mjs`、source map、异常加载器或空字节码；
6. Electron Builder 只在上述步骤成功后生成最终应用，临时编译器包始终清理。

任一编译步骤失败会删除本轮不完整 `.jsc` 并以非零状态结束，不继续生成安装包。

## 平台与兼容性

字节码必须由目标应用实际使用的打包态 Electron/V8 在目标操作系统和架构上生成。未打包 Electron 与最终应用即使版本相同，也可能使用不同的 V8 snapshot checksum，因此不能用普通开发 Electron 直接生成发布字节码。macOS 包只能在 macOS 构建；Windows 包当前只能在 Windows x64 构建。升级 Electron、Bytenode、V8 或切换架构后必须重新构建并执行打包态启动 smoke，不能复用历史 `.jsc`。

Main 输出使用 CommonJS，因为 Bytenode 的模块加载依赖 CommonJS 包装。Preload 保持 `sandbox:true`，不会为了字节码关闭 sandbox；Renderer 不支持该字节码机制。

Transformers 保持打入 Main 延迟加载 chunk；Main 的 CommonJS 输出关闭 Rollup `externalLiveBindings`。原因是 Electron 的部分内建模块通过 namespace proxy 暴露可枚举键，Rollup 默认实时绑定包装会假定每个键都有属性描述符，导致本地 Embedding 首次加载失败。该配置已通过 Electron 中的 512 维真实推理回归验证。

## 验证

```bash
pnpm package:dir
pnpm package:verify:bytecode
pnpm package:verify:mac
```

Windows 在目标构建机执行 `pnpm package:win`、`pnpm package:verify:bytecode`、`pnpm package:verify:win`，然后完成安装与启动验证。

## 安全边界

Bytenode/V8 字节码是源码保护和混淆措施，不是加密、签名、DRM 或安全执行环境。攻击者仍可能分析加载器、字符串、Renderer、Preload、运行时内存或修改未签名安装包。API Key、Token、私钥和长期秘密不得硬编码，继续通过 SecretStore 或服务端保存。

正式外部分发仍需要代码签名、公证、ASAR 完整性、依赖审计和 SBOM。
