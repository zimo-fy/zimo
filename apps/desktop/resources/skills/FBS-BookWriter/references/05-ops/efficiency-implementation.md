# 增效措施落地说明（多智能体 / 联网 / 记忆）

> 与 [`doc-code-consistency.md`](./doc-code-consistency.md) 配合阅读。

## 策略（面向长文档、时效性、专业性）

| 维度 | 策略 | 代码落点 |
|------|------|----------|
| **联网** | S0 用 **并行多查询** 覆盖竞品/读者/变现；每章用 **门禁检索**（次数见 `search-policy.json`），结果写入 **JSONL 账本** 可审计；单次 `webSearch` **默认 15s 超时**（防检索挂死），同一运行内超时域名不再访问；同域名日内超时≥3 次则一周内不再访问，并持久化到 `.fbs/domain-blocklist.json`；`BookWorkflowOrchestrator({ searchTimeoutMs })` 可覆盖 | `integration/lib/SearchBundle.js`、`WebSearchLedger.js` |
| **质量门禁** | S2→S3 显性确认、每 5 章中检、章节质量门禁（结构偏差率/AI 味/来源精确化）、S5 发布门禁；结果写入 `.fbs/quality-gate-ledger.jsonl` | `integration/lib/BookWorkflowOrchestrator.js` |
| **多智能体** | 单宿主内 **串行角色**：检索门禁 → `writer` → `critic_*`；各角色为宿主注入的 **async 函数**，未注入则返回待办提示（不假装已审稿）；**每个已注入角色单步默认 300s 超时**（`roleStepTimeoutMs`，传 **0** 关闭） | `integration/lib/MultiAgentPipeline.js`、`BookWorkflowOrchestrator.runChapterWithAgents` |
| **记忆 / 降 token** | 成书项目生成 **`FBS_CONTEXT_INDEX.md`**，用 `@技能根/单文件` 拉规范；配合 `.codebuddy/rules` 条件注入 | `scripts/generate-book-context-index.mjs`、`apply-book-memory-template.mjs` |
| **默认写书引擎** | 宿主将 `workflowEngine` 设为 `BookWorkflowOrchestrator`，并注入 `webSearch`（及可选 `bookRoot` 写账本） | `integration/lib/BookWorkflowOrchestrator.js` |

## API 速览（CommonJS）

```javascript
const {
  createDefaultBookWorkflowEngine,
  runProfessionalChapterPipeline,
} = require('./integration/lib');

const engine = createDefaultBookWorkflowEngine({
  skillRoot: '/path/to/FBS-BookWriter',
  bookRoot: '/path/to/my-book', // 可选，启用 .fbs/search-ledger.jsonl
  logger: console,
  searchTimeoutMs: 15000, // 可选；默认 15000，单次 webSearch 超时会记失败并写账本
  roleStepTimeoutMs: 300000, // 可选；默认 300000（5min）/ 步；0 = 关闭 agents.* 单步超时
});
engine.registerSkillServices({ webSearch: hostWebSearchFn });

await engine.runS0ParallelResearch('本书主题');
await engine.runChapterResearchGate('CH-01', '本章论点');
await engine.execute({ mode: 'confirm_outline', payload: { approvedBy: 'user' } }); // S2→S3 显性确认
await engine.runChapterWithAgents('CH-01', '本章论点', {
  writer: async (ctx) => ({ draft: '…' }),
});
const q = await engine.execute({
  mode: 'chapter_quality_gate',
  payload: {
    draft: '示例正文',
    citations: [{ org: '机构', report: '报告', url: 'https://example.com' }],
    chapterPlan: { requiredAnchors: ['关键词A'] },
  },
});
const release = await engine.execute({
  mode: 's5_release_gate',
  payload: {
    qualityReport: true,
    dataFreshnessTable: true,
    totalScoreConverted: 7.8,
    bLayerScore: 4.2,
    deletionRiskConfirmed: true,
    publishConfirmed: true,
    hasAcademicRisk: false,
  },
});
```

环境变量（`ScenarioRouter` 加载调研场景时）：`FBS_SKILL_ROOT`、`FBS_BOOK_ROOT`。

## 文件索引

| 路径 | 作用 |
|------|------|
| `integration/lib/SearchPolicyFacade.js` | 读取 `references/05-ops/search-policy.json` |
| `integration/lib/WebSearchLedger.js` | `.fbs/search-ledger.jsonl` |
| `integration/lib/SearchBundle.js` | S0 并行包、章前门禁 |
| `integration/lib/MultiAgentPipeline.js` | 章内多角色流水线 |
| `integration/lib/BookWorkflowOrchestrator.js` | 默认 `workflowEngine` 实现（含 S2→S3 大纲确认门禁、每5章中检、章节质量门禁、S5 发布门禁） |
| `integration/lib/index.js` | 聚合导出 |
| `scenarios/research/backend/index.js` | `runS0ParallelResearch`（需 `skillRoot`） |
| `scripts/audit-fbs-efficiency.mjs` | 自检 |
| `scripts/summarize-quality-gates.mjs` | 读取 `.fbs/quality-gate-ledger.jsonl` 输出阻断率 / Top 问题码 / 结构偏差均值 |
| `scripts/generate-book-context-index.mjs` | 生成本书 `@` 索引 |
| `scripts/apply-book-memory-template.mjs` | 记忆模板（`--dry-run`） |

### 质量门禁汇总脚本

```bash
node scripts/summarize-quality-gates.mjs --book "<本书根>"
node scripts/summarize-quality-gates.mjs --book "<本书根>" --json
node scripts/summarize-quality-gates.mjs --book "<本书根>" --since 7d
node scripts/summarize-quality-gates.mjs --book "<本书根>" --baseline "2026-03-01..2026-03-08" --compare "2026-03-08..2026-03-15" --json
```

## 宿主侧仍须提供

- **WebSearch / WebFetch**：真实检索函数；本仓库不负责公网 API。
- **主笔 / 审校 LLM**：通过 `agents.writer` 等注入，或由用户在 WorkBuddy 里人工多成员执行（与 `workbuddy-agent-briefings.md` 一致）。
- **CodeBuddy 记忆**：见 [官方记忆文档](https://www.codebuddy.cn/docs/cli/memory)。

## qualityGate 配置项（`search-policy.json`）

| 键 | 默认值 | 作用 |
|----|--------|------|
| `minConvertedScore` | `7.5` | S5 折算分门槛 |
| `minRawScore` | `15` | S5 原始分门槛 |
| `minBLayerScore` | `4` | S5 B 层门槛 |
| `aiContrastMax` | `8` | 章节中“不是…而是…”最大次数 |
| `aiAdverbMax` | `12` | 程度副词阈值 |
| `minAnchorCoverage` | `0.5` | 结构锚点最小覆盖率（用于结构偏差率） |
| `minRhythmCv` | `0.2` | 段落节奏最小变异系数 |
