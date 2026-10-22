# ADR-0007：Intent Router 双阶段与强制降级

- 状态：Accepted
- 日期：2026-09-02

## 背景

Router 必须在聊天前低延迟识别 agent/skill/workflow，但 V0.1 不能自动执行，也不能因分类失败破坏聊天。

## 决策

Router 采用确定性规则优先、LLM 结构化分类后备。总预算默认 800ms，通过同一 AbortSignal 取消。LLM 输出由 Zod strict Schema 校验，只有 `confidence >= 0.7` 且 target 存在、启用时保留非 chat 意图；否则强制生成 chat fallback。`shouldExecute` 是 Schema 中的字面量 false。

规则只有在唯一明确命中时返回高置信结果。路由仅展示提示，普通聊天始终继续；未来执行能力必须新增 ADR、确认 UX 与权限模型，不能修改该字段绕过边界。

## 结果

用户体验可预测且故障隔离。800ms 可能不足以覆盖远端模型，Phase 4 用评估集测量 p50/p95、fallback rate 和准确率后复审；在此之前不靠延长超时掩盖服务选择问题。

## 修订（2026-09-21）

800ms 仍是聊天阻塞预算：超时降级为普通对话，但不再 abort 已发出的分类请求，以便把后续返回的 usage 补记到同一条助手消息。用户取消仍抛 `AbortError`、不转 fallback，同样不 abort 已发出的分类。
