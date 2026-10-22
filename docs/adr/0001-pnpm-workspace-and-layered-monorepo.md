# ADR-0001：pnpm workspace 与分层 monorepo

- 状态：Accepted
- 日期：2026-09-02

## 背景

Zimo 同时包含 Electron 三进程代码、领域/Application、多个基础设施 Adapter、共享 IPC 契约、UI 和测试工具。需要在一个仓库内保持可见依赖边界。

## 决策

使用 pnpm workspace；`apps/desktop` 是唯一 V0.1 应用，`packages/domain|application|contracts|adapters/*|ui|test-kit` 提供边界明确的包。用 TypeScript project references、package exports 和 ESLint boundaries 强制依赖方向。

## 结果

可以独立测试和替换 Adapter，Renderer 不能意外导入 Main 能力。代价是初期配置多、跨包修改需维护公共 API。V0.1 不引入 Nx/Turborepo；当 CI 构建时间成为可测量问题时复审任务编排工具。

## 替代方案

- 单包目录：起步快但边界只靠约定，拒绝；
- 多仓库：版本协调和本地开发成本高，V0.1 不需要。
