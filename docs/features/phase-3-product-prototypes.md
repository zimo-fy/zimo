# Phase 3 产品模块 UI 原型

状态：已实现，等待人工验收  
日期：2026-09-03

## 范围

Phase 3 为 Agent、Skill、知识库、Workflow、Plugin、MCP 和 Automation 提供可交互产品原型。七个模块共用经过严格 Schema 校验的 IPC 传输骨架，但 Application 按模块分发到专用 Repository 端口，不提供任意表或任意对象访问能力。

Phase 3 原型最初只存于 Main 进程内存。后续增量已将 Agent、Skill、知识库和 Workflow 迁移到 SQLite；原 Plugin 菜单已被独立的通信渠道页面取代；MCP 页面已替换为受控 HTTPS Registry；Automation 在 Phase 10 替换为账号隔离的应用存活期真实调度。应用不会动态下载扩展、启动本地 MCP Server、执行 Plugin、注册操作系统常驻调度或由 Router 自动执行。

## 已实现交互

- 所有模块：响应式多列操作卡、独立新建/编辑页、搜索、状态筛选、项目计数、加载、空和失败状态；卡片直接展示名称、描述、分类、版本和状态，不在列表下方附加详情；Agent/Skill 作者表单不要求标签；
- 所有选择器：使用统一的自定义触发器和选项面板，提供清晰的展开、选中、焦点、禁用状态与键盘导航；
- Agent：System Prompt 和关联能力编辑；启停、删除与“在对话中使用”位于列表；
- Skill：分类、版本、权限、安装状态与关联 Agent 展示；
- 知识库：从列表进入独立文档管理页，支持文档列表、拖放/选择导入、处理状态和检索测试；
- Workflow：从列表进入独立编排页，支持 React Flow 节点拖拽、端口连接、节点新增、配置、保存和受限测试运行；
- Plugin：已安装/可发现状态、Mock 安装和卸载、微信与 Telegram Connector 示例；
- MCP：stdio/HTTP 类型字段、敏感信息遮罩、能力摘要和连接测试未开放提示；
- Automation：Trigger 类型、目标关联、启停与运行预览；
- 所有运行类操作返回稳定的 `CAPABILITY_UNAVAILABLE`，Renderer 显示“预览/后续版本开放”。

## WorkflowDefinition 边界

持久化对象只包含 Zimo 自有的节点类型、位置和边引用。`@xyflow/react` 的 Node/Edge 对象仅存在于 Renderer mapper 中；保存前会映射回产品定义，Application 同时验证每条边的源和目标节点存在。

节点视觉原型包括：开始、Agent、Skill、知识库、条件、人工确认和结束。

## 安全边界

- Preload 只新增 `prototypes.list/get/mutate` 三个具名能力；
- Zod 输入 Schema 为 strict，拒绝命令、脚本、原始秘密和未知字段；
- 文件交互只生成固定 Mock 元数据，不读取路径或正文；
- MCP 敏感配置只返回遮罩提示；
- 原型运行、连接和调度不会产生网络、子进程、文件读取或 Tool 调用。

## 验证

- Domain/Application：CRUD、筛选、复制、未开放能力及无效工作流边；
- Mock Repository：save/list/get/delete contract；
- Contracts：未知可执行字段与秘密响应字段拒绝；
- E2E：七模块导航、Agent 创建、知识文档 Mock 导入、MCP 未开放状态；
- Phase 1/2 安全与对话回归继续纳入完整门禁。

## 已知限制

- Mock 状态不跨应用重启持久化；
- 文件选择器、真实解析与向量检索不在 V0.1；
- 工作流不编译为 LangGraph；
- 本节记录的是 Phase 3 历史原型边界；MCP 与 Automation 的后续真实运行时分别以对应功能文档和 ADR 为准；
- Phase 4 才会将启用的 Agent、Skill 和 Workflow 投影为 Router 目标。
