# 可见性边界与防泄露规范

## 目标

通过**目录边界 + 文件命名 + 打包白名单 + 扫描阻断**，区分：

- 设计文件（内部）
- 商业计划（内部）
- 提交给 WorkBuddy、对最终用户可见的代码与文档（公开）

## 目录边界（强约束）

| 类型 | 目录 | 可见性 | 是否允许进入 WorkBuddy 包 |
|---|---|---|---|
| 产品设计内档 | `internal/product-design/` | 内部 | 否 |
| 商业计划内档 | `internal/business-plan/` | 内部 | 否 |
| 用户可见技能文档 | `SKILL.md` + `references/` | 公开 | 是 |
| 可选构建资产 | `assets/` | 公开 | 是（可选） |
| 集成实现样例 | `integration/` | 开发者 | 默认否 |

## 文件命名规则（建议）

内部文件建议使用前缀，便于检索和审计：

- 设计文件：`DESIGN-*.md`
- 商业计划：`BIZ-PLAN-*.md`
- 内部评审：`INT-REVIEW-*.md`

公开文件禁止使用以上前缀，避免误判与误投递。

## 内容标记规则（建议）

内部文档顶部可加入标记（推荐）：

- `VISIBILITY: INTERNAL_ONLY`
- `VISIBILITY: BUSINESS_CONFIDENTIAL`

打包脚本会在公开目录扫描这些标记，一旦出现立即阻断打包。

## 打包与发布规则

使用 `scripts/package-codebuddy-skill.ps1` 打包时：

1. 仅复制 `SKILL.md`、`LICENSE`、`references/`、`assets/`；
2. 若在公开目录发现内部标记，直接失败；
3. 若在 `references/` 或 `assets/` 下发现 `internal`、`business-plan`、`product-design` 路径片段，直接失败。

## 发布前检查清单

- [ ] 内部内容仅位于 `internal/product-design/` 或 `internal/business-plan/`。
- [ ] 对外文档均在 `SKILL.md`、`references/`、`assets/`。
- [ ] 执行 `node scripts/audit-visibility-boundary.mjs` 通过。
- [ ] 执行 `.\scripts\prepublish-workbuddy-skill.ps1` 通过（推荐，一键串联审计与打包）。
- [ ] 执行 `.\scripts\package-codebuddy-skill.ps1` 成功。
- [ ] 打包产物中未包含 `internal/` 与 `integration/`。
