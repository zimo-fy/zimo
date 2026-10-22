# 桌面应用打包

当前流程用于本地预览和内部验收。打包配置明确关闭自动证书探测，产物不会签名或公证，不能作为正式公开发行包；这样可以避免开发机器上的个人证书影响结果。

## 环境准备

- macOS 或 Windows；
- Node.js 22.12 或更高版本；
- pnpm 10；
- 已在仓库根目录执行 `pnpm install --frozen-lockfile`。

Electron 44 的平台运行时采用首次加载时按需准备，而 electron-vite 5 启动前会直接检查运行时路径。desktop 的 `predev` 因此会先校验并在缺失时调用 Electron 官方安装逻辑；首次启动需要能够访问 Electron 下载源。若准备失败，应检查网络、代理或 Electron 镜像配置，不要手工创建 `path.txt` 或复制其他版本、平台的 Electron 二进制。

打包前建议先运行：

```bash
pnpm check
```

## 快速生成可运行应用

在仓库根目录执行：

```bash
pnpm package:dir
```

该命令先执行生产构建和一个自动清理的临时目录包，由临时包中的打包态 Electron/Bytenode 生成 V8 字节码；全部成功后删除原始 Main 源 bundle，再由 Electron Builder 生成当前平台的最终未压缩应用。产物位于：

```text
apps/desktop/release/mac/Zimo.app
```

Apple Silicon 主机的目录名称可能是 `mac-arm64`。可直接在 Finder 中双击 `Zimo.app` 做本机预览。

## 生成安装与传输产物

### macOS

```bash
pnpm package:mac
```

产物写入 `apps/desktop/release/`：

- `Zimo-0.1.0-mac-x64.dmg`：本机安装检查；
- `Zimo-0.1.0-mac-x64.zip`：内部传输或解压检查；
- `mac/Zimo.app`：未压缩应用目录。

文件名中的架构由打包机器决定，Apple Silicon 对应 `arm64`。当前不建议在一台机器上直接制作另一架构产物；正式发布时应分别在对应架构环境构建并验证，或单独设计 universal 构建。

### Windows

Windows 打包脚本用当前 Node 直接执行 pnpm CLI，避免 Node 20+ 在无 shell 时 `spawn("pnpm.cmd")` 触发 `EINVAL`。两次 Electron Builder 调用都复用仓库内已安装且版本匹配的 `electron/dist`，不再从 GitHub 重复下载。若本地 dist 缺失，需先通过可访问的下载源或 `ELECTRON_MIRROR` 完成运行时安装，不要手工复制其他版本的 Electron 二进制。

建议在 Windows x64 构建机的仓库根目录执行：

```bash
pnpm package:win
```

该命令生成：

- `Zimo-0.1.0-win-x64.exe`：可选择安装目录的 NSIS 安装程序；
- `Zimo-0.1.0-win-x64.zip`：免安装解压检查包；
- `win-unpacked/`：未压缩应用目录。

Windows 产物同样位于 `apps/desktop/release/`。虽然 Electron Builder 支持部分跨平台构建场景，但本项目包含 ONNX Runtime 原生二进制；应在 Windows x64 环境制作并验证 Windows 包，不能用 macOS 上“成功生成文件”代替 Windows 运行验收。当前脚本只生成 x64，arm64 需要单独增加构建与测试矩阵。

Bytenode 字节码还绑定生成时的 Electron/V8、操作系统和目标架构。`package:mac` 会拒绝非 macOS 主机，`package:win` 会拒绝非 Windows x64 主机，避免把当前主机生成的不可用字节码放入其他平台安装包。每个平台必须使用 lockfile 中同一 Electron 版本在目标构建机重新生成 `.jsc`，不能复制另一平台的 `out/main` 或 `app.asar`。

工作区会同时安装 macOS 与 Windows 的 Sharp 可选原生包，使 macOS 交叉生成的 Windows 预览包包含 `win32-x64` runtime。修改 `pnpm-workspace.yaml` 的目标平台配置后，需要重新执行：

```bash
pnpm install --force
```

生成 Windows 包后运行结构检查：

```bash
pnpm package:verify:win
```

该检查确认 Windows x64 Sharp 与其内置 libvips DLL 已进入解包资源，并拒绝 Darwin、Linux、WASM 或其他 Windows 架构的 Sharp 混入 x64 产物。结构检查通过后，仍需在 Windows x64 机器完成安装和启动测试。

