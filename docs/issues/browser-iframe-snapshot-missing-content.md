# 浏览器快照未读取 iframe 内容

## 现象与影响

Boss 直聘“推荐牛人”等页面把候选人列表放在 iframe 中。模型的 `browser_snapshot` 只能看到主页面导航和 iframe 壳，无法获得候选人、筛选项或按钮的 ref，因此不能继续基于快照操作。

## 证据与根因

原 CDP Adapter 仅调用一次不带 `frameId` 的 `Accessibility.getFullAXTree`，只解析主 frame。`/Volumes/out/item/xclaw/openclaw` 已通过 `Page.getFrameTree` 和逐 frame 的 `Accessibility.getFullAXTree({ frameId })` 补齐同类场景。Zimo 原解析器另有 500 节点上限，复杂页面容易在目标元素之前截断。

## 修复

- 遍历 `Page.getFrameTree` 中最多 16 个嵌套 iframe，分别读取可访问性树；iframe 元素使用独立 ref 前缀，并与主页面 ref 一起保存到同一最新快照缓存。点击、输入、按键和滚动沿用现有 `backendNodeId` 链路，不向模型暴露 selector 或 JavaScript。
- 快照总节点上限提高到 2000；存在 iframe 时为主页面保留一半节点与字符预算，其余供 iframe 使用，避免导航壳吞掉整个结果。总输出仍限制为 30000 字符，以保持 Tool 返回有界。
- iframe 在读取时消失或当前 CDP session 不支持读取时，保留主页面快照、标记 `truncated` 并明确提示该 iframe 暂不可读，不生成虚假的可操作 ref。取消仍向上传播。
- 修正字符上限处的边界：未实际出现在快照正文中的节点不再进入 ref 缓存。

## 回归与剩余风险

定向测试覆盖嵌套 frame 合并、独立 ref、不可读 frame、取消和 2000 节点边界。真实 Boss 登录页及跨进程 iframe（OOPIF）仍需在目标 Chrome/Edge 版本人工验收；如果 `getFullAXTree({ frameId })` 对 OOPIF 不可用，后续需增加独立子 target session 与坐标映射，不能退化为任意 selector 或关闭浏览器 site isolation。
