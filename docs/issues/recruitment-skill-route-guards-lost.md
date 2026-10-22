# 招聘 Skill 迁移丢失任务页面守卫

状态：已修复
日期：2026-10-08

## 症状与影响

统一招聘成功加载平台 Skill 后，模型可能没有先确认当前页面，就在 Boss直聘、鱼泡直聘或猎聘的其他业务页面识别候选人、点击沟通按钮或填写表单。Boss“推荐牛人”任务尤其可能没有进入 `/web/chat/recommend` 就开始执行。

## 证据与根因

旧版 Boss `tasks/recommend.md` 明确限制任务只能停留在 `/web/chat/recommend`，并包含进入、动作后验证和一次性恢复流程。迁移提交 `a6353ea` 为适配 Zimo `browser_*` 工具重写招聘 Skill 时，将多个数百行 task 压缩为十几行；旧 OpenClaw 工具语法被移除是必要的，但目标 URL 和页面状态守卫也被一并删掉。

同类缺失还包括 Boss 搜索、回复、职位管理，鱼泡推荐、搜索、回复、职位管理，以及猎聘推荐、搜索、回复、职位管理页面。

## 修复

- Boss、鱼泡、猎聘主 Skill 增加任务目标路由表和共用路由守卫。
- 十二个前台业务 task 明确完整目标 URL，要求同时验证 URL 与页面关键结构后才允许操作。
- 已在目标页时禁止重复导航；同平台页面优先点击菜单，菜单不可用时只允许一次受控导航。
- 动作后偏离目标页面时清空旧 snapshot ref 并最多恢复一次；登录、验证码、安全验证、站外页面或恢复失败时停止。
- 保持 Zimo 的 `browser_tabs/focus/snapshot/navigate/click/type/press/scroll/wait` 协议，不恢复 selector、坐标、JavaScript、Shell、TaskHub、子 Agent 或后台浏览器。
- 三个平台版本从 `2.0.0` 提升为 `2.0.1`，便于重新安装和识别更新。

## 回归覆盖与剩余风险

资源回归测试逐项验证十二个 task 保留目标 URL、验证和一次恢复语义，并验证三个主 Skill 保留共享路由守卫。招聘路由与 Desktop 打包资源 2 个测试文件/19 项测试、全仓 typecheck、本次变更 ESLint、Prettier 和 `git diff --check` 通过。Skill 指令只能约束模型行为，不能替代站点级运行时策略；平台改版导致 URL 或 accessibility 页面结构变化时仍需更新 Skill 并进行人工 smoke。

项目内 `resources/skills` 不进入 Electron 安装包，现有已安装 Skill 也不会自动读取源码变更。测试前需要卸载并重新本地安装对应平台 Skill，或通过 Skill Store 发布 `2.0.1` 后更新。
