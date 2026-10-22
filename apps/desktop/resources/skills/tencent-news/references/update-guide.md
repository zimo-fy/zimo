# tencent-news-cli 更新指南

默认更新路径统一通过 `bun` 运行 TypeScript 脚本，不依赖 Node.js、Python 或平台特定 Shell。

## 首选方案

所有平台统一执行：

```sh
bun scripts/check-update.ts
bun scripts/check-update.ts --apply
```

更新脚本会自动完成以下事情：

1. 确认当前平台的 CLI 已存在
2. 调用 `version`
3. 严格解析返回 JSON 中的 `need_update`、`current_version`、`latest_version`、`download_urls`
4. 选择当前平台对应的下载地址
5. 在应用模式下先下载到临时文件并执行 `version` 验证
6. 验证成功后再替换旧二进制
7. 刷新 `.last-update-check-<os>-<arch>`

## `version` 返回字段

更新脚本默认期望 `version` 返回 JSON，字段格式类似：

```json
{
  "current_version": "v1.0.0",
  "latest_version": "v1.1.0",
  "need_update": true,
  "release_notes": "更新说明...",
  "download_urls": {
    "darwin_amd64": "https://...",
    "darwin_arm64": "https://...",
    "linux_amd64": "https://...",
    "linux_arm64": "https://...",
    "windows_amd64": "https://...",
    "windows_arm64": "https://..."
  }
}
```

当前平台对应的 key 规则是 `<os>_<arch>`，例如 `windows_amd64`。

## 输出字段

更新脚本会输出 JSON，常用字段如下：

- `needUpdate`：是否需要更新
- `applied`：本次是否真正执行了下载覆盖
- `selectedDownloadUrl`：本次使用的下载地址
- `currentVersion`：更新后实际版本
- `latestVersion`：CLI 报告的最新版本
- `releaseNotes`：更新说明
- `checkedAt`：本次刷新缓存的 Unix 时间戳

## 手动回退

如果需要手动执行更新，遵循以下规则：

1. 先运行 `version`，从返回 JSON 中取出 `download_urls[<os>_<arch>]`
2. 若字段缺失，则回退到固定下载地址：
   `https://mat1.gtimg.com/qqcdn/qqnews/cli/hub/<os>-<arch>/tencent-news-cli`
   Windows 文件名为 `tencent-news-cli.exe`
3. 先下载到临时文件
4. 在 macOS / Linux 上先 `chmod +x`
5. 对临时文件执行 `version`
6. 验证成功后再覆盖旧文件
7. 刷新 `.last-update-check-<os>-<arch>`

## 故障排查

- 脚本报 `cli not found`：先运行安装脚本
- 脚本报 `` `version` did not return valid JSON. ``：当前 CLI 输出格式与 skill 预期不一致，需要人工检查原始输出
- 更新后仍显示旧版本：确认实际执行的是 `platform.cliPath` 指向的文件，而不是系统里另一个同名 CLI
- Windows 更新失败：优先检查是否被 SmartScreen、杀软或文件占用拦截，再重试 `bun scripts/check-update.ts --apply`。
