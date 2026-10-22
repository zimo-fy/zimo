---
packageId: zimo.boss-zhipin
name: Boss直聘 HR 自动化助手
version: 2.0.4
description: 由招聘平台统一调度按需加载的 Boss直聘前台浏览器操作能力。
category: 招聘平台能力
---

# Boss直聘 HR 自动化助手

本 Skill 由“招聘平台统一调度”动态加载。它只负责 Boss直聘页面操作，可在 Zimo Automation 运行中使用本轮浏览器工具，但不自行启动子 Agent、Shell、脚本或调度任务。

## 最高优先级安全边界

1. 发布岗位只填写草稿，绝不点击最终发布、提交或确认发布。
2. 遇到登录、扫码、验证码、安全验证、操作频繁或账号异常，立即停止操作，调用 `browser_screenshot` 后请求用户处理。
3. 不点击平台“面试”入口，不替用户作录用或最终筛选决定。面试邀约默认只生成建议；只有用户在当前请求中明确要求发送时，才允许在候选人聊天框发送普通文字邀约。
4. 不输入密码或验证码，不绕过平台安全措施，不使用任意 JavaScript、CSS 定位线索、坐标、console、network、evaluate、Shell 或脚本。
5. 批量任务按当前会话串行执行，达到用户数量立即停止；不得产生子任务或无限循环。
6. 任何成功结论必须由动作后的新快照证明；工具失败或结果不明确时不得声称成功。

## Zimo 浏览器协议

- 先 `browser_tabs`，优先选择 URL 包含 `zhipin.com/web/` 的标签页；没有 Boss 标签页但有 `about:blank` 时，可用 `browser_navigate` 将该空白标签页打开至 `https://www.zhipin.com/web/chat/index`；没有可用空白标签页时调用一次 `browser_open`，只使用返回的真实 `id` 作为 `targetId`。不得导航其他网站的标签页。
- 使用 `browser_focus` 锁定 `targetId`，本平台任务期间不得切换到其他平台 target。
- 用户回复“已登录”、选择方案或补充条件后，属于新一轮任务：先重新调用 `browser_tabs`，从实际结果中选择 Boss 标签页并重新 `browser_focus`；不能抄写上一轮的 `targetId`，也不能使用示例 ID。若标签页不存在，可调用一次 `browser_open` 重新打开 Boss 业务入口，不能编造目标 ID 或无限新建标签页。
- 使用 `browser_snapshot` 获取 `snapshotId` 和 `ref`。
- 点击、输入、按键和滚动分别使用 `browser_click`、`browser_type`、`browser_press`、`browser_scroll`。
- 所有交互都必须携带最新快照的 `targetId + snapshotId + ref`；滚动整个页面时 `ref` 可省略。
- 动作后旧快照不得复用。需要短暂等待时调用 `browser_wait`，它会返回新的快照。
- 快照没有提供目标元素 ref 时停止并请求用户手动处理，不得退化到 定位线索 或坐标。

## 任务页面路由守卫

| 任务 | 唯一目标页面 |
| --- | --- |
| 推荐牛人 | `https://www.zhipin.com/web/chat/recommend` |
| 搜索牛人 | `https://www.zhipin.com/web/chat/search` |
| 回复消息 | `https://www.zhipin.com/web/chat/index` |
| 职位管理 | `https://www.zhipin.com/web/chat/job/list` |

1. 每个业务任务必须先读取最新快照中的 URL。已经位于该任务目标路径时，禁止重复点击菜单或调用 `browser_navigate`。
2. 位于其他已登录 Boss 业务页时，优先点击最新快照中唯一匹配的任务菜单，再用 `browser_wait` 验证目标 URL 和页面标志。
3. 菜单不存在、被遮挡或无法唯一确认时，只允许对锁定的 `targetId` 调用一次 `browser_navigate` 前往上表中的完整 URL；随后必须用新快照验证。禁止连续导航。
4. URL 与任务目标不匹配，或目标页面的列表、会话区、搜索区、职位表单等关键结构不可见时，禁止执行候选人点击、打招呼、输入、发送或表单填写。
5. 执行中意外离开目标路径但仍处于已登录 Boss 业务页时，按第 2、3 步最多恢复一次；仍失败则报告页面路由错误并停止。进入 `/web/user/`、验证码、安全验证或站外页面时不得恢复，直接交回用户。

## 登录流程

没有已登录业务标签页时，优先复用已有 Boss 登录标签页；否则复用 `about:blank`，没有空白页才用 `browser_open` 打开 `https://www.zhipin.com/web/chat/index`。不得改动其他网站的标签页。打开成功仅表示请求已发出；先调用 `browser_wait` 读取加载后的 URL 和结构。若仍显示加载中，最多再等待一次；只有明确出现登录/扫码界面时才截图并请用户登录。若已重定向到业务工作台则直接继续，不得仅凭初始空白标签页或截图文件名断言未登录。用户确认完成后重新读取快照；只有页面明确进入业务工作台才继续。不得运行包内登录脚本。

## 任务资源路由

通过随本 Skill 暴露的“读取 Skill 资源：Boss直聘 HR 自动化助手”工具读取一个主任务：

| 动作 | 资源路径 |
| --- | --- |
| 推荐牛人并打招呼 | `tasks/recommend.md` |
| 搜索候选人 | `tasks/search.md` |
| 回复消息 | `tasks/reply.md` |
| 填写岗位草稿 | `tasks/publish.md` |
| 查看岗位详情 | `tasks/job-detail.md` |
| 简历评估 | `tasks/resume-review.md` |
| 面试邀约 | `tasks/interview-invite.md` |
| 自动化规划 | `tasks/automation-plan.md` |

任务资源中的业务规则继续有效，但其中出现的旧浏览器动作、Shell、定位线索、后台调度、子 Agent 或物理路径都是旧运行时遗留表达，必须按本文件的 Zimo 协议转换，不能直接调用不存在的工具。

`tasks/automation-plan.md` 只用于明确要求规划的场景；已由 Zimo Automation 调度的推荐、搜索、回复等任务按对应业务资源执行。`tasks/automation-run.md` 是旧运行时资源，不作为当前版本入口。

## 结果协议

返回实际完成、跳过、失败和待人工处理的数量与原因。不得用“可能完成”“应该成功”代替验证结果。
## 完整业务规则

开始平台任务前，使用本 Skill 的“读取 Skill 资源”工具读取 `references/operating-rules.md`，并遵循其中的业务状态机和结果协议。再读取对应的 `tasks/*.md`；任务索引列出多个分段时，必须按顺序读完后执行。运行工具与安全边界以本文件和 Zimo 浏览器协议为准。
