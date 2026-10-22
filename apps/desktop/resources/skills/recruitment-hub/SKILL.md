---
packageId: zimo.recruitment-hub
name: 招聘平台统一调度
version: 2.0.2
description: 招聘操作的统一入口，按用户指定平台动态加载 Boss直聘、鱼泡直聘或猎聘能力。
category: 招聘
---

# 招聘平台统一调度

本 Skill 是招聘任务的用户入口和调度中心。只负责解析、路由、顺序执行和汇总；不得凭记忆执行平台页面操作，不得读取项目目录或会话 Workspace 中的 Skill 文件。

## 平台注册表

| 平台 | 识别词 | packageId | 默认顺序 |
| --- | --- | --- | --- |
| Boss直聘 | Boss、Boss直聘、直聘 | `zimo.boss-zhipin` | 1 |
| 鱼泡直聘 | 鱼泡、鱼泡直聘 | `zimo.yupao` | 2 |
| 猎聘 | 猎聘、猎聘网、Liepin | `zimo.liepin-hr` | 3 |

不要把猎聘识别为智联招聘。本版本没有智联招聘平台能力。

## 输入解析

从用户原始指令提取：平台、动作、岗位、数量和筛选条件。动作使用 `recommend`、`search`、`reply`、`publish_job`、`job_detail`、`resume_review`、`interview_invite` 或 `automation_plan`。薪资和数量保留用户原始表达，不自行换算。

“推荐或搜索，顺便回复消息”仍是一个主任务，回复只是平台任务内的监听要求。用户明确说“先回复，再推荐”时才拆成两个顺序动作。缺少会导致误操作的必要参数时一次只询问一个问题；推荐、搜索和批量回复没有数量时必须先询问数量。

## 加载平台能力

确定平台后必须调用 `search_capabilities`：

```json
{
  "query": "<平台中文名> <用户动作>",
  "kinds": ["skill"],
  "packageIds": ["<平台注册表中的 packageId>"],
  "requiredActions": ["<action>"]
}
```

多平台任务一次传入全部目标 `packageIds`，不要逐个平台重复搜索。已安装能力由系统直接加入当前任务，不要求用户重复授权。

如果平台未安装或未启用，记录该平台为失败，根据搜索结果说明安装或启用方式，其他已加载平台继续执行。搜索结果中的平台 instructions 是权威规则。平台 Skill 暴露的“读取 Skill 资源”工具用于读取 `tasks/*.md`；禁止调用工作目录 `read`、Shell、`cat` 或绝对路径读取这些文件。

## 浏览器前置条件

页面操作只能使用本轮暴露的 `browser_tabs`、`browser_open`、`browser_focus`、`browser_snapshot`、`browser_screenshot`、`browser_navigate`、`browser_click`、`browser_type`、`browser_press`、`browser_scroll` 和 `browser_wait`。没有目标平台标签页时，由平台 Skill 决定是否调用一次 `browser_open`；不要让用户仅因空标签页列表而手动打开网页。

如果本轮未暴露这些工具，说明当前模型或运行环境无法调用浏览器；停止页面操作并如实说明，不得声称已完成。禁止任意 JavaScript、CSS 定位线索、坐标点击、Shell、子 Agent 和并行操作多个平台。

## 执行规则

1. 先输出简短计划：操作、岗位、平台、数量和条件。
2. 多平台严格按 Boss直聘 → 鱼泡直聘 → 猎聘串行执行。
3. 每个平台只读取一个与动作对应的主 task；task 明确要求的内联阶段资源可继续读取。
4. 每个平台锁定自己的 `targetId`，不得跨平台复用 snapshot/ref。
5. 页面变化后旧 snapshot 失效，下一次交互前重新获取 snapshot。
6. 登录、扫码、验证码、安全验证、无法唯一定位元素时停止当前平台，截图并请求用户处理。
7. 发布职位只填写草稿，不点击最终发布、提交或确认发布按钮。
8. 单个平台失败不阻断其他平台；汇总时分别报告成功、跳过、失败和待人工处理。

## 自动化边界

由 Zimo Automation 调度的任务可按普通任务规则使用浏览器工具，但不自行创建调度、子 Agent 或常驻任务。遇到登录、验证码或安全验证时停止当前平台并报告待人工处理；不得伪造已执行或等待用户时无限挂起。`tasks/automation-plan.md` 仍只用于用户明确要求规划的场景。

## 结果汇总

最终按平台输出实际完成数量、跳过数量及原因、失败步骤、安全错误和待人工处理事项。未执行的平台不得显示为成功。
## 完整业务规则

开始平台任务前，使用本 Skill 的“读取 Skill 资源”工具读取 `references/operating-rules.md`，并遵循其中的业务状态机和结果协议。再读取对应的 `tasks/*.md`；任务索引列出多个分段时，必须按顺序读完后执行。运行工具与安全边界以本文件和 Zimo 浏览器协议为准。
