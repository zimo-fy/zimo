# Windows 启动时 Migration checksum mismatch

- 状态：Fixed
- 日期：2026-09-15
- 影响范围：在不同换行符环境构建或运行过的桌面应用数据库

## 现象

Windows 安装包启动时，Main 在窗口创建前打开用户数据目录中的 `zimo.sqlite`，并报
`Migration checksum mismatch for version 1`。重新安装应用不会删除 Electron `userData`
目录，因此旧 migration 账本仍会被新安装包读取。

## 根因

历史 migration 文件没有被修改，但仓库此前未通过 `.gitattributes` 固定 SQL 文件的换行符。
Vite `?raw` 会按 UTF-8 原样读取 migration，旧实现又直接对该字符串计算 SHA-256。因此同一份
SQL 在 LF、Windows CRLF 或带 UTF-8 BOM 的检出环境中会产生不同 checksum，被误判为历史
migration 被篡改。

## 修复

1. migration 执行与新 checksum 统一使用“移除开头 UTF-8 BOM、换行符转为 LF”的规范文本；
2. 已存在的账本 checksum 仅在它能匹配同一规范 SQL 的 LF、CRLF、CR 或对应 BOM 变体时，
   原地更新为规范 checksum，不重复执行 migration；
3. 其他 SQL 内容产生的 checksum 仍拒绝启动，不放宽 migration 完整性校验；
4. `.gitattributes` 固定 `migrations/*.sql` 为 LF，避免后续 Windows 检出再次产生平台差异；
5. 将 migration 生命周期从超限的 SQLite 聚合入口提取到独立领域模块。

## 验证范围

- 集成测试覆盖 CRLF、CR、BOM + LF、BOM + CRLF 的旧账本自动修复；
- 集成测试确认不同 SQL 内容的 checksum 仍然报错；
- 60 个文件/237 项单元测试、12 个文件/25 项集成测试和 production build 通过；
- Windows x64 安装包仍需在目标构建机重新生成，并用原报错数据库完成启动 smoke。

用户数据无需删除。安装包含此修复的新包后，第一次启动会完成等价 checksum 归一化。
