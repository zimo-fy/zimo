# Windows 内置 Embedding 模型被标为异常

状态：已修复

## 现象与影响

Windows 安装包或 `pnpm dev` 打开知识库时，本地 Embedding 卡片显示“资源异常 / 内置模型异常”。FTS5 关键词检索仍可用，语义检索关闭。该状态来自 `getEmbeddingModel()`，打开页面时不会加载 ONNX Runtime。

## 证据与根因

- `BundledBgeEmbeddingProvider.getStatus()` 用固定 SHA-256 校验 `config.json`、`tokenizer.json`、`tokenizer_config.json` 和 `model_quantized.onnx`；
- 仓库中 JSON 为 LF；Windows `core.autocrlf=true` 把工作区改成 CRLF（`i/lf w/crlf`）；
- Electron Builder `extraResources` 从工作区拷贝，安装目录中三个 JSON 的哈希与 lock 的 LF 哈希不一致，ONNX 二进制哈希仍匹配；
- 空 `catch` 把任意校验失败写成 `BUNDLED_EMBEDDING_MODEL_INVALID`。这与 VC++ / `onnxruntime_binding.node` 初始化失败不是同一条路径。

## 修复

- JSON 资产在哈希前去掉 UTF-8 BOM 并规范为 LF，预期 SHA-256 不变；ONNX 仍按原始字节校验，内容被改过的 JSON 仍失败；
- `.gitattributes` 固定模型 JSON 为 LF、`*.onnx` 为 binary，减少后续 Windows 检出再写入 CRLF。

## 回归验证

- 单元测试覆盖 JSON CRLF/LF/BOM 哈希一致、ONNX 不规范化、篡改 JSON 仍失败，以及用 CRLF JSON 镜像目录 `getStatus()` 为 `ready`。

## 剩余风险

已安装的旧包仍带 CRLF JSON。需要带有上述运行时规范化的新构建才能在不重装模型文件的情况下恢复语义检索。规范化后的 JSON 仍交给 Transformers 按 JSON 解析，CRLF 文本本身可被解析；真正阻止就绪状态的是校验。
