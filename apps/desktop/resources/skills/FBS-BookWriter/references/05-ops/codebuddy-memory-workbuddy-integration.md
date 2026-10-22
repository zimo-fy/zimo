# CodeBuddy 记忆 × WorkBuddy / FBS-BookWriter（落地规划）

> 官方说明：[管理 CodeBuddy 的记忆](https://www.codebuddy.cn/docs/cli/memory)（用户/项目记忆、`CODEBUDDY.md`、`.codebuddy/rules/`、`@` 导入、条件规则、`/memory`）。  
> 技能说明：[Skills 功能](https://www.codebuddy.cn/docs/cli/skills)。  
> 本技能包**不修改** CodeBuddy / WorkBuddy 二进制；以下通过**项目侧配置**与**模板脚本**，让「按需加载规范」像多智能体话术一样**可复用、可发现**，从而减少无谓的全文引用、**降低 token 与卡顿**。

## 1. 目标

| 目标 | 做法 |
|------|------|
| 降 token | 条件规则：仅在编辑 `*.md` 成稿时注入短提示；重型规范用 `@` **单文件**拉取，避免粘贴整份 `references/` |
| 提质量 | 项目 `CODEBUDDY.md` 固定本书体裁、风格档案路径、强制检索门禁（指向 `search-policy.json` 与 §3.0.5） |
| 提效 | 用户记忆存个人排版偏好；项目记忆存团队目录约定；与 Skill 的 `description` 触发词互补 |
| 少卡顿 | 减少单次上下文体积；依赖 `paths` 条件规则与 `@` 深度限制（官方默认递归 ≤5 层） |

## 2. 分层建议（与官方一致）

1. **用户级** `~/.codebuddy/CODEBUDDY.md`：个人写书偏好（如「章节标题级数」「禁用英式标点」）。
2. **本书项目** `./CODEBUDDY.md` 或 `./.codebuddy/CODEBUDDY.md`：本书类型、读者、产出物目录、`__FBS_SKILL_ROOT__`（技能包绝对路径）。
3. **条件规则** `./.codebuddy/rules/fbs-bookwriter-on-demand.md`：仅当操作匹配 `paths`（如 `**/*.md`）时注入「按需 @ 工作流/质量」提示（见模板）。
4. **本地不提交** `./CODEBUDDY.local.md`：个人沙箱路径、实验分支（官方推荐进 .gitignore）。
5. **Auto Memory / Typed Memory**（可选）：由用户在宿主内通过 `/config`、`/memory` 开启；本仓库不强制。

## 3. 与 Skill 的关系

- **Skill**：模型选用任务时的「大块规范」与触发词（`SKILL.md` + `references/`）。
- **Memory / Rules**：**同一宿主会话内**持续存在的**轻量锚点** + **按文件类型触发的提醒**，避免每次从 Skill 重复拉全文。

二者同时启用时：**Skill 管能力边界，Memory 管本书上下文与按需加载策略**。

## 4. 一键安装到「成书项目」目录

在仓库根目录执行（将路径换成你的本书仓库与技能包路径）：

```bash
node scripts/apply-book-memory-template.mjs --book "D:/books/my-handbook" --skill "D:/path/to/FBS-BookWriter"
```

- 会创建（若不存在）`--book` 下的 `.codebuddy/rules/`，并写入 **`fbs-bookwriter-on-demand.md`**（已替换技能根路径）。
- 若不存在 `CODEBUDDY.md`，会从 **`CODEBUDDY.snippet.md`** 生成初稿；已存在则提示手动合并片段。

模板源文件目录：[`templates/codebuddy-book-project/`](./templates/codebuddy-book-project/README.md)。

### 4.1 生成「按需 @ 索引」（长文档降 token）

在仓库根执行：

```bash
node scripts/generate-book-context-index.mjs --book "D:/books/my-handbook" --skill "D:/path/to/FBS-BookWriter"
```

会在本书根生成 **`FBS_CONTEXT_INDEX.md`**：按 S0/S3/S4 列出建议 `@` 的**单文件路径**，避免整份 `references/` 进上下文。

## 5. 维护本技能仓库时的规则（可选）

本仓库自带 [`.codebuddy/rules/fbs-skill-repo.md`](../../../.codebuddy/rules/fbs-skill-repo.md)（`paths` 指向 `references/**` 与 `SKILL.md`），便于改文档时对齐 [`global-delivery-consistency.md`](./global-delivery-consistency.md)。

## 6. 相关链接

- [记忆 · 条件规则与 paths](https://www.codebuddy.cn/docs/cli/memory)  
- [Skills + Memory 配合说明（官方 Skills 页内）](https://www.codebuddy.cn/docs/cli/skills)  
