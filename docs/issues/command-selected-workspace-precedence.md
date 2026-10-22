# Shell 命令误用默认 Zimo Workspace

## 症状与影响

会话已经添加用户项目目录后，模型执行 `pwd && git status --short` 仍可能选择隐藏的默认 `Zimo Workspace`。`pwd` 因而落到 `userData/workspaces/<conversationId>/files`，Git 报告当前目录不是仓库，并可能错误建议在内部输出目录执行 `git init`。

该问题不表示外部目录绑定失败，也不是 Shell Adapter 无法访问项目；它是命令工作目录选择错误。

## 复现与证据

1. 会话自动拥有一个 `managed` grant；
2. 用户再通过“添加工作目录”绑定一个 `external` grant；
3. 模型上下文同时列出两个 workspace ID，但此前未说明类型和命令优先级；
4. `run_command` 完全信任模型提交的 workspace ID，因此模型选择列表中的默认 grant 后，命令从内部输出目录启动。

## 根因

默认 Workspace 同时承担附件/输出存储和命令候选目录，但 Application 没有表达“用户选择的外部项目目录优先”这一产品不变量。仅在 UI 隐藏默认目录不会改变模型看到的 Tool 上下文，也不能约束最终执行目标。

## 修复

- 模型上下文为每个 grant 标注“Zimo 内部输出目录”或“用户项目目录”；
- 编程、Git、构建和测试命令明确优先用户项目目录；
- `planCommand` 和 `runCommand` 复用同一 Application 选择规则：
  - 模型指定外部目录时使用该目录；
  - 模型指定默认目录但存在外部目录时，改用最近添加的外部目录；
  - 没有外部目录时才回退默认 Workspace；
- 审批卡展示最终实际使用的目录名称，避免批准目标与执行目标不一致。

## 回归覆盖

Application 单元测试同时创建 managed 与 external grant，故意让模型参数指向 managed ID，并断言动作计划和最终 Executor 都使用 external root。

## 剩余限制

会话可绑定多个外部目录。模型明确指定其中一个时仍按指定目录执行；若模型误选默认目录，则回退最近添加的外部目录。未来如果产品需要用户在 UI 中固定“当前项目目录”，应新增显式 active workspace 字段和交互，而不是继续推断。
