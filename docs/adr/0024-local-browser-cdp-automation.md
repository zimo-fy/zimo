# ADR 0024：独立 Profile 的本地浏览器 CDP 自动化

- 状态：Accepted
- 日期：2026-09-23
- 适用阶段：V0.2 Phase 11

## 背景

Zimo 需要让普通会话中的模型操作用户本机浏览器，包括标签页枚举、聚焦、页面结构读取、截图、导航、点击和输入。已有 `web_search` / `web_fetch` 不保存网页登录态，也不能完成页面交互。`/Volumes/out/item/xclaw` 已有直接 CDP 实现，但其 OpenClaw 路由、Playwright 路径、站点专用规避逻辑和超大 `stealth-cdp.ts` 不适合整体迁入。

Chrome 136 起默认用户数据目录上的远程调试开关不再生效。直接附着用户日常 Profile 还会让模型接触 Cookie 和已登录账号，因此必须使用 Zimo 管理的非默认 Profile。

## 决策

1. 首版启动用户已安装的 Chrome、Edge、Brave 或 Chromium，使用可见窗口、随机调试端口和账号级 `accounts/<account>/browser-profiles/default/user-data`；不捆绑浏览器二进制。
2. CDP 只监听并连接 `127.0.0.1`。Renderer、模型和普通 IPC 不获得端口、WebSocket 地址、Profile 真实路径或通用 CDP 命令入口。
3. 普通前台会话默认启用浏览器，并可在会话“添加能力”中关闭；只有带前台窗口所有者的普通会话注入浏览器 Tool。Workflow 和 Automation 首版不注入，Automation 创建和保存时继续显式关闭该标记。
4. 模型侧提供 `tabs`、`focus`、`snapshot`、`screenshot`、`navigate`、`click`、`type`、`press`、`scroll`、`wait` 十个小 Tool。交互必须引用当前 target 最新 snapshot 中的 opaque ref；`press` 只允许有限按键，`scroll` 距离有界，`wait` 最长五秒并返回新 snapshot。Adapter 可使用固定 contenteditable 规则补充 ref，但不接受模型提供 CSS Selector，继续禁止任意 JavaScript、console、upload 或 Runtime.evaluate。
5. 页面理解优先使用有界 Accessibility Tree。密码/受保护字段不返回值且拒绝模型输入；截图写入会话 Workspace，Tool 不返回 Base64。
6. 按用户明确产品决策，浏览器操作不进入动作审批、不做动作风险分级，绑定后直接执行。它们仍经过 Tool Schema、会话绑定、URL/协议限制、超时、取消和统一 Tool 审计。
7. 保留浏览器自身 OS sandbox；禁止 `--no-sandbox`、关闭 site isolation、`--remote-allow-origins=*` 等降级参数。“低侵入 CDP”不承诺绕过网站检测或服务条款。

2026-10-10 增量：调试端口仍随机且仅绑定回环，但启动参数改为非零端口。Main 先向系统申请空闲端口，随后从本次浏览器子进程的 stderr 读取其 CDP WebSocket 地址，并校验端口及 `/json/version` 返回的地址一致后才连接；端点以仅用户可读的文件保存在独立 Profile 中供应用重启后复用。若端口被占用、子进程未提供端点或校验失败，则终止本次启动，不连接其他本地浏览器。不能保证任何网站接受自动化访问。

2026-10-12 增量：第 3、6 条中“前台窗口所有者/会话绑定”限制由用户明确决策替换为内建运行能力。浏览器 Tool 向普通会话、Workflow Agent 节点以及通过专用会话执行的 Automation 开放，不要求用户添加或修改绑定；Agent/Skill 继承所在运行的工具目录。仍须登录账号、支持 Tool Calling，并沿用受控 Schema、公开 URL 限制、超时、取消与审计。旧 `browser_enabled` 字段只保留兼容，不参与执行决策；新保存统一写 true。Main 对共享账号 Profile 的模型运行采用首个浏览器调用取得、Tool Loop 结束释放的互斥租约；其他运行收到可重试的 `BROWSER_RUN_BUSY`，不得并行操作同一标签页。独立 Workflow 截图使用本次运行 Workspace，会话内 Workflow 使用来源会话 Workspace。招聘 Skill 指令要求后台运行遇到登录或验证时停止并报告待人工处理，不等待不存在的前台交互；调度器尚无独立 `needs_input` 状态，模型正常回复时该次 Automation 仍可能记为 completed。此变更扩大了已登录网页自动操作范围，原有无需动作审批的残余风险也扩展到 Automation；发布前须再次评审。

2026-10-12 标签页创建增量：第 4 条的十个 Tool 扩展为十一个，新增 `browser_open({url})`。它只在 Main/CDP Adapter 校验公开 HTTP(S) 地址后调用 `Target.createTarget`，返回真实 `id` 供后续快照与交互使用；`browser_navigate` 保持必须提供现有 `targetId` 的契约。`browser_tabs` 首次空结果仅短暂重试一次，避免浏览器刚启动时的页面发现竞态；仍为空时由模型按任务显式决定是否新建标签页，不自动打开任意站点。创建与导航沿用同一 URL 边界、运行互斥、超时取消和脱敏审计；不新增 Renderer/IPC 通用浏览器入口。招聘 Skill 仅在看到登录或验证页面后请求人工介入。

## 安全边界

- 只允许公开解析的 HTTP/HTTPS 导航，拒绝凭据 URL、本机、私网、链路本地和保留地址；首版 DNS 检查仍存在解析后变化的残余风险。
- 独立 Profile 不继承用户默认浏览器登录态，用户需要在可见窗口中手动登录。
- Cookie、LocalStorage、密码、验证码、网页正文、输入值和截图正文不得进入普通日志；审计只记录 Tool ID、输入键、耗时和结果。
- Profile 目录属于内部账号数据，通用 Workspace/File Tool 必须继续拒绝访问。
- 关键账号、支付、删除或发布动作首版没有人机审批保护，这是用户选择的显式残余风险；正式发布前应重新评审是否增加站点/动作级策略。

## 后果

- 优点：不依赖运行时下载、stdio MCP 或 Playwright；模型 Tool Schema 小；可复用现有 Controlled Tool、流式 Tool Loop、取消和审计链路。
- 代价：需要维护 Chrome CDP 版本兼容性、浏览器发现、Profile 生命周期和 macOS/Windows 打包态测试。
- 当前默认模型未声明视觉能力，截图可以保存和展示，但模型首版主要依赖 Accessibility Snapshot。
