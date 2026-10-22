# 本地浏览器自动化

## 用户体验

浏览器是登录账号的内建能力，不需要在会话“+”菜单中添加或关闭。普通会话、绑定的 Agent/Skill、Workflow Agent 节点与 Automation 专用会话均可由支持 Tool Calling 的模型按需调用。浏览器有独立持久 Profile；用户可在可见窗口中手动登录网站，后续同账号任务复用登录状态。能力默认可用只表示暴露受控 Tool，浏览器进程仍在首次实际调用时启动。

启用后模型可使用：

- 获取和聚焦标签页；
- 标签页列表为空或没有目标站点时，新建标签页打开公开网页，并返回真实标签页 ID；
- 读取有界的网页可访问性结构；
- 保存页面截图到当前会话 Workspace；
- 导航到公开 HTTP/HTTPS 网页；
- 通过最新快照的元素 ref 点击和输入普通文本。
- 对最新快照元素发送受限按键；Escape 作为页面级按键仅需目标标签页，滚动页面或容器仍要求最新快照；等待最长五秒并返回新快照。
- 快照会分别读取主页面和最多 16 个嵌套 iframe 的可访问性树，iframe 元素使用独立 ref；总节点上限 2000，正文上限 150000 字符。只有浏览器 `snapshot` / `wait` 的序列化 Tool 输出上限相应放宽，其他工具维持原边界。
- 快照在计入预算前省略重复 `InlineTextBox`、换行和已由父节点表达的文本；保留空容器及其 ref，以免误删可能的滚动目标。
- 快照沿 CDP `childIds` 深度优先输出，并用缩进表示会话项、候选人卡片等容器与文本的父子关系；无父子关系的节点仍保留为顶层。缩进只帮助模型理解页面，点击仍必须提交最新 `snapshotId + ref`。

浏览器操作按产品决策直接执行，不弹出审批卡。共享 Profile 同时只允许一个模型运行操作浏览器；其他运行会收到可重试的浏览器忙错误。用户手动在可见窗口操作时并不受这把模型运行锁约束。

浏览器启动使用回环地址上的随机非零 CDP 端口。应用只接受本次启动的浏览器进程报告的端点，并核对 CDP 服务实际返回的 WebSocket 地址；不使用固定公共调试端口。Profile 仍与日常浏览器隔离，网站仍可能要求登录或限制自动化访问。

用户手动关闭 Zimo 浏览器后，下一次浏览器调用会检查缓存 CDP 连接；连接已关闭则清除旧快照和标签页状态，重新探测 Profile 端点并按需启动浏览器。连接在命令发送时断开，只读标签页查询最多自动重试一次；点击、输入、导航和新建标签页不重放。新进程的标签页 ID 可能改变，旧 ID 仍须通过 `browser_tabs` 重新获取。

## 首版限制

- 只支持一个账号级默认 Profile，不提供多 Profile 管理。
- 不读取或附着用户日常浏览器的默认 Profile。
- 不支持私网、本机地址、`file:`、`javascript:`、浏览器设置页或任意 JavaScript。
- 不支持模型填写密码、验证码和受保护字段。
- Workflow 的 Agent 节点与 Automation 可调用浏览器 Tool；独立 Workflow 的截图存入本次运行 Workspace，会话内 Workflow 的截图存入来源会话 Workspace。
- 后台 Automation 不能等待用户在任务中确认登录或输入验证码；招聘 Skill 指令要求遇到此类页面时停止并报告待人工处理。调度器尚无 `needs_input` 终态，模型正常回复时运行仍可能记为 completed。应用退出、账号切换或登出时运行仍取消。
- 截图保存为 `workspaces/<conversation>/files/browser-captures/*.png`；首版尚未登记为文档附件，模型也不会在无视觉能力时直接理解图片。
- 网页内容和远端页面行为不可信；站点可能检测或阻止自动化。
- 跨进程 iframe 若无法通过当前 CDP session 读取，会在快照中明确标记为暂不可读；不会使用 selector、任意脚本或关闭 site isolation 绕过。

## 执行链路

