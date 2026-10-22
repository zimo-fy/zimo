# 统一招聘 Skill 调度

## 用户体验

用户在普通会话或 Automation 专用会话中只需要绑定“招聘平台统一调度”Skill；浏览器是内建能力，无需另外添加或开关。Boss直聘、鱼泡直聘和猎聘平台 Skill 需要预先安装并启用，但无需逐个绑定到会话，也不会要求重复授权。

统一招聘从用户指令提取平台、动作、岗位、数量和筛选条件，然后以稳定 package ID 调用 `search_capabilities` 精确加载平台能力：

- `zimo.boss-zhipin`
- `zimo.yupao`
- `zimo.liepin-hr`

未指定平台时按 Boss直聘、鱼泡直聘、猎聘串行执行。单个平台失败不会伪造成功，也不会阻断其他已加载平台。

## 运行链路

1. 会话或 Automation 绑定统一招聘 Skill；运行时自动获得已注册的浏览器 Tool。平台 Skill 优先复用已打开的业务标签页；没有目标平台标签页时可调用一次 `browser_open` 创建，使用返回的真实 ID 继续，不因 `browser_tabs` 为空直接要求用户手动打开页面。
2. 统一招聘一次调用 `search_capabilities`，通过 `packageIds` 精确加载一个或多个平台 Skill。
3. Capability Discovery 只接受已安装、启用且编排 package ID 唯一完全匹配的 Skill，并在当前 run 动态注册其受控工具；重复身份按未命中处理。
4. 每个平台 Skill 注册只读的包内资源工具；模型从安装清单枚举中读取一个 `tasks/*.md`，不访问会话 Workspace 或源码目录。
5. 当前模型在同一个 Tool Loop 中执行平台指令；不创建子 Agent、子会话或额外模型请求。
6. 浏览器操作使用 Zimo 独立 Profile。多平台共享浏览器时必须串行，并分别锁定 target、snapshot 和 ref。
7. 统一招聘按平台汇总实际成功、跳过、失败和待人工处理事项。

## 平台任务页面守卫

平台 Skill 的推荐、搜索、回复和职位管理任务各自声明唯一目标页面。每个任务必须先用最新浏览器快照同时验证 URL 与页面关键结构，验证前不得执行候选人点击、沟通、消息发送或表单填写。

| 平台     | 推荐                  | 搜索                 | 回复              | 职位管理             |
| -------- | --------------------- | -------------------- | ----------------- | -------------------- |
| Boss直聘 | `/web/chat/recommend` | `/web/chat/search`   | `/web/chat/index` | `/web/chat/job/list` |
| 鱼泡直聘 | `/web/find-worker`    | `/web/search-worker` | `/web/im`         | `/web/job-manage`    |
| 猎聘     | `/recommend`          | `/search`            | `/chat/im`        | `/job/manager`       |

已经处于目标页面时不得重复点击菜单或导航。位于同平台其他已登录页面时优先通过最新快照中的菜单切换；菜单不存在、被遮挡或无法唯一确认时，只允许一次 `browser_navigate` 前往完整目标 URL。动作后偏离目标页面时清空旧 ref 并最多恢复一次；恢复失败、进入登录/验证页或离开平台域名时停止任务，不得在错误页面继续操作。

## Skill 包结构

仓库中的制作目录使用英文 slug，展示名称保留中文：

```text
apps/desktop/resources/skills/
├── recruitment-hub/
├── boss-zhipin/
├── yupao/
└── liepin-hr/
```

每个包必须在 `manifest.json` 和 `SKILL.md` frontmatter 中声明一致的稳定 `packageId`；本地安装读取 manifest，Skill Store 安装后的能力编排读取已持久化 frontmatter。这些源码目录继续被 Electron Builder 排除，不会随应用安装包分发；修改后需要重新本地安装或发布到 Skill Store。

## 包内资源读取

Skill Runtime 为包含受支持文本资源的已加载 Skill 注册 `skill.<skillId>.read_resource` Tool。输入只包含安装清单枚举中的相对 `path`。

边界：

- 只允许 `.md/.txt/.json/.yaml/.yml/.csv`；
- 不暴露 `SKILL.md`、`manifest.json` 或 `scripts/`；
- 单资源最多 64 KiB；
- 校验 skill ID、checksum、安装清单和规范化相对路径；
- 拒绝绝对路径、`..`、符号链接逃逸、非 UTF-8 内容和未声明文件；
- Tool 输出正文不进入普通日志。

## 浏览器补充动作

- `browser_press`：要求最新 `snapshotId + ref`，只允许 Enter、Escape、Tab、ArrowUp、ArrowDown 和 Space。
- `browser_scroll`：要求最新 snapshot，滚动距离限制为 -1000 到 1000；可选择快照中的容器 ref。
- `browser_wait`：等待 100 到 5000ms 后直接返回新快照，替代 Skill 中不可取消的 Shell sleep。
- snapshot 使用 Adapter 内固定的 `[contenteditable="true"]` 发现规则补充聊天编辑框 ref；模型不能提交 selector。

Boss 推荐牛人任务向下查找时使用最新快照中当前已加载列表的最后一张候选人卡片 ref。CDP Adapter 先对 ref 执行 `DOM.scrollIntoViewIfNeeded`，再在卡片位置派发最多 1000 的向下滚动，因此一次 Tool 调用可到达当前批次底部并触发懒加载；并非滚动整个页面 viewport。动作后重新读取快照，若暂未出现新候选人则有界等待，不能因一次无变化就断言没有后续批次。快照截断或末卡 ref 不明时不得声称已到底；任务仍保留 30 次滚动硬上限。

继续禁止任意 JavaScript、任意 CSS selector、坐标点击、console/network、密码或验证码输入。

## 当前限制

- Workflow Agent 节点和 Automation 专用会话也可获得浏览器 Tool；独立 Workflow 测试不自动绑定招聘 Skill。
- `automation-plan.md` 仅在用户明确要求规划时使用；已由 Zimo Automation 调度的招聘任务按对应业务 task 执行，不由 Skill 自行创建调度或 TaskHub。登录或验证页面必须停止并报告待人工处理。
- accessibility snapshot 和固定 contenteditable 发现都找不到目标时必须交给用户手动处理。
- 平台 Skill 当前仍可在 Skill 列表中单独选择；隐藏为“仅编排调用”需要后续增加 manifest/UI 可见性契约。

## 验证

- 精确 package ID 不会误加载统一招聘或其他招聘平台；
- 一次请求可以加载三个平台注册能力；
- 包内资源拒绝路径穿越和脚本读取；
- press/scroll/wait Schema 拒绝未知字段和越界参数；
- 页面动作后旧 snapshot 失效；
- 每个平台业务 task 保留目标 URL、页面验证和一次性路由恢复规则；
- managed Workspace 物理目录丢失后在下一次访问时重新确保存在；
- 打包产物继续排除 `resources/skills`。