`package:win` 还会下载固定版本的 Microsoft Visual C++ x64 Redistributable，校验文件大小与 SHA-256 后嵌入 NSIS。安装 Zimo 时会执行该前置依赖；用户可能看到一次 Windows UAC 提示。返回 0、需要重启的 3010，或表示其他兼容版本已经安装的 1638 均允许继续；取消或其他安装失败码会阻止 Zimo 报告成功。前置依赖缓存位于被 Git 忽略的 `apps/desktop/build/`，不得提交二进制文件；无网络构建可复用已经通过校验的缓存。

免安装 ZIP 不会执行前置依赖安装。目标电脑缺少最新兼容 VC++ x64 runtime 时，应用会保持可启动并将本地语义检索降级，但需要人工安装微软运行库才能恢复 ONNX Embedding。

## 包内容检查

Embedding 模型通过 `extraResources` 放在应用包的 `Contents/Resources/models/`（Windows 为 `resources/models/`），不会在用户首次运行时下载。JSON 配置与 tokenizer 在校验 SHA-256 前规范为 LF，因此 Windows 工作区即使因 `core.autocrlf` 检出 CRLF，也不会把内置模型误判为损坏；ONNX 权重仍按原始字节校验。图标位于 `Contents/Resources/icon.png`，应用代码和 Renderer 资源位于 `Contents/Resources/app.asar`。

项目开发使用的 `apps/desktop/resources/skills/` 明确从通用、macOS 和 Windows 的 `files` 规则中排除，也不会进入 `extraResources`。开发运行时 Skill Store 列表读取这个目录；打包后的应用不包含它，Skill 页面会提示找不到目录。这些目录同时作为仓库内的 Skill 源文件，并从 Prettier 与 ESLint 的源码检查中排除，避免工具改写包内容；用户点击安装后的副本保存在操作系统的 `userData/accounts/local/skill-runtime` 下，不从安装包预置或恢复。

生产构建后可单独检查 Main 字节码结构：

```bash
pnpm package:verify:bytecode
```

检查通过时，`out/main` 中每个 `.cjs` 都只是小于 512 字节的 Bytenode 加载器，并存在一一对应的非空 `.jsc`；目录中不得保留 `.js` 或 source map。`pnpm build` 只生成用于测试和打包输入的源 bundle；只有 `package:dir`、`package:mac` 和 `package:win` 会执行两阶段字节码转换，不得绕过这些命令直接把普通 build 交给 Electron Builder 发布。

当前只保护 Main。electron-vite/Bytenode 不支持 Renderer 字节码；Preload 若启用字节码需要关闭 Chromium sandbox，与 Zimo 安全基线冲突，因此继续使用 sandboxed CJS。V8 字节码可以显著提高静态逆向门槛，但客户端字符串、Preload、Renderer、运行时内存和加载器仍可分析，不得在代码中硬编码 API Key、Token 或私钥。

快速检查模型是否进入 `.app`：

```bash
test -f apps/desktop/release/mac/Zimo.app/Contents/Resources/models/bge-small-zh-v1.5/zimo-model.json
```

如当前主机生成的是 `mac-arm64`，将命令中的 `mac` 替换为 `mac-arm64`。

生成 `.app` 后可运行打包态 Embedding smoke：

```bash
pnpm package:verify:mac
```

如需完整 smoke，先通过受保护的 CI Secret 或当前 shell 环境提供 `ZIMO_SMOKE_USERNAME`、`ZIMO_SMOKE_PASSWORD`（不要把真实值写进脚本、命令历史或仓库）。该命令使用真实生产认证服务登录临时用户目录、导入一份 Markdown，并断言 SQLite 中至少保存了一条非空向量；账号密码不写日志，临时数据在结束后删除。未提供测试凭据时只检查统一身份认证页面可加载，并明确跳过 Embedding smoke。

## 本地启动提示

本阶段产物未做 Developer ID 签名和 Apple 公证。打包机器通常可以直接启动；如果 macOS 对复制来的包给出来源警告，可在 Finder 中右键应用并选择“打开”进行一次性确认。

应用运行数据不会写入 `.app` 或 `.dmg`，而是由 Electron 保存到当前用户的 `Application Support` 目录。删除安装包不会自动删除会话、知识文件、数据库或安全存储中的模型密钥。

Windows 安装包当前同样不做代码签名，系统可能显示未知发布者提示，仅用于本地和内部验收。正式分发前需要配置受信任的 Windows 代码签名证书。

## 自动更新

当前仓库未配置 Electron Builder `publish` 或远程更新 URL；`package:mac` / `package:win` 使用 `--publish never` 只生成本地安装包。应用内「检查更新…」不访问网络，行为见[桌面自动更新](../features/desktop-auto-update.md)。恢复自动更新需新 ADR 与签名/跨版本验证，见已废止的 [ADR-0017](../adr/0017-electron-generic-auto-update.md) 归档说明。

