# ADR-0006：UI 基础组件与工作流画布

- 状态：Accepted
- 日期：2026-09-02

## 背景

Zimo 需要 Apple/Notion 风格的克制视觉、可访问组件，以及 Phase 3 可拖拽/连接但不执行的工作流画布。

## 决策

使用 Tailwind CSS 定义 token 和布局；应用级 `packages/ui` 以原生 HTML 优先，复杂交互（Dialog、Select、Tabs、Tooltip 等）基于 Radix Primitives 包装，业务代码不直接散用 Radix。图标采用单一开源线性图标集，Phase 1 锁定具体包。

工作流画布使用 `@xyflow/react`，但只保存 Zimo 自有 `WorkflowDefinition`；React Flow nodes/edges 由 Renderer mapper 生成，不能持久化库对象。V0.1 的 run/debug 明确标为预览。

V0.1 交付浅色主题；token 预留 dark 语义变量，但深色主题不进入验收范围。

## 依据

Radix 提供无样式、可访问的低层 primitives；React Flow 提供节点拖动、连接、缩放等画布基础能力。

- [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [React Flow quick start](https://reactflow.dev/learn)
- [Tailwind installation](https://tailwindcss.com/docs/installation/framework-guides)

## 结果

视觉由 Zimo token 控制，同时避免重复实现复杂焦点管理。包装层需写 component/a11y tests；React Flow 样式和坐标变更由 mapper 隔离。
