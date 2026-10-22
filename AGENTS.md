# Zimo Repository Instructions

本文件适用于整个仓库。开始任何分析、修改、审查或重构前，先读取并遵守以下源文档：

1. `REQUIREMENTS.md`、`IMPLEMENTATION_PLAN.md`、`PROGRESS.md`；
2. `docs/development/project-standards.md`、`code-style.md`、`typescript-standards.md`、`testing.md`、`error-handling.md`、`logging.md`；
3. 涉及 Renderer 时读取 `react-standards.md`，涉及 Main/Preload/Node 时读取 `electron-node-standards.md`，涉及提交、分支或发布时读取 `git-standards.md`；
4. 与任务相关的 `docs/architecture/`、`docs/security/`、`docs/adr/` 和功能文档；
5. 涉及超限文件时读取 `docs/issues/oversized-modules.md`。

## 必须遵守

- 保持 Renderer → Preload → Main → Application → Domain/Adapter 的依赖方向；Renderer 不得访问 Node、数据库、密钥或任意 IPC channel；
- 外部输入和 IPC 必须经过严格 Schema；秘密、用户正文、文件正文、Tool 参数值和输出不得进入普通日志；
- 长时间运行和外部调用支持取消与超时；不以静默 catch、降低安全开关或伪造成功状态解决问题；
- 手写生产 TypeScript/TSX 默认目标不超过 400 行，600 行必须拆分。治理清单中的遗留超限文件执行“只减不增”；
- 拆分必须对应领域职责，不创建 `utils.ts`、`helpers.ts` 或无意义薄包装；纯重构不得顺带改变公共契约、持久化格式或产品行为；
- 新功能、复杂问题、架构/流程变化必须同步对应文档和 `PROGRESS.md`，新增文档加入 `docs/README.md`；
- 新依赖、配置、migration、IPC、权限或打包资源必须说明所有者、失败方式、安全/兼容性和验证范围；
- Git 变更保持原子且遵循 Conventional Commits；不得覆盖他人工作区、重写共享历史或提交秘密、用户数据和构建产物；
- 修改后按风险运行 format、lint、typecheck、unit、integration、build 和适用 E2E，不得把未运行的检查描述为通过。

## 当前阶段边界

当前已进入 Phase 10 本地 Automation 调度。P0 超限治理已完成；新增能力必须进入拆分后的领域模块，不得重新堆回公共入口。远程 MCP 仅可按 ADR 0010 从显式配置的 HTTPS 服务接入。Skill 代码执行仅允许 ADR 0013 规定的已审核包、固定 Python/Node 解释器、清单脚本、结构化参数、无 Shell、独立工作区、超时取消和审计链路。Automation 仅允许 ADR 0020 规定的账号隔离、本机应用存活期调度、显式会话能力、时间范围、非重叠执行和运行审计；仍禁止操作系统常驻服务、通用 Shell/任意命令、包外脚本、Plugin 代码执行、stdio MCP 和 Router 自动执行。

仓库级重复工作流位于 `.agents/skills/`。明确增加功能时使用 `$zimo-add-feature`，修复问题时使用 `$zimo-fix-issue`，审查代码变更时使用 `$zimo-code-review`；工作流只引用上述源规范，不复制另一套规则。
