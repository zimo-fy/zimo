# tencent-news-cli 安装指南

默认安装路径统一通过 `bun` 运行 TypeScript 脚本，不依赖 Node.js、Python 或平台特定 Shell。

## 首选方案

所有平台统一执行：

```sh
bun scripts/install-cli.ts
```

安装脚本会自动完成以下事情：

1. 识别当前 `OS` 和 `ARCH`
2. 计算当前平台对应的下载地址
3. 从 `https://mat1.gtimg.com/qqcdn/qqnews/cli/hub/<os>-<arch>/` 下载 CLI
4. 先下载到临时文件，再运行 `version` 验证
5. 验证成功后再替换 skill 目录中的正式 CLI 文件
6. 在 macOS / Linux 上自动 `chmod +x`

## 输出字段

安装脚本会输出 JSON，常用字段如下：

- `platform.cliPath`：CLI 完整路径
- `downloadUrl`：实际下载地址
- `currentVersion`：安装后版本
- `latestVersion`：CLI 报告的最新版本
- `rawVersionOutput`：原始版本输出

## 手动回退

仅当脚本下载失败、用户要求手动安装、或需要排查网络问题时，才使用手动命令。

### macOS / Linux

```sh
BASE_URL="https://mat1.gtimg.com/qqcdn/qqnews/cli/hub"
DOWNLOAD_URL="$BASE_URL/<os>-<arch>/tencent-news-cli"

curl -fSL -o "{SKILL_DIR}/tencent-news-cli" "$DOWNLOAD_URL"
chmod +x "{SKILL_DIR}/tencent-news-cli"
"{SKILL_DIR}/tencent-news-cli" version
```

### Windows PowerShell

```powershell
$baseUrl = "https://mat1.gtimg.com/qqcdn/qqnews/cli/hub"
$downloadUrl = "$baseUrl/<os>-<arch>/tencent-news-cli.exe"

Invoke-WebRequest -Uri $downloadUrl -OutFile "{SKILL_DIR}\tencent-news-cli.exe"
& "{SKILL_DIR}\tencent-news-cli.exe" version
```

## 故障排查

- 安装脚本报 `unsupported os` 或 `unsupported architecture`：当前平台不在 skill 支持范围内。
- 下载失败：优先检查网络连接和 CDN 地址可达性。
- 脚本报 `` `version` did not return valid JSON. ``：下载到的文件不是可用 CLI，或当前 CLI 输出格式与 skill 预期不一致。
- macOS 安全提示：前往“系统设置 -> 隐私与安全性”允许运行。
- Windows SmartScreen 拦截：在系统提示中选择“更多信息”后允许运行，必要时在安全软件中加入信任。
