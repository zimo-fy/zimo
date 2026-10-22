# Skill Creator 参数 Schema 与商店身份不一致

## 症状与影响

重新安装官方 Creator 后，创建流程在追加写入文件时提示“运行 Skill：创建skill的技能”的参数不符合 Schema。即使安装包已经包含新版 manifest，Creator 也没有得到 `install_created_skill`，校验完成后仍要求用户手动安装生成的 Skill。

## 证据与复现

- 失败调用的顶层参数键为 `append`、`arguments`、`script`，其中 `append: true` 不属于 `run_script` 的严格 Schema；失败发生在脚本启动前，错误为 `TOOL_ARGUMENTS_INVALID`。
- 正确调用应把 `--append` 放入 `arguments` 字符串数组。
- 已安装包的 `manifest.json` 使用 `zimo.skill-creator` 并声明 `skill:local-install`，但 SQLite 安装记录使用 Zimo Store 从目录 ID 派生的 `zimo.market.*` 身份和商店默认权限，因此只识别本地 manifest 身份的授权规则无法命中。

## 根因

Creator 的旧指令用命令行伪代码展示追加写入，模型将布尔选项推断成 Tool 顶层字段。与此同时，商店 Adapter 有意以目录元数据建立包身份和基础权限，不采用压缩包 manifest 的身份；直接安装能力最初只覆盖了本地安装身份，没有覆盖同一官方 Creator 的商店身份。

## 修复

- 保持 `run_script` 的 `additionalProperties: false`，在 Tool 描述、字段描述和 Creator 流程中提供完整 JSON 调用示例，明确所有脚本选项都属于 `arguments`。
- 本地 Creator 继续要求固定 package ID 与显式权限；官方商店 Creator 使用固定商店 package ID 加不可由压缩包声明的商店安装来源进行授权。
- 两种 Creator 身份都属于受保护身份；无论当前运行的是本地版还是商店版，都不能通过生成目录安装或覆盖任一 Creator 身份。
- 不按名称授权，不解析包内 manifest 来提升商店包权限，也不放宽脚本 Tool 的未知字段校验。

## 回归覆盖

- Application 单测断言脚本 Tool 继续拒绝额外顶层字段，并向模型暴露参数放置说明。
- Application 单测覆盖官方商店 Creator 能获得直接安装 Tool，而相同 package ID 的本地来源被拒绝。
- Creator 资源指令覆盖初始化、覆盖写、追加写、校验和直接安装的严格 JSON 格式。

## 剩余风险

模型仍可能生成不合法参数，但会在脚本启动前被安全拒绝。官方 Creator 的商店目录迁移为新 ID 时，需要同步更新受信身份；长期应由商店目录返回受签名、可审核的能力声明替代应用内固定映射。
