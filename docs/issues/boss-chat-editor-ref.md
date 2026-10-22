# Boss 聊天编辑器 ref 被误报为网页结构变化

## 症状与影响

2026-10-09 的 Boss 求职者回复任务在 `browser_type` 阶段报“网页结构已变化，请重新读取网页结构后再操作”。该次调用使用最新 `snapshotId`，却把 `[contenteditable="true"]` 作为 `ref`；校验在 CDP 输入前失败，消息没有写入或发送。

## 证据与根因

- 对用户已打开的 Boss 页面进行只读 CDP 检查：聊天编辑器是主文档中唯一的 `contenteditable="true"` 元素，Accessibility Tree 将其识别为无名称 `generic`，而不是 `textbox`。没有点击、输入或读取聊天正文。
- 快照补充器按固定选择器找到编辑器时，若它已在 AX 快照中拥有一个普通 ref，原实现直接跳过；模型因此看不到可识别的编辑器 ref。出错前的快照不含 `textbox` 标记。
- 已安装的 Boss Skill 与仓库源包均保留旧运行时说明，要求给 `browser_type` 传 CSS 定位线索及当前工具不支持的 `replace/submit` 参数；又要求无 ref 的 Enter。它们与 Zimo 的 `targetId + snapshotId + ref` 契约冲突。
- Adapter 原先把“ref 不在当前快照”和“快照 ID 已失效”合并为 `BROWSER_SNAPSHOT_STALE`，导致错误文案误导排查；Tool Loop 对该错误直接终止运行。

## 修复

- 固定 `contenteditable` 发现仍留在 CDP Adapter 内，不接收模型提供的 CSS。若编辑器已有 ref，把快照中的无名称 `generic` 标成 `textbox`，保留原 ref、受保护属性和节点/字符预算；未入 AX 的编辑器继续补充新 ref。
- `BROWSER_REF_NOT_FOUND` 与 `BROWSER_SNAPSHOT_STALE` 分开。普通会话中这两类错误前两次作为安全工具结果反馈模型，要求重新 `browser_snapshot`；继续失败则终止，不放宽目标校验。
- Boss 源 Skill 的公共操作规则、回复和面试邀约统一使用最新编辑器 ref。`browser_type` 只对空编辑器插入文本；输入不一致时不盲目追加或自动发送。Enter 必须携带输入后的最新 `snapshotId + ref`。

## 回归与剩余风险

单测覆盖 AX `generic` 编辑器复用 ref、ref 缺失与快照失效的不同错误码、有限恢复，以及 Boss 文案不再要求 CSS、`replace/submit`。真实站点交互仍需用户复测；多个编辑器、编辑器不在快照或输入值不可验证时，Skill 应停止发送并请用户在可见浏览器处理。仓库源 Skill 变更不会自动覆盖应用数据中已安装的用户副本或远端市场包，需更新相应包并重新安装后才会进入模型上下文。

## 2026-10-10：输入成功后 Enter 参数缺失

最新运行中，`browser_type` 已成功输入，随后 `browser_snapshot` 返回最新快照和 `ref_217` 编辑器；模型却调用 `browser_press` 时只传 `targetId` 与 `key=Enter`，缺少 `snapshotId/ref`。受控 Tool 在参数解析阶段返回 `TOOL_ARGUMENTS_INVALID`，没有执行 Enter，也没有发送消息。开发日志确认模型读取的仍是应用数据中的旧版 Boss Skill，其发送事务指令要求 `press key=Enter`；仓库源任务文件上方也留有相同缩写，与下方已修复的状态表冲突。

修复保持 Enter 的强校验：源 Skill 的所有发送指令统一写出最新 `targetId + snapshotId + 编辑器 ref + key=Enter`；Tool 描述明确普通按键的四个字段。对仅因缺少 `snapshotId/ref` 而无效的 Enter，普通会话最多一次把“按键未执行、不要再次输入、先重新快照核对草稿”的安全结果返回模型，让其改正；再次不合法则终止。Escape 的页面级语义和其他浏览器动作不变。模型工具 JSON Schema 因兼容 Escape 保留两个可选字段，由运行时执行条件校验；没有放宽发送权限或自动重试按键。

回归覆盖缺参 Enter → 未执行 → 重新快照 → 带最新 ref 执行，以及第二次仍缺参时停止。仓库 Boss 源包版本升至 `2.0.2`；已安装旧 Skill 不会被仓库文件覆盖，远端市场包也需对应更新并重装才能移除旧指令。即便恢复成功，仍必须通过发送后的新快照核实消息，不可凭按键成功推断送达。
