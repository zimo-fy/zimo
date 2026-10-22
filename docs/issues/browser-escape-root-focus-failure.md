# Escape 误聚焦 RootWebArea 导致浏览器任务失败

## 症状与证据

2026-10-09 的 Boss 推荐牛人任务中，模型调用 `browser_press` 发送 Escape，并使用当前快照的 `ref_1`。该 ref 是主页面 `RootWebArea`。普通日志显示 `DOM.focus` 在约 1 毫秒内被 CDP 拒绝为 `protocol_error`，随后清理时 `Target.detachFromTarget` 也失败；此前同一任务的标签页、点击、等待和截图均成功。因此“请确认 Zimo 浏览器仍在运行”不能证明浏览器进程退出。

## 根因与修复

原 `press` 把所有按键都实现为元素级操作，要求快照和 ref，并在派发键盘事件前无条件执行 `DOM.focus`。`RootWebArea` 不是可靠的可聚焦 DOM 元素，Escape 在发出之前就失败。

参考 xclaw 的页面级 Escape，但不复制其网站 selector 和任意 JavaScript 聚焦：`browser_press` 的 Escape 现在只需要 `targetId + key`，直接向锁定的标签页派发 `rawKeyDown` 和 `keyUp`。为兼容已有模型调用，附带的旧 `snapshotId/ref` 可以保留但不会被 Escape 使用。Enter、Tab、方向键和空格仍要求最新快照与元素 ref，运行时再次校验，继续拒绝受保护字段。

## 验证与剩余风险

回归测试覆盖 Escape 不调用 `DOM.focus`、旧参数兼容、其他按键仍要求目标，以及聚焦失败不会继续发送其他按键。真实 Boss iframe 弹窗是否响应页面级 Escape 仍需人工验收；如果焦点实际位于其他 frame，后续应在不开放模型 selector/JavaScript 的前提下设计受控 iframe 定向按键，而不是恢复对 `RootWebArea` 的强制聚焦。通用 CDP 错误文案仍需另行区分协议拒绝与断连。
