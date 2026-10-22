# 受审核 Skill 脚本运行时

## 当前能力

Zimo 安装 Skill 时会保存 `SKILL.md` 以及包内脚本、资源和任务模板。被用户绑定到会话、Agent 或 Workflow 的 Skill 如果包含 Python/Node 脚本，会在模型请求中额外暴露一个受控 Skill Tool。

```text
Zimo Store / 本地受审核目录
  → 有界包解析与路径校验
  → userData/accounts/local/skill-runtime/packages/<skillId>/<checksum>
  → 会话能力解析（直接 Skill + Agent Skill + Workflow Skill）
  → 动态注册 skill.<skillId>.run_script
  → 模型选择脚本与参数
  → Schema / 本轮授权 / 30 秒超时 / 取消 / 审计
  → userData/accounts/local/skill-runtime/data/<skillId>/workspace
  → Python 或应用内置 Node 子进程
  → stdout/stderr 作为 Tool result 返回模型
```

Skill 的脚本 Tool 本身不会派生通用 Shell 权限。其 `script` 字段是安装清单生成的枚举，`arguments` 是有界字符串数组；Main 再次校验后以 `spawn(command, args, { shell: false })` 启动。会话另行开放的实验性 `run_command` 属于 ADR 0019 Workspace 能力，始终逐条审批，不因安装 Skill 自动放行。只有 Tool 成功返回后，模型才能向用户声明操作完成。

包含任务模板或参考资料的已加载 Skill 还会获得只读 `read_resource` Tool。模型只能从安装清单生成的相对路径枚举中选择 UTF-8 文本资源；该能力不读取会话 Workspace，也不允许访问 `scripts/`、绝对路径或包外文件。

## 安装目录与数据

- `packages/<skillId>/<checksum>/`：按内容 checksum 保存的只读安装文件；
- `data/<skillId>/workspace/`：脚本运行副本和持久化业务数据；
- 更新会覆盖工作区中的包文件，但保留脚本生成的其他数据；
- 卸载会删除该 Skill 的包和工作数据。

包上限为压缩下载 20 MiB、解压后 20 MiB、500 个文件、单文件 5 MiB，`SKILL.md` 单独限制为 256 KiB。`__MACOSX` 和 `.DS_Store` 会忽略。Shell 脚本、安装 Hook 和自动依赖安装不会执行。

## 运行兼容性

| 类型            | 运行方式                                | 当前限制                          |
| --------------- | --------------------------------------- | --------------------------------- |
| `.py`           | macOS/Linux `python3`；Windows `python` | 依赖系统 Python；只保证标准库脚本 |
| `.js/.mjs/.cjs` | 应用内置 Node 运行时                    | 不自动执行 `npm install`          |
| `.sh/.bat/.ps1` | 不执行                                  | 后续另立 Shell 权限 ADR           |

例如日程 Skill 的 `scripts/schedule.py` 可以写入自己的 `schedule_data.json`，但这只完成数据记录；Automation 已能在应用存活期按计划执行会话能力，要在 17:30 主动通知到外部渠道仍需要通信渠道主动投递能力。

## 安全说明

当前运行时依赖“上架前审核”信任脚本，不是 OS 沙箱。最小环境、工作目录隔离和无 Shell 不能阻止恶意 Python/Node 代码访问当前用户可访问的其他资源。上传审核必须绑定到精确 checksum；在包签名、审核证明和系统级沙箱完成前，不应开放未经审核的第三方远程包自动执行。

普通日志不记录脚本参数值、stdout/stderr 或文件内容。调用复用 `tool.execution.completed` 审计，只保留 Skill Tool ID、参数键名、权限 ID、耗时、结果和错误码。

## 本地创建 Skill

项目维护的 `skill-creator` 只在自己的持久化工作区中创建 Skill 文件夹。它通过受审核的初始化、分段文本写入和校验脚本完成目录，不扫描应用数据、不修改数据库，也不把生成结果直接复制到安装包目录。单个脚本参数受 4000 字符上限约束，较长文本按不超过 3500 字符分段写入。

本地安装时，固定 package ID 为 `zimo.skill-creator` 且声明 `skill:local-install` 权限的 Creator 会额外获得 `install_created_skill` 受控 Tool。官方商店版使用 Zimo Store 从目录 ID 派生的固定 package ID，并同时校验由安装流程写入、不能由压缩包伪造的商店来源。Tool 只接受一个规范化目录名，Adapter 再确认目录属于当前 Creator 的已安装 checksum 和 workspace，然后复用 `LocalInstructionSkillPackageReader` 与 `InstructionSkillInstallationService` 完成读取、快照和入库。生成包不能覆盖 Creator 自身；Tool 输出只包含安装后的 Skill ID、名称、版本和状态，不返回路径或正文。

`run_script` 的输入顶层严格只有 `script` 与 `arguments`。所有 Python/Node 选项和值（包括 `--append`、`--content`、`--path`）都按原顺序作为字符串放入 `arguments`；运行时不接受把命令行选项改写成额外 JSON 字段。

校验成功后，Creator 默认调用该 Tool 直接安装。Tool 不可用或失败时才返回生成目录的绝对路径，回退到 **Skills → 本地安装**。生成 Skill 的脚本尚未进入 Creator 自身的脚本白名单，因此 Creator 只验证包结构，不声称已经运行生成脚本。

## 验收

1. 对旧 Skill 点击“重新安装”，确认页面提示脚本已同步；
2. 在会话中绑定日程 Skill，使用支持 Tool Calling 的模型发送“记录今天 17:30 技术开发会议”；
3. `llm-payloads.jsonl` 应能看到已编译的 Skill 指令；`zimo.log` 通过脱敏的 `tool.execution.completed` 确认脚本 Tool 结果；
4. 再询问日程列表，确认同一 Skill 工作区的数据可恢复；
5. 超时、取消、未知脚本路径和非零退出必须返回失败，不能显示伪成功。
6. 重新安装项目版 Creator 后创建一个测试 Skill，确认校验成功后直接返回已安装状态，并能在 Skill 列表中查看；越界目录、符号链接和 Creator 自覆盖必须被拒绝。