## 当前包为什么较大

当前 x64 macOS 构建的实测结果是：

| 内容                    | 未压缩体积 | 说明                                                     |
| ----------------------- | ---------: | -------------------------------------------------------- |
| Electron Framework      |  约 302 MB | Chromium、Node.js、V8 与 Electron 框架                   |
| 应用 Resources          |  约 570 MB | ASAR、原生依赖和内置模型                                 |
| 其中 `onnxruntime-node` |  约 142 MB | 优化前包含 macOS、Windows、Linux 和两种 CPU 架构的二进制 |
| 其中 `onnxruntime-web`  |   约 90 MB | 优化前携带的浏览器/WASM 后端，Main 进程 Node 推理不使用  |
| 文档/OCR 相关依赖       |  约 150 MB | PDF、Office、Canvas、Sharp、Tesseract 等解析依赖         |
| 内置 BGE 模型           |   约 23 MB | `bge-small-zh-v1.5` INT8 模型与 tokenizer                |
| 完整 `.app`             |  约 867 MB | 安装后的未压缩占用                                       |
| DMG/ZIP                 |  约 304 MB | 压缩后的下载包，因此用户通常看到“三百兆”                 |

因此，Embedding 模型只占较小部分。初始体积偏大的核心原因是：Electron 自带完整 Chromium；`@huggingface/transformers` 同时声明 Node 与 Web 推理后端；ONNX Runtime 默认安装多平台二进制；通用文档解析依赖带入了 OCR、Canvas 和图片处理组件。

当前打包配置已经执行第一轮安全裁剪：所有平台排除 `onnxruntime-web`；macOS 排除 Windows/Linux 原生库；Windows 排除 macOS/Linux 原生库。目标系统内仍同时保留 x64 和 arm64，避免在没有独立双架构打包验证前误删所需原生库。

第一轮裁剪后的实测结果：

| 产物                       |    裁剪前 |    裁剪后 |      减少 |
| -------------------------- | --------: | --------: | --------: |
| macOS x64 `.app`           | 约 867 MB | 约 703 MB | 约 164 MB |
| macOS x64 DMG              | 约 304 MB | 约 256 MB |  约 48 MB |
| macOS x64 ZIP              | 约 304 MB | 约 257 MB |  约 47 MB |
| Windows x64 `win-unpacked` | 约 1.0 GB | 约 785 MB | 约 215 MB |

裁剪后的 macOS 包已使用随包模型执行真实 512 维 Embedding 推理；Windows 包已完成结构检查，但仍需在 Windows x64 机器执行运行态验收。

第二轮将 Transformers Node 构建并入 Main，并把 Electron Builder 的生产依赖收敛为 `onnxruntime-common`、`onnxruntime-node` 和 `sharp`。UI、数据库、LangChain 与文档解析依赖已经由 Vite 编入 `out/`，不再以完整 `node_modules` 重复进入应用包。

第二轮裁剪实测：

| 产物                       |    第一轮 |    第二轮 |            累计变化 |
| -------------------------- | --------: | --------: | ------------------: |
| macOS x64 `.app`           | 约 703 MB | 约 416 MB | 较最初减少约 451 MB |
| macOS x64 DMG              | 约 256 MB | 约 171 MB | 较最初减少约 133 MB |
| macOS x64 ZIP              | 约 257 MB | 约 171 MB | 较最初减少约 133 MB |
| Windows x64 `win-unpacked` | 约 785 MB | 约 497 MB | 较最初减少约 500 MB |

第二轮完成后，打包态 smoke 已实际启动 `.app`、导入 Markdown，并确认 SQLite 保存了 512 维模型生成的非空向量。Windows 结构中确认包含模型和 Windows x64 ONNX 绑定，不包含 macOS/Linux ONNX。

后续瘦身应按以下顺序进行，并在每一步后运行打包态检索回归：

1. 将目标系统内的 ONNX Runtime 进一步按 x64/arm64 拆分；
2. 将未使用的 OCR、Canvas、Sharp 能力从文档解析依赖中拆出或替换；
3. 检查生产依赖白名单，排除 source map、类型声明、测试和示例文件；
4. 最后再评估 Electron locale、资源压缩和按需下载模型，避免先牺牲离线能力。

## 正式发布前仍需完成

1. Apple Developer ID Application 筿名；
2. Hardened Runtime、entitlements 与公证；
3. x64、arm64 或 universal 的明确发布策略；
4. 干净系统安装、升级、卸载和数据迁移验证；
5. 对固定 OSS 通道完成签名跨版本自动升级、失败重试、回滚和缓存切换验证；
6. Windows/Linux 分平台构建配置与验收。
