# ADR-0003：SQLite、Drizzle 与 Repository 边界

- 状态：Accepted
- 日期：2026-09-02

## 背景

V0.1 需要版本化本地数据库、严格类型、事务和可测试 Repository。Node 的 `node:sqlite` 在当前文档中仍为 release candidate；原生驱动会增加 Electron ABI 打包成本。

## 决策

使用 SQLite + Drizzle ORM/Kit 生成类型与 migration。Phase 1 spike 首选 Electron 内置 Node 支持的 `node:sqlite` 驱动；若目标 Electron Node runtime 或稳定版 Drizzle 不兼容，则回退 `better-sqlite3` 并配置 native rebuild。只有 Adapter 看见 Drizzle/driver，Domain/Application 依赖专用 Repository 端口。

生产 migration 只执行提交到仓库的 SQL，不使用 `push`。数据库启用 foreign keys、WAL 和 busy timeout。

## 依据

Drizzle 支持 `node:sqlite` 与 `better-sqlite3`；Node 官方目前将 `node:sqlite` 标为 release candidate，因此必须在 Phase 1 用目标 Electron runtime 验证而非假定兼容。

- [Drizzle SQLite drivers](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)
- [Node SQLite](https://nodejs.org/api/sqlite.html)
- [SQLite WAL](https://www.sqlite.org/wal.html)

## 结果

减少手写映射错误并保留替换 driver 的能力。同步 SQLite 操作不得在 Main 执行大批长查询；若性能测试显示阻塞事件循环，则将数据库 Adapter 移入 utility process，端口不变。

## Phase 1 验证结果

选择 Electron 内置 Node runtime 的 `node:sqlite`，不引入 `better-sqlite3` 原生 ABI。Drizzle 锁定 `1.0.0-rc.4`，使用 `drizzle-orm/node-sqlite`；Electron `44.1.1` 的真实窗口测试以及 migration、会话和设置 Repository integration 测试均通过。

该 Adapter 仍为 RC 依赖。升级 Electron、Node 或 Drizzle 时必须重新运行 migration integration 和 Electron E2E；若 RC 行为无法接受，Repository 端口允许按原决策回退驱动。
