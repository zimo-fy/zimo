# 浏览器与云端模型 migration 版本 38 碰撞

## 症状与影响

已有浏览器能力数据的开发数据库启动时报 `Migration checksum mismatch for version 38`，应用无法完成数据库初始化。数据库内容未因该错误被删除。

## 证据与根因

2026-09-23 发布的 `0038_conversation_browser_capability.sql` 已在用户数据库的 `schema_migrations` 中登记为版本 38；账本名称及 SHA-256 与仓库文件一致。随后云端模型新增另一个 `0038_conversation_catalog_model.sql`，并在 Main 的 migration 列表中排到浏览器之前。加载器根据列表位置分配版本，因而把云端模型 SQL 当作版本 38，与旧账本的浏览器 checksum 冲突。

该顺序也可能已写入其他数据库：云端模型占 38、浏览器占 39，并已运行版本 40。两种历史顺序都要保留。

## 修复与兼容

- 固定浏览器 SQL 为版本 38；云端模型 SQL 内容不变，文件更名为 `0039_conversation_catalog_model.sql` 并排在浏览器之后；版本 40 为 `default-browser-capability`，版本 41 为 `knowledge-cloud-links`。
- 若开发库曾将 `knowledge-cloud-links` 记为版本 40，启动时在 checksum 精确匹配的前提下将其账本移至 41，再补跑版本 40 的默认浏览器 migration；不重放 knowledge SQL。
- 对已经按反向顺序写入的账本，启动时仅在名称和规范化 SQL checksum 精确匹配时，在单个事务中交换 38/39 的版本号；如果只有云端模型 38，则先将其移至 39，再应用浏览器 38。未知 checksum 不自动修复。
- 不重放已经执行的 SQL，不删除会话、模型或浏览器设置，也不直接覆盖 checksum。

## 验证与剩余风险

集成测试覆盖浏览器 38 旧库升级、云端模型先执行且浏览器未执行/已执行的两种旧库、重复启动，以及未知 checksum 拒绝。真实用户数据库只进行了只读诊断；应用内启动仍需用户复测。
