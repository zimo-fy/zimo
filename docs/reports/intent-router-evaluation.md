# Intent Router V0 基础评估

日期：2026-09-03  
环境：本地 Node.js 22，确定性 fake classifier，无网络请求  
样本：10 条中英文规则、普通聊天和降级 fixture

## 结果

| 指标                  |          结果 |
| --------------------- | ------------: |
| 样本准确率            | 100%（10/10） |
| fallback rate         |   40%（4/10） |
| p50                   |       0.276ms |
| p95                   |       3.409ms |
| `shouldExecute=false` |         10/10 |

四个预期 fallback 分别覆盖低置信度、缺失目标、非法 Schema 和禁用目标。中英文明确命名 Agent、Skill、Workflow 的样本覆盖本地规则；普通问候与知识问答覆盖 LLM chat 分类。

## 解读

这些延迟只衡量 Router 编排、规则、Schema 与 fake classifier，不代表公网模型延迟。它证明本地开销远低于 800ms，但不能证明任何真实端点都能在预算内完成。真实 OpenAI-compatible smoke 为可选人工验证；超出预算时产品行为固定为 timeout fallback 并继续聊天。

评估实现位于 `packages/application/src/intent-router.evaluation.test.ts`，可通过以下命令复现：

```bash
pnpm exec vitest run --config vitest.config.ts packages/application/src/intent-router.evaluation.test.ts --disableConsoleIntercept
```
