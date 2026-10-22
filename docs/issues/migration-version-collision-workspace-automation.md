# Workspace 与 Automation migration 版本碰撞

状态：已修复

## 现象与影响

曾运行 Automation 或 Phase 9 工作目录开发构建的数据库在合并后可能无法启动，Main 抛出 `Migration checksum mismatch for version 25` 或 `version 26`。应用不会继续打开正常主界面，以避免在未知 Schema 上写入数据。

## 证据与根因

- 旧开发数据库把 `automation-scheduler` 和 `automation-daily-time-window` 分别记录为 25、26；
- 合并会话工作目录功能后，正式 migration 序列变为 `conversation-workspace-grants` 25、Automation 26/27；
- 旧 25/26 的 SQL checksum 分别与当前 26/27 完全一致，但 migration 账本没有同步顺延；
- 当前 25 的 Workspace SQL 与旧 25 的 Automation SQL 不同，因此 checksum 保护按设计拒绝启动。
- 另一条已确认的开发历史先落地 Workspace 25，再将 Phase 9 审批/审计/授权 migration 写为 26–29；合并 Automation 后正式序列改为 Automation 26–27、Phase 9 28–31，因此首先在 26 冲突。
- 用户实际账本的旧 Phase 9 名称和 checksum 与当前 28–31 SQL 逐项精确匹配，不是 migration 内容被篡改。

## 修复

数据库 migration 执行器在常规 checksum 校验前识别这一条已知旧序列。只有名称和规范化 SQL checksum 都与当前 Automation 26/27 精确匹配、且版本 27 未被占用时，才在事务中将旧 26 移到 27、旧 25 移到 26，随后由正常流程执行 Workspace 25。

只执行过旧 25 的中间数据库同样受支持。名称、checksum 或目标版本任一不符合预期时不做协调，仍返回原始 checksum mismatch；修复不会覆盖 checksum，也不会重新执行已经落地的 Automation SQL。

对旧 Phase 9 26–29 序列，执行器先与当前 28–31 的名称和规范化 SQL checksum 逐项匹配，再在一个事务中倒序将已应用账本版本整体加 2。随后由常规流程应用 Automation 26–27；Phase 9 SQL 不重复执行。只完成旧 Phase 9 前 1–4 步的中间状态均受支持，但任一 checksum 不符或目标版本被非源记录占用时仍失败关闭。

## 回归覆盖

- 完整旧 25/26 序列升级到当前 25/26/27；
- 只执行旧 25 的中间状态升级；
- 名称相同但 SQL checksum 不同的状态继续拒绝。
- 旧 Phase 9 序列分别已执行 1、2、3、4 步时升级到当前 25–31；
- 用户真实数据库的临时副本执行完整 `0001–0031` smoke，账本正确收敛为 Workspace 25、Automation 26–27、Phase 9 28–31；
- 旧 Phase 9 同名但 checksum 不同时继续在 version 26 拒绝。

## 剩余风险

该兼容逻辑只处理已确认的开发历史序列。其他 migration 冲突仍需要独立取证和显式兼容规则，不能复用此分支自动改写账本。
