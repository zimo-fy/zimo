# CodeBuddy Code 技能上架与交付包

> 官方文档：[CodeBuddy Code Skills（技能系统）](https://www.codebuddy.cn/docs/cli/skills)

## 交付物内容（建议最小上架包）

| 路径 | 是否纳入 | 说明 |
|------|----------|------|
| `SKILL.md` | **必选** | 技能入口；含 YAML Frontmatter |
| `references/` | **必选** | 规范全文；与 `SKILL.md` 内相对链接一致 |
| `LICENSE` | 建议 | 许可证 |
| `assets/` | 可选 | 本地 MD→HTML/PDF/DOCX 构建；需 Node 与可选依赖 |
| `integration/` | 默认 **不** 纳入上架 zip | 集成骨架；`scenarios/*/backend` 已有参考实现（可选随源码分发），见 [`doc-code-consistency.md`](./doc-code-consistency.md)、[`efficiency-implementation.md`](./efficiency-implementation.md) |

## 目录结构（与官方一致）

将下列内容放到**项目**的：

`.codebuddy/skills/FBS-BookWriter/`

```
FBS-BookWriter/
├── SKILL.md
├── references/
│   ├── 01-core/
│   ├── 02-quality/
│   ├── 05-ops/
│   └── …
├── LICENSE          （可选）
└── assets/          （可选）
```

用户级安装则为：`~/.codebuddy/skills/FBS-BookWriter/`（同上结构）。

**注意**：`SKILL.md` 与 `references/` 的相对路径（如 `./references/01-core/skill-index.md`）必须以 **`FBS-BookWriter` 为根** 保持一层目录关系，勿把 `references/` 挪到与 `SKILL.md` 不同层级。

## Frontmatter 对照（上架前自检）

| 字段 | 本技能当前 | 说明 |
|------|------------|------|
| `name` | `FBS-BookWriter` | 未填时可用目录名；建议与文件夹一致 |
| `description` | 多行中文 + **触发词（精选）** | 影响模型是否自动选用本 Skill；触发词与正文 **§0「模型触发词（精选说明）」** 表应同步更新 |
| `allowed-tools` | `Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch` | 与宿主实际工具名一致；若报错可尝试将 `Edit` 与 `Write` 按文档合并为宿主支持的写法 |
| `user-invocable` | `true` | `false` 时从 `/` 菜单隐藏，仅供模型内部引用 |
| `disable-model-invocation` | 未设 | 设为 `true` 时仅能通过 `/skill-name` 手动触发 |
| `context` / `agent` | 未设 | 需要子代理隔离时再设 `context: fork` 等 |

## 上架前检查清单

- [ ] 已按 [`visibility-boundary.md`](./visibility-boundary.md) 完成目录隔离：`internal/product-design`、`internal/business-plan` 不得进入交付包。
- [ ] `node scripts/audit-visibility-boundary.mjs` 通过（命名/路径/标记防泄露）。
- [ ] 已读并完成 [`global-delivery-consistency.md`](./global-delivery-consistency.md) §4 核对项（含触发词三处一致、`audit-fbs-efficiency`）。
- [ ] `SKILL.md` 中所有 `./references/...` 链接在打包目录下可解析。
- [ ] `references/05-ops/search-policy.json` 为合法 JSON。
- [ ] 已阅读 [`doc-code-consistency.md`](./doc-code-consistency.md)，不在上架说明中声称 `integration/`「已就绪可跑」；可选源码附带 `integration/`、`scenarios/` 时见 [`efficiency-implementation.md`](./efficiency-implementation.md)。
- [ ] 仓库根 **`node scripts/audit-fbs-efficiency.mjs`** 通过（开发者/CI 自检）。
- [ ] 安装后在本机执行 **`/skills`**，确认出现 **Project skills → FBS-BookWriter**，并关注预估 token。
- [ ] 用触发词试跑一句（如「写白皮书大纲」），确认模型能匹配 `description`。

## 对外可见说明模板（P0）

为避免误承诺，建议对外发布时复用模板：

- [`external-visible-release-template.md`](./external-visible-release-template.md)

推荐实践（降 token / 防卡顿 / 提体验）：

1. 首轮说明控制在 5 条内，仅讲“可见能力 + 边界 + 下一步”。
2. 不一次性贴完整手册，按用户追问分段展开。
3. 对长流程给出阶段进度与重试入口，避免静默等待。

## 本书仓库记忆模板（可选，与 Skill 同时用）

成书项目若与技能包**分目录**存放，可用 Node 脚本注入条件规则与 `CODEBUDDY.md` 片段（见 [`codebuddy-memory-workbuddy-integration.md`](./codebuddy-memory-workbuddy-integration.md)）：

```bash
node scripts/apply-book-memory-template.mjs --book "<本书根>" --skill "<本技能包根>"
```

## 生成 zip 交付包（Windows）

仓库内脚本（从仓库根目录执行）：

```powershell
.\scripts\package-codebuddy-skill.ps1
```

输出目录：`dist/FBS-BookWriter-skill/`。将该文件夹**整体**重命名为 `FBS-BookWriter` 后，复制到目标项目的 `.codebuddy/skills/` 下；或直接压缩 `FBS-BookWriter-skill` 为 zip 分发，由使用方解压到 `.codebuddy/skills/FBS-BookWriter/`。

## 一键发布前检查（Windows）

若希望一条命令完成“边界审计 + 全量审计 + 打包”，可执行：

```powershell
.\scripts\prepublish-workbuddy-skill.ps1
```

该命令任一步失败都会立即中断，避免误发布。

## 参考链接

- [Skills 功能说明](https://www.codebuddy.cn/docs/cli/skills)（目录结构、Frontmatter、`!`command\`\`、权限与调试）
- [WorkBuddy 概述](https://www.codebuddy.cn/docs/workbuddy/Overview)、[Agent Teams](https://www.codebuddy.cn/docs/cli/agent-teams)（与本 SKILL 中多成员话术章节对应）
