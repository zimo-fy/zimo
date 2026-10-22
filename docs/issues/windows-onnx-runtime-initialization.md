# Windows 启动时 ONNX Runtime DLL 初始化失败

## 现象

修复 Sharp 目标平台依赖后，部分 Windows x64 电脑仍在 Electron Main 进程启动阶段退出，错误指向 `onnxruntime_binding.node`，并显示“动态链接库（DLL）初始化例程失败”。

## 影响

受影响电脑无法打开应用，而不只是本地语义检索不可用。NSIS 安装包与免安装 ZIP 原本都默认目标系统已经安装足够新的 Microsoft Visual C++ x64 运行库。

## 证据与根因

- Windows 产物包含 x64 的 `onnxruntime_binding.node`、`onnxruntime.dll` 和 `DirectML.dll`，文件均为 PE32+ x86-64；
- `onnxruntime_binding.node` 动态依赖 `MSVCP140.dll`、`VCRUNTIME140.dll` 和 `VCRUNTIME140_1.dll`；
- `onnxruntime.dll` 还依赖 `MSVCP140_1.dll`；
- 原安装包没有安装或携带这些运行库；
- ONNX Runtime 官方声明 Windows 构建要求 Visual C++ 2019 runtime，并建议安装最新兼容版本。

因此，目标系统缺少 VC++ runtime 或版本低于 ONNX Runtime 构建工具链要求时，Windows Loader 无法初始化 Node 原生模块。错误发生在 Transformers 的顶层加载期间，进一步把可选的 Embedding 能力扩大成整个应用启动失败。

## 修复

- Windows NSIS 打包前从微软固定 HTTPS 地址下载 Visual C++ x64 Redistributable，并校验固定大小与 SHA-256；校验失败则中止打包；
- NSIS 安装应用后静默运行 Redistributable，接受成功、需要重启（3010）及系统已有其他兼容版本（1638）的结果，其他失败码阻止继续启动；
- Transformers 改为首次 Embedding 推理时动态加载，使原生运行时异常由现有 Embedding 降级路径处理，而不是在 Main 模块求值时终止进程；
- Windows x64 包排除 ONNX Runtime arm64 目录；产物检查同时验证 x64 ONNX binding/DLL 存在且没有混入其他架构。

## 验证与剩余风险

macOS 可验证固定下载源、哈希、NSIS 编译和 Windows 产物结构，但不能执行 Windows DLL。最终必须在缺少或仅有旧版 VC++ runtime 的 Windows x64 干净环境验证安装、UAC、重启返回码、应用启动及真实 Embedding 推理。

首次实机安装发现 Redistributable 在已有其他版本时返回 Windows Installer `ERROR_PRODUCT_VERSION`（1638）。该返回码表示另一版本已安装，不应作为 Zimo 安装失败；安装器现将其视为前置条件已满足。

免安装 ZIP 不执行 NSIS 前置依赖安装；它依靠按需加载保证应用可启动，但本地语义检索可能降级。需要完整离线能力时，应先安装微软 Visual C++ x64 Redistributable，或使用 NSIS 安装包。
