---
name: skill-creator
description: "Create, validate, and directly install a Zimo Skill from the Creator workspace. Use when the user asks to create, revise, or scaffold a Skill."
description_zh: "在 Creator 工作区创建、校验并直接安装 Zimo Skill"
description_en: "Create, validate, and directly install a Zimo Skill"
---

# Skill Creator

创建或维护一个完整、可校验、可直接安装的 Zimo Skill。默认使用中文与用户沟通；用户明确要求其他语言时再切换。

## 工作边界

- 只能通过本 Skill 已安装的脚本操作当前 Skill 工作区，不假设存在通用文件编辑或 Shell 工具。
- 不要扫描应用数据目录、修改 SQLite 或复制到 `skill-runtime/packages`。安装只能调用 Creator 专用的 `install_created_skill` 工具，由 Zimo Application 层完成。
- 当前流程适合 UTF-8 文本文件。二进制资源不能通过 `write_skill_file.py` 生成，应提示用户在安装前自行放入生成目录。
- 只创建任务真正需要的 `scripts/`、`references/`、`assets/`；不要保留示例脚本、TODO 或无用途的占位文件。
- 当前模型工具循环最多 12 轮、36 次调用。先规划文件和分段数量，通常按“一次初始化、逐段写入、一次最终校验”完成，避免无意义的重复校验和空文件。

## 创建流程

1. 根据用户目标确认 Skill 的触发场景、边界和需要复用的资源。信息足够时直接开始，只有关键缺失会改变结果时才追问。
2. 调用 `run_script` 时，输入对象顶层只能有 `script` 和 `arguments`。`--path`、`--resources`、`--content`、`--append` 等全部是脚本参数，必须作为字符串放进 `arguments` 数组；绝对不要生成顶层 `path`、`content`、`append` 或其他字段。
3. 使用 `scripts/init_skill.py` 在当前工作区初始化目录。路径参数固定使用 `.`。调用格式示例：

   ```json
   {
     "script": "scripts/init_skill.py",
     "arguments": ["my-skill", "--path", ".", "--resources", "scripts,references"]
   }
   ```

4. 使用 `scripts/write_skill_file.py` 写入完整文件。该脚本每次只接收一段不超过 4000 字符的内容；为给运行时参数边界留余量，内容较长时按不超过 3500 字符分段。第一段覆盖写入：

   ```json
   {
     "script": "scripts/write_skill_file.py",
     "arguments": ["my-skill", "SKILL.md", "--content", "第一段完整内容"]
   }
   ```

   后续段追加写入时，`--append` 是 `arguments` 的最后一个字符串，不是顶层布尔字段：

   ```json
   {
     "script": "scripts/write_skill_file.py",
     "arguments": ["my-skill", "SKILL.md", "--content", "后续段完整内容", "--append"]
   }
   ```

5. 对 `SKILL.md`、参考资料和需要的 Python/Node 脚本逐一落盘。不要把只存在于模型回复里的草稿当作已创建文件。
6. 使用 `scripts/quick_validate.py` 校验最终目录，调用格式为 `{"script":"scripts/quick_validate.py","arguments":["my-skill"]}`。校验失败时修正后重试，不得把失败描述为成功。
7. 校验成功后，立即调用 `install_created_skill`，输入严格使用 `{"directoryName":"my-skill"}`，只传目录名，不传绝对路径。只有工具明确返回 `installationStatus: installed` 后，才能告诉用户已经安装并可在 Skill 列表和会话选择器中使用。
8. 如果当前没有暴露 `install_created_skill`，或安装工具返回失败，保留生成目录并用中文返回绝对路径，提示用户通过 **Skills → 本地安装** 手动导入。不得把回退路径描述为已安装。

## 更新流程

更新当前工作区中已经存在的生成目录时，不要再次运行初始化脚本。直接使用 `write_skill_file.py` 覆盖或分段更新目标文本文件，然后重新运行 `quick_validate.py`。

## Skill 编写要求

- 目录名和 frontmatter `name` 使用小写字母、数字和连字符，最多 64 个字符。
- `description` 简洁说明能力、适用场景和必要边界，避免吸引无关请求。
- `SKILL.md` 保留共同目标、关键约束和资源路由；大段条件说明放到 `references/`，并从 `SKILL.md` 指明何时读取。
- 重复且需要确定性的操作才放入 `scripts/`。脚本必须使用 Python 标准库或应用内置 Node 能力，不依赖 Shell、自动安装包或当前环境未提供的第三方模块。
- 生成脚本时应包含清晰的参数错误、非零失败退出和安全路径处理。当前 Creator 不能把新生成的脚本加入自身运行白名单，因此不要声称已执行过生成脚本；只说明已完成结构校验，待安装后再做实际行为测试。
- 初始化生成的 `manifest.json` 提供稳定 `packageId`，使用户从同一 Skill 目录重新安装时能够更新已有记录。除非用户明确要求，不要随意更改 `packageId`。

## 完成条件

只有同时满足以下条件才能报告创建完成：

1. 承诺的每个文本文件都已通过写入脚本真实落盘；
2. `SKILL.md` 不再包含 TODO 或占位内容；
3. 文件和目录没有越出当前工作区；
4. `quick_validate.py` 成功退出；
5. `install_created_skill` 返回安装成功；如果该工具不可用或失败，最终回复必须改为提供绝对目录和手动“本地安装”步骤。

## 参考资料

- 需要设计顺序或条件流程时读取 `references/workflows.md`。
- 需要规定稳定输出格式或示例时读取 `references/output-patterns.md`。
