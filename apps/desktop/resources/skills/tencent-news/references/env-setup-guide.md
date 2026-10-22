# TENCENT_NEWS_APIKEY 配置指南

所有平台统一通过 `bun` 脚本管理 API Key，不依赖 Node.js 或 Python。

## 首选方案

先检查：

```sh
bun scripts/api-key.ts
```

如果返回 `present: false`，**不要自动去获取 Key**。引导用户自行打开下方链接获取 API Key，等用户把 Key 告诉你后再执行设置脚本：

> 获取地址：[API Key 获取页面](https://news.qq.com/exchange?scene=appkey)

设置：

```sh
bun scripts/api-key.ts --set KEY
```

其中 `KEY` 应该是裸值，不要手动把单引号或双引号当成 Key 内容一起传入。

设置脚本的输出里会包含：

- `sessionCommand`：让当前终端立即可用的命令
- `verificationCommand`：用于验证是否生效
- `storage`：写入位置
  - **macOS** (`macos-env`)：写入 shell profile（`~/.zshrc` / `~/.bashrc`，未知 shell 回退到 `~/.profile`）+ `launchctl setenv`（对 GUI 应用也生效）
  - **Linux** (`linux-shell-profile`)：写入 shell profile（`~/.zshrc` / `~/.bashrc`，未知 shell 回退到 `~/.profile`）
  - **Windows** (`windows-user-env`)：写入用户级环境变量（`[Environment]::SetEnvironmentVariable`）

注意：脚本可以持久化配置，但**不能直接修改父 shell 的环境变量**。所以配置完成后，还要再执行返回的 `sessionCommand`。

## API Key 获取步骤

1. 打开 [API Key 获取页面](https://news.qq.com/exchange?scene=appkey)
2. 登录账号
3. 点击「生成」按钮生成 API Key
4. 点击「复制」按钮复制 Key
5. 将 Key 告诉智能体，由智能体执行设置脚本完成配置

**注意**：智能体不应自动打开浏览器或代替用户获取 Key，应始终引导用户自行操作。

## 手动回退

### macOS / Linux: zsh

```sh
echo 'export TENCENT_NEWS_APIKEY=你的Key' >> ~/.zshrc
export TENCENT_NEWS_APIKEY='你的Key'
printf '%s\n' "$TENCENT_NEWS_APIKEY"
```

### macOS / Linux: bash

```sh
echo 'export TENCENT_NEWS_APIKEY=你的Key' >> ~/.bashrc
export TENCENT_NEWS_APIKEY='你的Key'
printf '%s\n' "$TENCENT_NEWS_APIKEY"
```

## 沙箱环境（AI Agent 适用）

部分 AI 智能体（如 Cursor、Windsurf、Cline 等）在隔离的沙箱环境中运行命令，无法读取 `~/.zshrc`、`~/.bashrc` 等 shell 启动文件中配置的环境变量。

### 解决方案

脚本已内置配置文件回退机制。`bun scripts/api-key.ts --set` 会同时写入：

1. **Shell Profile**（`~/.zshrc` / `~/.bashrc` / `~/.profile`）或 **Windows 用户环境变量** — 正常终端使用
2. **配置文件** `~/.config/tencent-news-cli/config.json` — 沙箱/跨会话回退

当 `bun scripts/cli-state.ts` 检测到环境变量 `$TENCENT_NEWS_APIKEY` 为空时，会检查配置文件并在 JSON 输出中返回：
- `apiKey.configFileHasKey: true` — 配置文件中存有 Key
- `apiKey.restoreCommand` — 智能体需要在**自己的 Shell** 中执行此命令来恢复 Key（脚本作为子进程无法直接修改父 Shell 环境）

### 存储与恢复流程

**首次配置时（存储）**：

1. 执行 `bun scripts/api-key.ts --set KEY` — 自动写入 Shell Profile + 配置文件
2. 执行返回的 `sessionCommand` 让当前终端生效

**后续对话时（恢复）**：

1. 运行 `bun scripts/cli-state.ts` → 检查 `apiKey.present`
2. 若 `present: false` 且 `configFileHasKey: true` → 执行 `apiKey.restoreCommand` 将 Key 导入当前 Shell
3. 若 `present: false` 且 `configFileHasKey: false` → 引导用户重新获取（正常流程）

### 注意事项

- 配置文件只更新 `TENCENT_NEWS_APIKEY` 字段，不会主动覆盖其他已有配置项
- macOS / Linux 配置文件权限为 `600`，仅当前用户可读写
- 脚本作为子进程运行，无法直接修改父 Shell 的环境变量；因此返回 `restoreCommand` 由智能体在自己的 Shell 中执行
- 从配置文件恢复后仍需通过 `bun scripts/api-key.ts` 验证 Key 是否有效
- 如果 Key 已过期或无效，走正常的重新获取流程

## 何时需要手动配置

- API Key 脚本执行失败
- 用户希望自己掌控配置文件修改

## 常见问题

- 重启终端后失效：确认已经写入启动文件，而不是只执行了临时 `export`
- 当前窗口里仍然拿不到值：执行脚本返回的 `sessionCommand`
- IDE 内置终端不生效：重新打开终端，必要时重启 IDE
