# Codex 开发工作流

## 形式选择

Codex 旧版 Custom Prompts 已弃用，当前使用仓库级 Skills 保存可重复工作流。Zimo 的三个工作流位于 `.agents/skills`，会随仓库共享，并配置为仅显式调用，避免普通请求意外触发。

## 可用命令

### 增加功能

```text
$zimo-add-feature <功能需求与验收标准>
```

工作流会先读取项目阶段、架构和编码规范，检查现有实现，然后在修改前给出简明步骤。完成实现与测试后，它必须创建或更新 `docs/features/<feature-slug>.md`、受影响的架构/流程文档、`docs/README.md` 和 `PROGRESS.md`。

定义文件：`../../.agents/skills/zimo-add-feature/SKILL.md`。

### 修改问题

```text
$zimo-fix-issue <问题表现、复现条件或错误信息>
```

工作流优先复现和确认根因，再进行最小完整修复并补回归测试。复杂问题必须记录到 `docs/issues/<issue-slug>.md`；如果修复改变 IPC、流式处理、数据、测试或其他流程，还必须更新对应的源文档，不能只写问题记录。

定义文件：`../../.agents/skills/zimo-fix-issue/SKILL.md`。

### 代码审查

```text
$zimo-code-review <可选：PR、基准分支、提交、文件范围或重点检查项>
```

工作流默认保持只读。显式范围优先；未指定时依次审查全部未提交变更、当前分支相对 upstream merge base 的差异，最后才回退到 `HEAD`。它会读取完整 diff 和相关调用链、契约、migration、测试及文档，过滤纯偏好与缺少证据的评论，然后按 `P0`–`P3` 输出可定位、可执行的问题。

评审不会自动修复、暂存、提交、推送或向 PR 发布评论。需要修改时应另行明确授权，并根据问题性质进入 `$zimo-fix-issue` 或 `$zimo-add-feature`。

定义文件：`../../.agents/skills/zimo-code-review/SKILL.md`。

## 规范复用策略

三个工作流直接引用现有规范，不另复制一套编码标准：

- `project-standards.md`：分层、依赖、配置、数据、安全、性能和完成定义；
- `code-style.md`：日常代码评审的通用规则入口；
- `typescript-standards.md`、`react-standards.md`、`electron-node-standards.md`：技术栈专项规范；
- `git-standards.md`：分支、提交、PR 和发布规范；
- `testing.md`：单元、契约、集成、E2E 和安全测试；
- `logging.md`：结构化日志、隐私和脱敏；
- `error-handling.md`：错误分类、降级和流式失败；
- `../architecture/`、`../security/`、`../adr/`：架构契约、安全约束和决策；
- 根目录 `REQUIREMENTS.md`、`IMPLEMENTATION_PLAN.md`、`PROGRESS.md`：产品范围、阶段门禁和当前状态。

命令文件只保留其特有流程：何时先输出修改步骤、功能文档如何落盘、何时判定复杂问题、问题记录格式、评审范围选择、发现项优先级和只读边界，以及流程改变时应更新哪个源文档。这样项目规范更新后三个工作流会自动采用新版本，不会产生双份规范漂移。

## 复杂问题判定

满足任一条件即按复杂问题处理：根因不明确或跨多层；涉及并发、流、取消、IPC、安全、秘密、迁移、数据一致性或模型兼容；改变公共契约、领域不变量、架构决策或研发/运行流程；可能造成数据丢失、权限扩大、重复故障或广泛回归。

简单且局部的问题不强制创建独立问题文档，但仍需回归验证。只要改变已记录的行为或流程，就必须更新对应文档。

## 维护规则

- 规范变化修改源规范，不把相同条款复制进 Skills；
- 功能/问题文档新增后加入 `docs/README.md`；
- Skills 的触发范围或步骤发生实质变化时同步更新本文；
- 如果技能未出现在 Codex 中，先重新打开项目或重启 Codex，再检查 `.agents/skills/<name>/SKILL.md` 的 frontmatter。
