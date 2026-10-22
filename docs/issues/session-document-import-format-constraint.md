# 会话附件白名单无法写入 SQLite

## 症状与影响

聊天「添加文件」已允许 Markdown、HTML、JSON、CSV、RTF、OpenDocument 和 EPUB，但导入后提示「文件无法安全读取」，附件不会出现，模型也无法 inspect/read。DOCX/XLSX/PPTX/PDF 不受影响。

## 证据与复现

- `document_artifacts.format` 在 `0022` 起带有 `CHECK (format IN ('docx', 'xlsx', 'pptx', 'pdf'))`；
- 文件层已复制并校验新扩展名，随后 `INSERT` 被 CHECK 拒绝；
- Application 把非 `AppError` 映射为 `DOCUMENT_IMPORT_FAILED` /「文件无法安全读取」。

## 根因

导入白名单扩展后未同步数据库约束。新格式在受控工作区可读，但不能成为会话文档资产，因此预览和文档 Tool 都拿不到记录。

## 修复

`0042_document_import_formats.sql` 重建 `document_artifacts`、`document_revisions` 和 `message_artifact_bindings`，将 format CHECK 对齐 `DOCUMENT_IMPORT_FORMATS`。既有四格式行原样复制。

## 回归覆盖

- SQLite 仓储集成测试：升级前拒绝 `md`，应用 `0042` 后可持久化；
- Desktop migration 序列包含版本 42；
- 文档存储与内容 Adapter 仍覆盖文本导入和读取。

## 剩余风险

已运行的桌面进程必须完整重启以应用 migration。`0045` 将 PNG/JPEG/WebP 纳入 format CHECK。约束仍拒绝可执行文件、通用压缩包和宏格式。
