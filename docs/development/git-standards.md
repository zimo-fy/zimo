# Git 协作规范

## 分支与工作区

- `main`/`master` 保持可构建、可测试；受保护仓库禁止直接推送，变更通过短生命周期分支和 PR 合并；
- 人工分支建议使用 `feat/`、`fix/`、`refactor/`、`docs/`、`chore/` 加短横线描述；自动化代理遵守其运行环境要求的前缀；
- 一个分支只解决一个主题；不要把格式化全仓、依赖升级和产品功能混在同一分支；
- 开始修改前检查 `git status`；工作区已有变更默认属于他人，不覆盖、不 reset、不擅自纳入提交；
- 禁止提交生成产物、本地数据库、日志、用户数据、密钥、证书、`.env` 和 IDE 私有配置。

## Commit

- 使用 Conventional Commits：`type(scope): imperative summary`；常用 type 为 `feat`、`fix`、`refactor`、`docs`、`test`、`build`、`ci`、`chore`、`perf`、`revert`；
- subject 简洁、使用祈使语气、不加句号；scope 使用稳定领域名，如 `workflow`、`knowledge`、`ipc`、`desktop`；
- 每个 commit 是可理解、可验证的原子意图；纯移动/重命名与行为变更尽量分开；
- body 解释为什么、关键约束和取舍，不逐行复述 diff；关联 issue 使用 `Refs`，真正关闭时使用托管平台支持的 close 语法；
- 破坏性变更使用 `!` 或 `BREAKING CHANGE:`，并说明 migration 与调用方处理；
- 提交前 review staged diff，确认没有秘密、调试输出、意外生成文件或无关修改。

示例：

```text
feat(workflow): add controlled knowledge search node

Keep tool selection explicit and require confirmation before each run.
Refs: ZIMO-142
```

## 历史整理

- 已发布或他人基于其工作的公共历史不得 force push；确需重写个人分支时使用 `--force-with-lease`，不用裸 `--force`；
- 同步主分支优先 rebase 个人未共享提交或按团队策略 merge；不要为了线性历史重写共享提交；
- 冲突必须理解双方意图后解决，随后重跑受影响测试；禁止选择整侧文件来“快速解决”未知冲突；
- 不使用 `git reset --hard`、`git clean -fd` 或 checkout 覆盖未确认的工作区；优先 stash、临时分支或可恢复操作；
- revert 已合并问题使用 `git revert` 保留审计历史，不删除远程历史。

## Pull Request

- 标题遵循 Conventional Commit，描述包括背景、变更、非目标、风险、验证和界面截图（涉及 UI 时）；
- PR 应保持可评审；大功能先拆基础重构、契约、实现和接线，避免单个 PR 同时跨越多个无关领域；
- 提交前合并或标明依赖 PR，更新功能文档、ADR、migration、测试和 `PROGRESS.md`；
- 自动检查失败必须修复根因；不得通过跳过测试、降低安全开关或反复重跑掩盖 flaky；
- 所有 review 线程在合并前解决：采纳、解释不采纳原因，或建立有负责人和期限的后续任务；
- 合并策略由仓库统一设置；squash 时保留高质量标题和正文，不能把 `fix typo` 等中间消息作为最终记录。

## Tag 与发布

- 发布 tag 使用语义化版本 `vMAJOR.MINOR.PATCH`，只指向通过发布门禁的 commit；禁止移动已发布 tag；
- 版本变更、release notes、migration 和安装包来自同一 commit；发布失败通过新 commit/tag 修复；
- release notes 面向用户说明新增、修复、破坏性变化、数据迁移和已知问题，不粘贴 commit 清单代替说明；
- 热修复从对应发布基线创建，修复后同步回主线，避免分支永久分叉。
