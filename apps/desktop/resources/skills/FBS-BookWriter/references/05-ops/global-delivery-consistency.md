# 全局交付一致性审计

> **范围**：上架/交付默认包含的 `SKILL.md`、`references/`、`LICENSE`、可选 `assets/`；**不含** `integration/`（见 [`codebuddy-skill-delivery.md`](./codebuddy-skill-delivery.md)）。  
> **代码与文档事实核对**：见 [`doc-code-consistency.md`](./doc-code-consistency.md)。  
> **维护**：变更总纲、宿主表述、触发词或工作流阶段时，应同步更新本表「结论」列。

## 1. 术语与宿主表述（canonical）

| 用语 | 规范 | 避免 / 说明 |
|------|------|-------------|
| 执行环境 | **宿主**（CodeBuddy Code / WorkBuddy 等） | 正文默认不写「仅支持某一产品」 |
| WorkBuddy | 仅在 **多成员 UI、官方链接** 等场景点名 | 不把 WorkBuddy 写成唯一执行方；**不**声称未文档化的 docx/图像 skill |
| Task 角色 | 宿主侧并行子任务；用户侧不暴露角色名 | 与 `SKILL.md` §1 一致 |
| 阶段 | **S0–S6**，详表以 `references/01-core/section-3-workflow.md` 为准 | 禁用「五阶段」等旧称 |
| 触发词 | **YAML `description` 中「触发词（精选）」** = 正文价值块 = `SKILL.md` §0 表 | 三处同步 |

## 2. 已修复的跨文档硬错误（本轮）

| 问题 | 处理 |
|------|------|
| `references/05-ops/build.md`、`04-business/asset-matrix.md`、`03-product/10-case-library.md` 中 `../SKILL.md` | 改为 **`../../SKILL.md`**（自子目录指向仓库根） |
| `references/03-product/01-user-install-guide.md` 文末 `../SKILL.md` | 改为 **`../../SKILL.md`** |
| `doc-code-consistency.md` 仅写 WorkBuddy 宿主 | 改为 **宿主（CodeBuddy / WorkBuddy 等）** |
| `team-protocol.md`（根与 `04-business/`）指向 SKILL §1 五阶段 | 改为 **§3 工作流 + section-3-workflow.md（S0–S6）**；短指令 **§4**；索引指向 **skill-index** |
| `section-3-workflow.md`、`section-nlu.md`、`search-policy.json` 仅写 WorkBuddy | 改为 **宿主** 或 **宿主（CodeBuddy / WorkBuddy 等）** |
| `integration/CHECKLIST.md` 触发词与 S4–S6 描述 | 与 **`SKILL.md` 精选触发词** 及 **section-3-workflow S4–S6** 对齐 |

## 3. 已知残留与风险（不阻塞文档交付）

| 级别 | 项 | 说明 |
|------|-----|------|
| P2 | `global-research-scenario.md`、部分 `global-region-language-matrix.md` | 正文存在历史编码损坏；以 [`global.md`](../04-business/global.md) 及 [`doc-code-consistency.md`](./doc-code-consistency.md) 说明为准 |
| P2 | 根级 `references/*.md` 与 `references/0x-*/` **重复** | 历史镜像；索引以 skill-index 为准；改一处时建议检索同名文件 |
| — | （已清理）原交付文档中的 **docx skill / 内置图像** 表述 | 已改为可复现工具链与「宿主图像须落盘」；见 `visual.md`、`delivery-guide.md`、`01-user-install-guide.md` 等 |
| P3 | `integration/CHECKLIST` 中前端组件、网络依赖等 | 属**集成/产品化**假设，与「纯技能包」交付边界不同；勿与 `doc-code-consistency` 结论混淆；作者栏已改为项目可填 |
| — | 多智能体 / 联网 / 记忆「是否随包落地」 | **以 [`doc-code-consistency.md`](./doc-code-consistency.md) §「增效能力 triage」与 [`efficiency-implementation.md`](./efficiency-implementation.md) 为准**：`integration/lib` + `scenarios/` 提供可加载参考实现；上架 zip 仍默认不含 `integration/`（见 [`codebuddy-skill-delivery.md`](./codebuddy-skill-delivery.md)） |

## 4. 发布前快速核对（Checklist）

- [ ] `SKILL.md`：`description` 触发词 = §0「模型触发词」表与「价值承诺」块 = **三处一致**（含「写长篇」等与表对齐）；**「技能加载后的行为约定」**（触发词首响、身份自述、先读 `skill-index`）与 [`skill-index.md`](../01-core/skill-index.md) **AI 快速学习路径** 同步可读  
- [ ] 自 `references/**/**.md`（除 `references/*.md` 根文件外）指向 `SKILL.md` 均为 **`../../SKILL.md`** 或等价路径  
- [ ] `search-policy.json` 为合法 JSON（`node -e "JSON.parse(require('fs').readFileSync('references/05-ops/search-policy.json','utf8'))"`）  
- [ ] [`codebuddy-skill-delivery.md`](./codebuddy-skill-delivery.md) 与 `scripts/package-codebuddy-skill.ps1` 所列纳入/排除范围一致  
- [ ] 仓库根执行 **`node scripts/audit-fbs-efficiency.mjs`** 通过（增效集成自检）  
- [ ] [`efficiency-implementation.md`](./efficiency-implementation.md) 与当前 `integration/lib`、`scenarios/` 能力描述一致（若改动代码则同步文档）  