1. 旧会话的 `browserEnabled` 字段暂保留兼容现有 SQLite/IPC，但不再控制执行；界面没有浏览器开关，保存能力时统一写 `true`。
2. 普通会话及 Workflow Agent 节点准备支持 Tool Calling 的模型请求时加入十一个 `zimo.browser.*` Tool；Automation 通过专用会话继承。
   开发态 `conversation_tool_round` payload 中对应的模型函数名固定为
   `browser_tabs/open/focus/snapshot/screenshot/navigate/click/type/press/scroll/wait`。
   包括无参数的 `browser_tabs` 在内，所有函数都使用严格 object JSON Schema，兼容
   OpenAI-compatible 网关对 `tools[].function.parameters` 的校验。
3. 模型先调用 `tabs`；首次启动未发现任何页面时，Adapter 等待 200ms 后只重试一次。已有目标标签页优先复用；只有空白页时可用 `navigate`，没有目标站点或可用空白页时可用 `open` 新建公开 HTTP(S) 页面，取得真实 `id` 作为后续 `targetId`，再调用 `snapshot` 或 `wait` 验证。`navigate` 仍只操作已有标签页，不会自动创建；空列表本身不代表需要用户登录。
4. `snapshot` 返回 `snapshotId` 和元素 `ref`；iframe 使用独立 ref 前缀，并与主页面 ref 同样绑定当前快照。`click/type` 必须同时提交 target、snapshot 和 ref。
5. 页面变化会使旧 snapshot 失效，模型收到 `BROWSER_SNAPSHOT_STALE` 后重新读取。
   登录和页面完成状态由具体 Skill 的业务规则判定。模型传入不存在的 `targetId` 时，前两次 `BROWSER_TARGET_NOT_FOUND` 会作为安全工具结果返回，要求重新 `browser_tabs` 选择真实标签页；持续错误仍终止运行，不自动替换目标。
   `press` 只接受有限按键：Escape 仅需 `targetId + key`，即使提供旧 `snapshotId/ref` 也不聚焦元素；其他按键必须提供 `targetId + 最新 snapshotId + ref + key`。兼容 Escape 的模型 Tool Schema 将 `snapshotId/ref` 声明为可选，但运行时对其他按键严格校验；仅缺少目标的 Enter 最多一次返回安全工具结果，要求模型重新快照核对草稿后补全参数，不会代它发送。`scroll` 限制距离并要求最新 snapshot；`wait` 只接受 100–5000ms 且直接返回新 snapshot。
   Adapter 仅用固定 `[contenteditable="true"]` 规则识别编辑器：AX 中已有 ref 的 `generic` 编辑器标为 `textbox`，未入 AX 的编辑器补充新 ref；不接受模型提供 selector。无效 ref 返回 `BROWSER_REF_NOT_FOUND`，与过期快照的 `BROWSER_SNAPSHOT_STALE` 区分；普通会话最多两次把这两类错误反馈给模型重新取快照，持续失败则终止。
6. Main 的 CDP Adapter 启动或复用 Zimo Profile 浏览器，并将结果通过 Controlled Tool 链路返回模型。

## 数据与日志

- `0038_conversation_browser_capability.sql` 为会话增加布尔绑定，默认关闭。
- 浏览器 Profile 位于账号内部目录，不保存到 SQLite，不进入 Renderer。
- 每次调用沿用统一 Tool 审计；普通日志不记录 URL、页面内容、输入文本或截图。
- CDP 命令失败另记 `browser.cdp.command.failed`，仅记录安全方法名、固定原因枚举和耗时；不记录原始错误、命令参数或网页数据。
- `conversation_response` 记录应用层基础消息请求，不包含 Tool Schema；应在同一
  `conversationId + runId` 的 `conversation_tool_round.request.tools` 中确认浏览器工具。

## 验证重点

- Schema 拒绝未知字段、超长参数和元素级按键缺失的 snapshot/ref；Escape 可省略这两项；
- 私网与非 HTTP(S) 地址拒绝；
- 新建标签页对非法 URL 不发出 CDP 创建命令，缺少 CDP `targetId` 时不伪报成功；首次空列表只重试一次且可取消；
- 旧快照失效、密码字段拒绝输入；
- 取消、命令超时、CDP 断线和浏览器退出；
- 手动关闭浏览器后再次获取标签页可重连；旧标签页 ID 返回明确错误；取消及有副作用操作不自动重试；
- macOS arm64/x64、Windows x64 的 Chrome/Edge 发现和 Profile 持久化；
- 打包应用退出时只关闭由 Zimo 管理的浏览器进程。
