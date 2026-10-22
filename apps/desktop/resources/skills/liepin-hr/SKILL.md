---
packageId: zimo.liepin-hr
name: 猎聘网 HR 自动化助手
version: 2.0.3
description: 由招聘平台统一调度按需加载的猎聘企业端前台浏览器操作能力。
category: 招聘平台能力
---

# 猎聘网 HR 自动化助手

本 Skill 由“招聘平台统一调度”动态加载，只负责猎聘企业端前台页面操作。猎聘不是智联招聘。

## 安全边界

1. 发布岗位只填写草稿，不点击最终发布、提交或确认发布。
2. 登录失效、二维码、验证码、安全验证、操作频繁或账号异常时立即停止，截图并请求用户处理。
3. 不输入密码或验证码，不绕过安全措施，不使用 JavaScript、定位线索、坐标、console、network、evaluate、Shell、脚本或子 Agent；可由 Zimo Automation 调度，但不自行创建后台任务。
4. 不进入平台面试管理页，不替用户作录用决定。所有成功结果必须由动作后的新快照验证。

## Zimo 浏览器协议

1. `browser_tabs` 优先选择 URL 包含 `lpt.liepin.com` 且不是登录页的标签页；没有猎聘标签页时先对 `about:blank` 用 `browser_navigate` 打开 `https://lpt.liepin.com/`，没有空白页才调用一次 `browser_open`。使用真实 `targetId`，不要改动其他网站的标签页。
2. `browser_focus` 锁定 `targetId`，再用 `browser_snapshot` 获取 `snapshotId` 和 `ref`。
3. 使用 `browser_click`、`browser_type`、`browser_press`、`browser_scroll` 操作最新快照中的元素。
4. 动作后旧快照失效；等待页面更新使用 `browser_wait` 并直接采用返回的新快照。
5. accessibility tree 未提供目标 ref 时停止并请求人工操作，不得使用 CSS 定位线索 或坐标。

没有已登录业务标签页时，先读取已有猎聘登录页；没有猎聘标签页则复用 `about:blank` 导航到业务入口，连空白页也没有时才用 `browser_open`。用 `browser_wait` 核对新页面；只有明确出现登录或验证界面时才让用户在可见浏览器中处理，然后重新读取快照确认。

## 任务页面路由守卫

| 任务 | 唯一目标页面 |
| --- | --- |
| 推荐候选人 | `https://lpt.liepin.com/recommend` |
| 搜索候选人 | `https://lpt.liepin.com/search` |
| 回复消息 | `https://lpt.liepin.com/chat/im` |
| 职位管理 | `https://lpt.liepin.com/job/manager` |
| 新建职位草稿 | `https://lpt.liepin.com/job/publish?ejobActionType=publish` |

每个业务任务先从最新快照核对 URL。已经处于目标路径时禁止重复点击菜单或导航；位于其他已登录猎聘企业端页面时优先点击对应菜单，并用 `browser_wait` 验证目标 URL 和页面关键结构。菜单不可用时只允许一次 `browser_navigate` 前往上表完整 URL，随后必须验证。验证完成前禁止点击候选人、沟通、发送消息或填写岗位。执行中偏离目标路径时最多恢复一次；进入登录、安全验证、账号异常或站外页面时立即停止并交回用户。

## 任务资源路由

使用随本 Skill 暴露的“读取 Skill 资源：猎聘网 HR 自动化助手”工具：

| 动作 | 资源路径 |
| --- | --- |
| 推荐候选人 | `tasks/recommend.md` |
| 搜索候选人 | `tasks/search.md` |
| 回复消息 | `tasks/reply.md` |
| 填写岗位草稿 | `tasks/publish.md` |

任务资源中的业务规则继续有效；其中旧浏览器动作、Shell、旧任务调度、定位线索和物理目录均为旧运行时表达，必须转换为本文件定义的 Zimo 工具，不得直接调用。

## 结果协议

返回实际成功、跳过、失败和待人工处理的数量与原因；达到用户指定数量立即停止。
## 完整业务规则

开始平台任务前，使用本 Skill 的“读取 Skill 资源”工具读取 `references/operating-rules.md`，并遵循其中的业务状态机和结果协议。再读取对应的 `tasks/*.md`；任务索引列出多个分段时，必须按顺序读完后执行。运行工具与安全边界以本文件和 Zimo 浏览器协议为准。
