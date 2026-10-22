# ADR 0018：受控文档工作区与 JS-first 格式适配器

- 状态：Accepted（Phase 8A–8E 首版已落地）
- 日期：2026-09-14

## 背景

Zimo 已能把 Office/PDF 导入知识库并提取文本，但用户还需要在会话中创建、读取、修改和转换 DOCX、XLSX、PPTX、PDF。该需求会新增本地文件写入、二进制资产、格式转换和模型 Tool，超出当前“知识库只读解析”与 ADR 0010 的首批受控 Tool 边界。

依赖系统 Python、Office 或用户安装的 CLI 会在 macOS/Windows 上产生版本、路径、依赖和发布兼容问题。另一方面，纯 JavaScript 库也不能提供与 Office/PDF 编辑器等价的任意高保真往返能力。

## 决策

1. 新能力使用应用管理的文档工作区。导入时复制原件，Renderer IPC 只接收 opaque artifact ID，不接收任意路径；模型 Tool 只接收会话内的 `doc_n` 短引用，由 Application 映射为内部 artifact/revision ID。
2. 首版采用 JS-first：`officeparser@7.8.0` 读取，`docx@9.7.1`、`exceljs@4.4.0`、`pptxgenjs@4.0.1`、`pdf-lib@1.17.1` 写入；中文 PDF 通过 Electron Chromium 生成。`officeparser` 保留为 Desktop 生产运行时依赖，不打进 Main 单文件。
3. 不依赖系统 Python，不支持 Python 2。未来确需 Python 时只允许按平台固定分发的 Python 3 Runtime，并通过独立 ADR、Adapter、包体积和安全评审。
4. 不把第三方库 API、脚本、OOXML 或二进制暴露给模型。每次会话模型调用固定暴露 `inspect/read/create/patch/convert` 五个产品级受控 Tool，由模型自行选择；Application 不使用用户文本关键词或正则决定工具可见性。执行期仍按当前会话资产归属、Schema 和权限严格校验。
5. 内容按 digest 和 selector 渐进读取。本轮新附件或明确文档后续请求可获得总计不超过 6,000 字符的不可信短预览，`read` 单次最多 12,000 字符；完整正文、二进制不进入 Renderer 全局状态、SQLite 消息正文或普通日志。视觉模型本轮图像附件可在 Adapter 请求内存中编译为 `image_url` data URL，不得写入 SQLite、IPC 或普通日志；开发态 payload 日志必须脱敏。非视觉模型不得发送图像。对话内展示图片时，Renderer 只加载 `zimo-doc:` 受控协议（opaque conversation/artifact/revision ID），不得改用文件路径或把 Base64 写入 React 状态。
6. 修改总是产生新 revision，不覆盖用户原件。写入工作区之外只能由用户触发 Main 的“另存为”对话框；模型不能选择绝对路径。
7. 首版只承诺功能矩阵中的有限修改与转换。任意 DOCX/PPTX 无损编辑、完整 Excel 公式计算、PDF 正文重排和高保真 Office→PDF 不得标记为已支持。
8. Zimo 自建结构化内容可通过受控本地 HTML renderer 和 Electron `printToPDF` 生成 PDF。任意 Office→PDF 的高保真转换必须由后续本地原生或云端 `DocumentConversionProvider` 承担，并要求用户知情。
9. 所有解析、预览和生成贯穿 AbortSignal、30 秒超时、大小/数量/解压限制和唯一终态。首版 Adapter 仍在 Main 运行；复杂文件容量验收后迁移 Worker/Utility Process，此项作为已知偏差记录，不宣称进程级隔离。
10. 文档资产、revision、消息绑定和任务状态通过下一可用 SQLite migration 持久化；文件正文留在受控目录，数据库只保存 storage key 与安全元数据。

## 安全约束

- Renderer 保持无 Node 权限；Preload 只暴露具名附件 API；
- 首版拒绝旧 Office 二进制格式、宏格式、密码/加密文档、嵌入 OLE、外部资源抓取和可执行内容；
- DOCX→HTML 或其他预览必须 sanitization，文档内容始终作为不可信数据；
- 普通日志不记录文件正文、文件路径、单元格值、Tool 参数值和产物内容；
- Tool 的短引用只映射当前会话已绑定消息的 artifact，读权限只覆盖该集合，写权限只覆盖对应 artifact 的内部新 revision；
- 不借用 ADR 0013 的受审核 Skill 脚本权限实现基础文档能力，避免把基础功能变成任意脚本执行。

## 后果

### 正面

- 应用在 macOS/Windows 使用同一套 Node/Electron 运行时，不要求用户安装 Python 或 Office；
- 模型文档 Tool 固定为五个高层能力，不随第三方库 API、文件体积或自然语言表达增长；
- 原文件不被模型覆盖，文档版本和失败恢复可审计；
- 格式实现可以单独替换，不污染 Domain、Application 或 Renderer。

### 代价与限制

- 需要新增文档资产生命周期、Worker、revision、预览和导出链路；
- 四种格式的能力不完全对称，UI 和错误必须明确显示支持等级；
- 纯 JS 不能保证复杂 Office 文档的高保真转换或无损往返；
- 增加依赖会扩大安装包，需要在依赖落地前做体积、许可证和维护状态 spike。

## 被否决的方案

- **直接执行模型生成的 JS/Python 脚本**：参数和文件访问范围不可控，也会扩大现有脚本 Skill 信任边界；
- **依赖系统 Python**：跨平台版本和依赖不可重复，Python 2 已停止维护；
- **让 Renderer 直接处理文件**：违反进程分层，会暴露路径和大二进制并阻塞 UI；
- **把底层格式库命令长期放入 Tool 列表**：第三方 API Schema 会造成不可控的 token 成本并增加误调用；固定五个产品级 Tool 不属于该方案；
- **直接修改用户原文件**：失败和模型误操作不可恢复；
- **宣称纯 JS 支持任意高保真转换**：能力与实际渲染引擎不一致，会产生静默格式损失。

## 落地状态

Phase 8A–8E 首版已建立受控资产、不可变 revision、消息绑定、选择/拖放、结构/文本预览、模型渐进读取、四格式创建、有限修改、语义重建转换和原生另存为。`0021`/`0022` 独立 migration 保存资产与来源；格式逻辑位于独立 Adapter/Application 模块，未重新堆入公共入口。

自动化已覆盖四格式创建后重新解析、附件正文进入相关模型请求、动态 Tool、revision 冲突、签名/路径门禁、SQLite 恢复、结果卡片和中文 PDF 预览。仍需人工完成 macOS/Windows 主流办公软件打开和另存为 smoke；Utility Process、图像缩略图、模板/样式、PDF 合并、CSV 文件产物和高保真转换继续按本 ADR 的边界单独推进。
