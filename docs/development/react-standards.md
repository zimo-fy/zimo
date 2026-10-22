# React 前端规范

## 组件边界

- 页面负责布局和用例编排，feature hook/reducer 负责复杂呈现状态，具名子组件负责独立 UI 区域；
- 组件优先小于 300 行；拆分以用户功能和状态所有权为边界，不以 JSX 行数机械切片；
- Props 使用具名 type/interface，输入尽量只读；不使用 `React.FC` 隐式引入 children；
- 组件保持纯渲染，不在 render 中发请求、写存储、生成持久 ID 或改变外部状态；
- 列表使用实体稳定 ID；可增删或重排列表禁止使用数组下标作为 key。

## 状态与数据流

- 状态放在最低共同所有者；同一事实只保留一个权威来源，派生值在 render 计算而非同步复制到 state；
- 多个互斥 boolean 改为判别联合，例如 `idle | loading | ready | error`；
- 临时表单、弹层和交互状态留在组件；跨页面业务数据通过明确的 feature/query 层管理；
- 不把 API Key、文件正文、模型上下文或大型二进制放入 React Context、全局 store 或 localStorage；
- state 更新依赖旧值时使用函数式 setter；不得直接修改 state 中的对象和数组。

## Hook 与副作用

- Hook 只在组件或自定义 Hook 顶层调用；依赖数组完整，不通过禁用 lint 隐藏依赖问题；
- `useEffect` 只同步外部系统或管理订阅，不用于计算派生状态、响应普通点击或串联可直接调用的业务步骤；
- effect 中的请求处理卸载和过期响应，使用 AbortController、活动标记或 request ID；订阅、timer 和 observer 必须清理；
- 不滥用 `useMemo`、`useCallback` 和 `memo`；只有引用稳定是契约要求或性能测量证明有效时使用；
- 自定义 Hook 以 `use` 开头，返回领域动作和判别状态，不泄露难以正确组合的内部 setter。

## 事件与表单

- Props 回调命名 `onSave`、`onDelete`，内部处理函数命名 `handleSave`；异步事件显式处理 Promise 和错误；
- 表单使用语义化 `form` 与 submit；输入有可见 label，校验错误通过 `aria-describedby`/`aria-invalid` 关联；
- 保存期间防止重复提交，并清晰呈现进行中、失败和成功；危险操作说明对象和后果并要求确认；
- 不得使用 `window.alert` / `window.confirm`；提示与确认一律走 `AppDialogProvider` 的应用内对话框，以便焦点留在 Chromium 并在关闭后回到触发器或后续输入框；
- 受控与非受控输入不要在生命周期中切换；表单默认值从实体变化时用稳定 key 或明确 reset；
- 输入框带前后图标时必须预留对应 padding，内容、清除按钮和密码可见性按钮不得重叠。

## 组件与视觉系统

- 优先使用 `@zimo/ui` 和 feature 公共组件；页面不得重复实现 Button、Select、Dialog、Tooltip 等基础交互；
- 使用设计 token 和 Tailwind 约定值，禁止散落难以复用的十六进制颜色、任意 z-index 和近似间距；
- 原生能力无法满足一致交互时使用已批准的 accessible primitive；自定义 Select/Dialog/Menu 必须保留键盘行为和焦点管理；
- 响应式布局至少覆盖窄窗口、常规桌面和长文本；不用固定高度截断关键操作；
- 动画简短且表达状态，遵守 `prefers-reduced-motion`，不让动画成为完成操作的前提。

## 可访问性

- 优先使用原生语义元素；可点击行为使用 button/link，不给 div 模拟按钮；不得嵌套交互元素；
- 所有功能可仅用键盘完成；焦点可见，弹层打开后聚焦合理位置，关闭后返回触发器；
- 仅图标按钮必须提供 `aria-label` 和可选 tooltip；图片提供有意义 alt，纯装饰图标隐藏于辅助技术；
- loading、错误、保存结果使用合适的 `role=status`/live region；状态不能只靠颜色区分；
- 标题层级、landmark 和 tab 顺序符合视觉结构；不使用正 tabindex 重排焦点。

## 安全与内容渲染

- Renderer 只调用 typed `window.zimo`，不得导入 Node/Electron、直接访问数据库、文件路径或模型 SDK；
- 不使用 `dangerouslySetInnerHTML` 渲染用户、模型、Markdown 或 Tool 内容；Markdown 禁 raw HTML 并限制链接协议；
- 外链必须走 Main 的受控 HTTPS allowlist 和明确用户动作；不在 WebView/iframe 加载未知内容；
- 错误 UI 只展示产品错误消息，不显示 stack、内部路径、SQL、响应正文或认证信息。

## 前端测试

- 组件测试覆盖用户可见行为、键盘操作、焦点、loading/empty/error/disabled，不断言内部 state 或私有函数；
- 查询优先 role、label 和可见文本，`data-testid` 只用于无稳定语义的场景；
- 核心旅程使用 Electron E2E，覆盖窄窗口和安全边界；不为快照通过而接受不可读的大型快照；
- 修复竞态、重复提交、焦点或布局问题时补对应回归用例。