### 4.1 体验、防卡顿与防偷懒（执行约定）

> 与 [`doc-code-consistency.md`](./doc-code-consistency.md) 反偷懒清单、`section-6-tech.md` §6.5.1 配套阅读。

| 维度 | 约定 |
|------|------|
| **全局洞察** | 改规范前先对照 **本文 §4** + `doc-code-consistency.md`；涉及镜像双份时检索 `references/*.md` 与 `references/0x-*/` 同名文件。 |
| **防卡顿** | 会话侧：大上下文用记忆模板与 `@` 索引（§5）；集成侧：`SearchBundle` 对单次 `webSearch` **默认 15s** 超时（同运行禁访 + 日内3次周禁访，持久化 `.fbs/domain-blocklist.json`）；`MultiAgentPipeline` 对**每个已注入** `agents.*` **默认 300s/步**（`roleStepTimeoutMs`，**0** 关闭）；构建侧：PDF 前等待 Mermaid（`assets/build.mjs`）；多成员：心跳丢失按 §6.4 / §6.5.1 降级。 |
| **防偷懒（模型）** | 禁止无检索写可核验事实；禁止门禁未达标却宣称已过；G3 / 学术红线须阻断而非静默跳过。 |
| **防偷懒（文档）** | 不把 `integration/` 写成「已就绪后端」；不把宿主能力写成技能包内进程（见 `doc-code-consistency` triage）。 |
| **用户体验** | 渐进式输出、阶段进度可见（`SKILL.md` §1）；低置信度显性确认（§0）；检索失败时给用户可懂原因与下一步，而非空白卡住。 |

## 5. CodeBuddy 记忆与本书项目（降 token）

- 规划与脚本：[`codebuddy-memory-workbuddy-integration.md`](./codebuddy-memory-workbuddy-integration.md)（基于 [官方记忆文档](https://www.codebuddy.cn/docs/cli/memory)）。
- 模板目录：[`templates/codebuddy-book-project/`](./templates/codebuddy-book-project/README.md)。
- 安装命令：`node scripts/apply-book-memory-template.mjs --book <本书根> --skill <本技能根>`（可选 `--dry-run`）。
- 成书按需 `@` 索引：`node scripts/generate-book-context-index.mjs --book <本书根> --skill <本技能根>`。

## 8. 提交审核前（本轮）一致性结论

| 项 | 状态 |
|----|------|
| 触发词三处（YAML / 价值块 / §0 表） | 已对齐「写长篇」等与表一致 |
| `search-policy.json` | 可解析 |
| `node scripts/audit-fbs-efficiency.mjs` | 纳入发布前自检 |
| 上架包范围 | 仍以 `codebuddy-skill-delivery.md` + `package-codebuddy-skill.ps1` 为准（`SKILL.md` + `references/` + `LICENSE` + 可选 `assets/`） |

## 6. 相关链接

- [CodeBuddy Skills 官方说明](https://www.codebuddy.cn/docs/cli/skills)  
- [文档索引](../01-core/skill-index.md)  

## 7. 低优先级残留（可选后续）

| 级别 | 项 | 说明 |
|------|-----|------|
| — | `expert-xx`、旧版叙事人名 | **已处理（2026-03-24）**：`risk.md` 等改为「归口领域」；`product-framework` 改为领域划分表；`global`/案例/竞品/资产等去除 `expert-*` 与沈括等；`team-protocol` 与 `persona` 对齐福帮手叙事 |
| P3 | 根级 `references/*.md` 与 `references/0x-*/` **双份** | 改内容时易漏同步；长期可合并或只保留子目录权威路径 |
| P3 | `global-research-scenario.md` 等 **编码损坏** | 需 UTF-8 重导或重写标题/导航段 |
| P3 | `integration/*`、`INTEGRATION_DESIGN.md` 内 **示例代码**「待实现」 | 与 `doc-code-consistency` 一致：骨架状态，非交付能力声称 |
| P4 | `references/01-core/skill-index.md` 底部「按角色/关键词」曾用错 `./` 路径 | **已修正**为 `../02-quality/` 等（2026-03-24） |
| P4 | `risk.md` 登记册 **R-02** 与 §4.2 图像降级不一致 | **已对齐**为 §4.2 表述 |
| — | 作品品牌水印 | **已落地**：`assets/build.mjs` 版权页 + PDF 页脚 + SVG 封面底栏；规范见 [`brand-outputs.md`](./brand-outputs.md)；`books.config.js` 可 `brandMode: 'none'` 关闭 |
