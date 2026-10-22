# ADR-0004：操作系统保护的秘密存储

- 状态：Accepted
- 日期：2026-09-02

## 背景

模型 API Key 不能出现在 Renderer、普通配置、SQLite 明文或日志中，同时桌面平台的安全存储能力不同。

## 决策

定义 `SecretStore` 端口，V0.1 Adapter 使用 Electron `safeStorage` 的异步 API加密秘密，将密文保存在 Main 管理的独立 secrets 文件；SQLite 只存随机 `secretRef` 与脱敏 hint。

启动后检查加密可用性。Linux 检测到弱/不可用后端或任一平台加密不可用时，禁止持久化 API Key，只允许当前连接测试在内存中短暂使用。绝不调用强制明文模式。macOS 发布构建必须稳定签名以避免 Keychain 身份漂移。

## 依据

Electron `safeStorage` 使用平台密码系统并提供异步 API和可用性检测；官方特别说明 Linux 后端差异和 macOS 签名要求。

- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)

## 结果

秘密不进普通数据库，且未来可换原生 keychain/企业 vault。密文文件与数据库需用补偿事务维持 ref 一致。`safeStorage` 不是同一账户下恶意进程的完整防护，UI 和威胁模型必须说明平台差异。
