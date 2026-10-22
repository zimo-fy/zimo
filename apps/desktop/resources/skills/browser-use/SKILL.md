---
name: browser-use
description: "AI-powered browser automation via browser-use CLI (`uvx browser-use`). Navigate websites, click elements, fill forms, take screenshots, extract data, and automate web tasks. Use when user needs to interact with web pages, scrape data, fill forms, automate workflows, or test websites. First-time use: run `uvx browser-use install` to set up Chromium."
description_zh: "AI 驱动的浏览器自动化（导航、交互、截图、数据提取）"
description_en: "AI-powered browser automation: navigate, interact, screenshot, extract"
version: 1.0.0
allowed-tools: Bash,Read
---

# Browser-Use — AI 浏览器自动化

通过 `uvx browser-use` 命令行控制浏览器，无需手动安装依赖。

## 首次使用

```bash
# 安装 Chromium（仅首次需要）
uvx browser-use install

# 检查环境是否就绪
uvx browser-use doctor
```

## 标准工作流

浏览器会在命令之间保持运行，实现快速交互。

### 1. 打开网页

```bash
uvx browser-use open https://example.com
```

### 2. 查看页面状态（获取可交互元素列表）

```bash
uvx browser-use state
# 返回 URL、标题、可点击元素及其索引号
```

### 3. 交互操作

```bash
# 点击元素（使用 state 返回的索引号）
uvx browser-use click 5

# 在输入框中输入文字
uvx browser-use input 3 "搜索内容"

# 通用打字（输入到当前焦点元素）
uvx browser-use type "Hello World"

# 滚动页面
uvx browser-use scroll down
uvx browser-use scroll up

# 悬停
uvx browser-use hover 7

# 下拉框选择
uvx browser-use select 4 "option-value"

# 键盘按键
uvx browser-use keys Enter
uvx browser-use keys "Control+a"

# 上传文件
uvx browser-use upload 6 /path/to/file.pdf
```

### 4. 获取数据

```bash
# 截图保存
uvx browser-use screenshot page.png

# 提取结构化数据（需要 LLM API key）
uvx browser-use extract "提取页面上所有产品名称和价格"

# 执行 JavaScript 获取数据
uvx browser-use eval "document.title"
uvx browser-use eval "document.querySelectorAll('h2').length"
```

### 5. 页面导航

```bash
# 后退
uvx browser-use back

# 切换标签页
uvx browser-use switch 2

# 关闭当前标签页
uvx browser-use close-tab

# 等待条件满足
uvx browser-use wait "selector:.loading" --timeout 10
```

### 6. 结束

```bash
uvx browser-use close
```

## 常用全局选项

| 选项 | 说明 |
|------|------|
| `--headed` | 显示浏览器窗口（默认无头模式） |
| `--profile` | 使用真实 Chrome 配置（保留登录态） |
| `--session NAME` | 命名会话（支持多浏览器并行） |
| `--json` | JSON 格式输出（便于解析） |
| `--connect` | 连接已运行的 Chrome |

## 使用真实 Chrome 配置

使用 `--profile` 选项可以复用本地 Chrome 的登录状态、Cookie 等：

```bash
uvx browser-use --profile open https://mail.google.com
# 自动使用 Default 配置，已登录的网站无需重新登录
```

## 多会话并行

```bash
# 启动两个独立的浏览器会话
uvx browser-use --session work open https://app.example.com
uvx browser-use --session personal open https://social.example.com

# 分别操作
uvx browser-use --session work click 3
uvx browser-use --session personal type "hello"

# 查看活跃会话
uvx browser-use sessions
```

## Cookie 管理

```bash
# 导出 Cookie
uvx browser-use cookies get --domain example.com

# 设置 Cookie
uvx browser-use cookies set '{"name":"token","value":"abc123","domain":".example.com"}'
```

## 典型场景示例

### 网页数据采集

```bash
uvx browser-use open https://news.ycombinator.com
uvx browser-use state                    # 查看页面结构
uvx browser-use screenshot hn.png        # 截图确认
uvx browser-use eval "JSON.stringify([...document.querySelectorAll('.titleline a')].map(a=>({title:a.textContent,href:a.href})).slice(0,10))"
uvx browser-use close
```

### 表单填写

```bash
uvx browser-use open https://example.com/signup
uvx browser-use state                    # 找到表单元素索引
uvx browser-use input 2 "user@example.com"
uvx browser-use input 3 "password123"
uvx browser-use click 5                  # 点击提交按钮
uvx browser-use screenshot result.png    # 确认结果
uvx browser-use close
```

### 搜索并提取结果

```bash
uvx browser-use open https://www.google.com
uvx browser-use state
uvx browser-use input 2 "browser-use github"
uvx browser-use keys Enter
uvx browser-use screenshot search.png
uvx browser-use extract "提取前5条搜索结果的标题和链接"
uvx browser-use close
```

## 注意事项

- **浏览器警告条**：启动时可能会出现黄色警告“您使用的是不受支持的命令行标记：`--extensions-on-chrome-urls`”。**这是正常现象**，因为 browser-use 需要注入辅助扩展来高亮和定位网页元素，该标记允许扩展在特权页面运行，可安全忽略。
- 浏览器在命令间持久运行，`close` 后才真正关闭
- `extract` 命令需要配置 LLM API key（通过环境变量 `ANTHROPIC_API_KEY` 或 `GOOGLE_API_KEY`）
- 无头模式下某些网站可能检测到自动化，使用 `--profile` 可缓解
- 如果 Chromium 未安装，先运行 `uvx browser-use install`
- 使用 `uvx browser-use doctor` 排查环境问题

## 故障排除

| 问题 | 解决方案 |
|------|---------|
| Chromium not found | `uvx browser-use install` |
| 页面加载超时 | 增加 `wait` 或检查网络 |
| 元素索引不对 | 重新运行 `state` 获取最新索引 |
| 需要登录态 | 使用 `--profile` 选项 |
| extract 报错无 API key | 设置 `ANTHROPIC_API_KEY` 或 `GOOGLE_API_KEY` 环境变量 |
