# 文档与代码一致性审计

> 维护说明：本文件记录「规范文档声称的能力」与「仓库内可执行代码」的对照结果；随仓库变更应更新。

**审计日期**：以 Git 提交为准  
**代码范围**：`integration/**/*.js`（含 `integration/lib/**`）、`scenarios/**/backend/*.js`、`assets/*.{mjs,js,css}`（不含 `references/`、`SKILL.md` 正文审计）。**CodeBuddy 上架 zip** 默认不含 `integration/`、`scenarios/`，见 [`codebuddy-skill-delivery.md`](./codebuddy-skill-delivery.md)。

## 结论摘要

| 类别 | 说明 |
|------|------|
| **规范主体** | 写作流程、质量规则、检索门禁等多由 `SKILL.md` 与 `references/` 描述，由 **宿主**（CodeBuddy Code / WorkBuddy 等）执行，**不依赖**本仓库内业务后端。 |
| **integration/** | 提供场景路由、适配器与接口约定；**社媒 / 调研 / 企业** 三场景已随仓库提供 **参考实现**（`scenarios/.../backend/index.js`），可完成 `require` 与 `ScenarioManager` 初始化；业务深度仍以宿主 Skill 会话为主。详见 [`efficiency-implementation.md`](./efficiency-implementation.md)。 |
| **default 场景** | `ScenarioManager` 的 `default` 需注入 `workflowEngine`。本仓库提供 **`createDefaultBookWorkflowEngine({ skillRoot, bookRoot })`**（`integration/lib/BookWorkflowOrchestrator.js`）：按 `search-policy.json` 执行 **S0 并行检索包**、**章前检索门禁**、**多角色章内流水线**（宿主注入 `webSearch` 与可选 `agents.*`）。未注入则仍无 handler。 |
| **assets/build.mjs** | 与 `references/build.md`、`typography.md` 描述一致：在本地安装 `markdown-it` / `puppeteer` / `html-to-docx` 后可做 MD→HTML/PDF/DOCX；未安装依赖时按脚本内降级处理。 |

## 文档中易误解的表述（建议宿主侧理解）

- **新手引导 / NLU 拦截 / 积分 / 偏好面板**：`section-8-onboarding.md`、`points-system.md` 等描述的是 **产品与交互规范**，不是本仓库内的 React/Node 实现。
- **社媒多平台、热点追踪、自动监控**：`SKILL.md` 与集成设计中的能力需 **宿主调度 + 联网工具**；`integration` 仅为对接骨架。
- **48 条指令 / Critic 并行**：由宿主按文档执行；无随包自动测试脚本保证逐条覆盖。
- **`global-research-scenario.md` / `global-region-language-matrix.md`**：正文存在历史编码损坏（乱码）段落时，请以 [`global.md`](../04-business/global.md) 及同目录其它可读文件为准，或从备份恢复 UTF-8 源文。

## 多智能体 / 联网检索 / 系统记忆（增效能力 triage）

> 目的：防止「文档写得很全、仓库里却没有对应可执行实现」的误解。下列三项是用户最关心的**增效点**，须与 **宿主（CodeBuddy / WorkBuddy）** 能力区分。

### 1. 自动建立多智能体（Agent Teams / 并行 Task）

| 层面 | 事实 |
|------|------|
| **文档** | `SKILL.md` §1、`workbuddy-agent-briefings.md` 提供 **自然语言话术**与分工建议；指向 [Agent Teams 官方说明](https://www.codebuddy.cn/docs/cli/agent-teams)（宿主功能）。 |
| **本仓库代码** | **无** 调用宿主 Agent Teams API 的脚本；`integration/lib` 提供 **BookWorkflowOrchestrator**（S0 并行检索、章前门禁、多角色流水线占位）与 **检索账本**；`scenarios/.../backend` 为可加载场景类（见 [`efficiency-implementation.md`](./efficiency-implementation.md)）。`default` 场景须注入 `workflowEngine`（可用 `createDefaultBookWorkflowEngine`）。 |
| **正确理解** | 多智能体增效 = **用户在宿主内**按文档话术建队 / 并行子任务；技能包提供 **规范与可复制指令**，不是内置机器人编队服务。 |

### 2. 联网搜索（WebSearch / WebFetch）

| 层面 | 事实 |
|------|------|
| **文档** | `search-policy.json`、§3.0.5 定义 **门禁与次数期望**；`SKILL.md` Frontmatter `allowed-tools` 列出宿主**可能**提供的工具名。 |
| **本仓库代码** | **无** 搜索引擎实现、无对公网 API 的封装；`integration` 里 `setWebSearch(fn)` 仅为 **注入点**，需宿主传入真实 `fn`。 |
| **正确理解** | 「强制联网查证」= **执行方（模型+宿主工具）** 按规范调用检索；不是本仓库在后台自动跑爬虫或计次服务。 |

### 3. 系统记忆（CodeBuddy Memory / 降 token）

| 层面 | 事实 |
|------|------|
| **文档** | [`codebuddy-memory-workbuddy-integration.md`](./codebuddy-memory-workbuddy-integration.md) 与官方 [管理 CodeBuddy 的记忆](https://www.codebuddy.cn/docs/cli/memory) 对齐，说明 `CODEBUDDY.md`、规则、`/memory`、Auto Memory 等。 |
| **本仓库代码** | `scripts/apply-book-memory-template.mjs`：向**本书项目目录**写入/合并模板片段（需用户 **手动执行** Node 命令）；**不**在 Skill 加载时自动改写宿主记忆库。 |
| **正确理解** | 记忆增效 = **宿主产品能力** + **成书项目侧**可选脚本；技能包提供 **模板与约定**，不是内置记忆引擎进程。 |

### 反「偷懒」检查清单（维护者自用）

- [ ] `SKILL.md` 中「自动」「并行」等词若指 **工作流行为**，应能理解为 **宿主会话内** 由模型+工具执行，而非仓库内守护进程。  
- [ ] 介绍 `integration/` 时始终带一句：**骨架 / 需注入**，除非已补全 `scenarios/` 与真实 `workflowEngine`。  
- [ ] 更新 `search-policy.json` 后，**不**声称仓库会自动拦截未达标章节（无运行时校验器随包交付）。  
- [ ] **模型侧**：不得在未实际调用检索工具时声称已完成 `search-policy` 门禁或已「联网核对」；事实型句子须可指向检索摘要或账本记录。  
- [ ] **集成侧**：宿主注入的 `webSearch` 若本身无超时，应依赖 `integration/lib/SearchBundle.js` 对单次查询的 **默认 15s** 包裹（`BookWorkflowOrchestrator` 可传 `searchTimeoutMs` 覆盖；策略项见 `search-policy.json.searchAccessPolicy.singlePageTimeoutMs`），避免检索挂死拖死整段流水线。  
- [ ] **体验侧**：长步骤须符合 `SKILL.md` §1 渐进式输出；S0 跳过须有用户可见说明（见 `section-3-workflow`），与「静默继续」类禁止性条款一致。  

### 全局一致性速查（改一处、查三处）

| 你改了… | 建议同步核对 |
|---------|----------------|
| `search-policy.json`（章前次数 / 阶段列表） | `SKILL.md` §0 联网规范、`section-3-workflow` §3.0.5、`efficiency-implementation.md` |
| `SKILL.md` 触发词或 §0 阈值 | YAML `description`、价值承诺块、`global-delivery-consistency.md` §4 |
| S/P/C/B/V1 分值或条数 | `references/02-quality/metrics.md`、`quality-check.md`、根镜像 `references/metrics.md` |
| `strategy.md` 深度轴静默分 | `SKILL.md` §0 置信度（≥7.5 / 8.0） |

## 建议

1. 若上架 **纯文档技能包**：不要将 `integration/` 表述为「已就绪后端」；或从交付包中移除 `integration/`。  
2. 若需 **可运行集成**：三场景已有最小 `backend/index.js`；可在此基础上扩展真实业务，或改写适配器对接自有模块。  
3. 在 `SKILL.md` 或 skill-index 中保留指向 **本审计文件** 的链接，避免读者以为仓库内包含完整产品实现。
