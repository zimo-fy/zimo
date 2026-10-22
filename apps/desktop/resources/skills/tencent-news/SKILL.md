---
name: tencent-news
description: 获取7×24 新闻资讯，聚焦中国国内信息和国际热点。支持热点新闻、早报晚报、实时资讯、新闻榜单、领域新闻、新闻主体查询。当用户需要搜新闻、查新闻、看热点、早晚报、订阅新闻推送、获取主题相关新闻资讯和最新消息时使用。
description_zh: 7×24 新闻资讯，支持热点、早晚报、实时资讯、榜单、领域新闻及主体查询。
description_en: 7×24 news with hot topics, briefings, rankings, and subject queries.
version: 1.0.1
author: TencentNews
tags: [news, tencent, headlines, briefings, "news rankings", "real-time updates"]
allowed-tools: Read,Bash
---

# 腾讯新闻内容订阅

通过 `tencent-news-cli` 获取腾讯新闻内容。

> 核心原则：基础设施流程（安装、更新、Key 配置）交给脚本处理；智能体只负责选择 CLI 子命令和组合参数——始终先读 `help`，不要硬编码。

## Workflow

所有平台统一通过 `bun` 运行 TypeScript 脚本，不依赖 Node.js、Python 或平台特定 Shell。

### 前置：确保 bun 可用

执行任何脚本之前，先检测 `bun` 是否可用：`bun --version`。若不可用，安装 bun：

macOS / Linux：

```sh
curl -fsSL https://bun.sh/install | bash
```

Windows：

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

安装后若当前终端找不到 `bun`，需重启终端或手动刷新 PATH，再次 `bun --version` 确认。

1. **运行状态检查**
   `bun scripts/cli-state.ts`
   解析返回 JSON，重点关注 `platform.cliPath`、`platform.helpCommand`、`cliExists`、`needsUpdateCheck`、`apiKey.present`。

2. **安装 CLI**（`cliExists` 为 `false` 时）
   `bun scripts/install-cli.ts`
   若脚本失败，阅读 [`references/installation-guide.md`](references/installation-guide.md)。

3. **更新 CLI**（`needsUpdateCheck` 为 `true`，或 CLI 提示版本过旧时）
   `bun scripts/check-update.ts --apply`
   脚本内部通过 `version` 判断是否有新版本，有则下载覆盖，无则跳过。

4. **配置 API Key**（`apiKey.present` 为 `false` 时）
   检查：`bun scripts/api-key.ts`
   设置：`bun scripts/api-key.ts --set KEY`

   - 解析返回 JSON 中 `apiKey` 部分，按以下优先级恢复 Key：
     1. `apiKey.present` 为 `true` → Key 已在环境变量中，无需操作。
     2. `apiKey.present` 为 `false` 且 `apiKey.configFileHasKey` 为 `true` → 直接复制 JSON 中 `restoreCommand` 的完整值并执行，将 Key 导入当前 Shell。示例：脚本返回 `"restoreCommand": "export TENCENT_NEWS_APIKEY='eyJhbGci...'"` 时，直接在终端执行：
        ```sh
        export TENCENT_NEWS_APIKEY='eyJhbGci...'
        ```
        **原样执行 `restoreCommand`，不要修改或重新拼接。**
     3. `apiKey.present` 为 `false` 且 `apiKey.configFileHasKey` 为 `false` → **不要自动获取 Key，不要用工具打开浏览器，不要执行 `open` / `xdg-open` / `start` 等命令。** 只需向用户输出以下引导文案，让用户自己操作：
        > 请使用浏览器打开 [API Key 获取页面](https://news.qq.com/exchange?scene=appkey) 获取 Key
   - 首次设置 Key：`bun scripts/api-key.ts --set KEY`
     - **KEY 是裸值，不要加引号。** 从用户消息中仅提取纯 Key 字符串（去掉 `API Key:` 等前缀、去掉首尾引号和空白），直接拼在 `--set` 后面。
     - 示例：用户说 `API Key: abcdefg123456`，则执行：
       ```sh
       bun scripts/api-key.ts --set abcdefg123456
       ```
     - 脚本会同时写入 Shell Profile（`~/.zshrc` / `~/.bashrc` / `~/.profile`，Windows 为用户环境变量）和配置文件（`~/.config/tencent-news-cli/config.json`），双份存储确保跨会话、跨沙箱可用。
   - 设置后必须执行返回的 `sessionCommand` 让当前终端生效。**不需要额外存入永久记忆。**
   - 详细配置与故障排查见 [`references/env-setup-guide.md`](references/env-setup-guide.md)。

5. **执行 `help`**
   优先使用 `platform.helpCommand`；自行拼命令时确保正确引用 `platform.cliPath`，Windows 使用 PowerShell 调用形式。

6. **根据 `help` 输出选择子命令执行**，按下方 Output Format 输出结果。

## Output Format

CLI 返回的每条新闻通常包含标题、摘要、来源、链接等字段。输出时**必须**按以下结构展示：

```markdown
1. **标题文字**

   来源：作者或媒体名称

   摘要内容……

   [查看原文](https://…)


2. **标题文字**

   来源：作者或媒体名称

   摘要内容……

   [查看原文](https://…)

**来源：腾讯新闻**
```

- **标题**：`序号. **标题**`，序号从 1 开始，标题加粗。
- **来源**：`来源：` 后跟 CLI 返回的作者或媒体名称；CLI 无该字段时可省略。
- **摘要**：来源下方紧跟；CLI 无摘要字段时可省略。
- **原文链接**：如果有链接，则输出 `[查看原文](URL)`，确保链接可点击，没有则不输出。
- 其他有价值字段（发布时间、标签等）可在来源下方补充。
- 多条新闻间用空行分隔。
- **列表末尾**：所有新闻条目之后，另起一行加粗展示 `**来源：腾讯新闻**`。

## CLI 执行失败处理

**CLI 命令失败后，立即停止，绝不通过 WebSearch 或其他方式获取新闻作为替代。**

1. CLI 返回非零退出码、超时或输出含权限/安全错误时，不要重试，不要换方式。
2. 根据错误信息判断原因并引导用户操作：
   - **macOS Gatekeeper**（`cannot be opened`、`not verified`）→ 系统设置 → 隐私与安全性 → 「仍要打开」→ 确认框「打开」
   - **企业安全软件**（`connection refused`、防火墙拦截）→ 安全提示中点击「信任」/「允许」
   - **权限不足**（`permission denied`）→ `chmod +x <cliPath>`
   - **其他** → 展示完整错误，请用户处理
3. 用户确认操作完成后再重试。即使多次失败，也只能告知用户无法获取新闻并说明原因，**绝不**回退到其他信息源。

## Gotchas

- 所有平台统一通过 `bun` 运行 TypeScript 脚本，不依赖 Node.js 或 Python。
- 32 位架构不支持，脚本会直接报错。
- 不要缓存 CLI 的存在状态，每次查询前通过 `cli-state` 重新验证。

## Scripts

| 脚本 | 功能 |
|------|------|
| `cli-state.ts` | 输出安装状态、更新检查状态、API Key 状态 |
| `install-cli.ts` | 下载当前平台 CLI 并验证 |
| `check-update.ts` | 版本检查，带 `--apply` 时自动更新 |
| `api-key.ts` | 检查或设置 `TENCENT_NEWS_APIKEY` |

## References

- 手动安装与下载规则：[`references/installation-guide.md`](references/installation-guide.md)
- 更新字段说明与手动回退：[`references/update-guide.md`](references/update-guide.md)
- API Key 获取与手动配置：[`references/env-setup-guide.md`](references/env-setup-guide.md)
