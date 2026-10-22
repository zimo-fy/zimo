# 技术栈

状态：V0.2 当前实现
最后核对：2026-09-16

本文汇总 Zimo 当前已经落地的主要技术选型、用途和运行边界。具体版本以根目录及各 workspace 的 `package.json`、`pnpm-lock.yaml` 为准；架构约束以 [架构总览](overview.md) 和相关 ADR 为准。

## 项目形态

Zimo 是本地优先的桌面 AI Agent 应用，同时包含一个独立的静态产品介绍站点。仓库采用 pnpm workspace 管理，主要目录如下：

- `apps/desktop`：Electron 桌面应用；
- `apps/website`：React + Vite 产品介绍站点；
- `packages/domain`：领域模型与端口；
- `packages/application`：应用用例和运行编排；
- `packages/contracts`：跨进程 DTO、事件和 Zod Schema；
- `packages/adapters/*`：数据库、模型、认证、知识库、Skill、密钥和日志适配器；
- `packages/ui`：无业务含义的基础 UI 组件。

## 基础工程

| 技术       | 当前版本/形态             | 主要用途                            |
| ---------- | ------------------------- | ----------------------------------- |
| Node.js    | `>=22.12.0`               | 构建、测试和 Electron Main 运行基础 |
| TypeScript | 5.9.3，strict mode        | 全仓主要开发语言与类型约束          |
| pnpm       | 10.33.0 workspace         | Monorepo 包管理和任务编排           |
| ESM        | 根仓库默认 `type: module` | Node 与 workspace 模块规范          |
| ESLint     | 10.9.1                    | 静态检查和工程边界约束              |
| Prettier   | 3.9.6                     | 统一代码格式                        |

## 桌面与前端

| 技术                        | 当前版本/形态           | 主要用途                                   |
| --------------------------- | ----------------------- | ------------------------------------------ |
| Electron                    | 44.1.1                  | macOS、Windows 桌面容器                    |
| electron-vite               | 5.0.0                   | Main、Preload、Renderer 的开发与构建       |
| Vite                        | 7.3.6                   | Renderer 和产品站点构建                    |
| React                       | 19.2.8                  | Desktop Renderer 和产品站点 UI             |
| Tailwind CSS                | 4.3.3                   | 设计 token 与界面样式                      |
| Radix UI                    | 按需引入                | Dropdown、Tooltip、Avatar 等无障碍交互原语 |
| React Flow                  | `@xyflow/react` 12.10.0 | Workflow 可视化画布                        |
| Lucide React                | 1.39.0                  | 产品图标                                   |
| react-markdown + remark-gfm | 10.1.0 / 4.0.1          | 模型 Markdown、代码和表格渲染              |

Desktop 采用 Electron Main、sandboxed Preload 和 React Renderer 三进程边界。Renderer 只能通过类型化的 `window.zimo` 白名单 API 调用能力，不能直接访问 Node.js、数据库、文件系统或系统密钥。

## 数据、契约与本地存储

| 技术                 | 当前版本/形态              | 主要用途                                             |
| -------------------- | -------------------------- | ---------------------------------------------------- |
| SQLite               | Node.js 内置 `node:sqlite` | 会话、模型、Agent、Skill、Workflow、知识库和审计数据 |
| Drizzle ORM          | 1.0.0-rc.4                 | SQLite Schema 与 Repository 查询层                   |
| 顺序 SQL migration   | `migrations/*.sql`         | 只向前演进的数据库升级                               |
| Zod                  | 4.5.4                      | IPC、远端响应、Tool 参数和持久化 JSON 的运行时校验   |
| Electron safeStorage | Electron 内置              | Token、模型 Key 和 MCP 凭据的系统级加密存储          |

SQLite 只保存非敏感业务数据和随机 `secretRef`，真实凭据由 Main 进程通过 SecretStore 写入操作系统安全存储。

## AI、Agent 与 Tool

| 技术                     | 当前版本/形态                                       | 主要用途                                         |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------ |
| LangChainJS              | `@langchain/core` 1.2.9、`@langchain/openai` 1.5.11 | 模型消息、流式生成和 Tool Calling 适配           |
| OpenAI-compatible API    | Chat Completions 文本子集                           | 登录账号托管模型的统一调用协议                   |
| DeepSeek                 | 设置页已保存的模型标识                              | 默认托管对话模型                                 |
| 自研 Application Runtime | Domain ports + Application services                 | Agent、Workflow、Intent Router、取消和统一流事件 |
| MCP Client               | `@modelcontextprotocol/client` 2.0.0                | 公网 HTTPS Streamable HTTP MCP 连接与 Tool 调用  |
| 受控 Tool Registry       | 项目内实现                                          | 参数校验、授权、超时、取消、输出上限和审计       |

LangGraphJS 是保留的演进方向，当前 Workflow 和 Tool 运行时仍由项目自身的 Domain/Application 模块实现，不能将 LangGraph 描述为已接入依赖。

## 本地知识库与文档处理

| 技术                      | 当前版本/形态   | 主要用途                             |
| ------------------------- | --------------- | ------------------------------------ |
| SQLite FTS5               | SQLite 内置扩展 | 关键词检索                           |
| Hugging Face Transformers | 3.8.1           | 本地 Embedding 模型加载与推理封装    |
| ONNX Runtime              | 1.21.0          | 本地 BGE Embedding 推理              |
| RRF                       | 项目内实现      | 关键词与向量结果融合                 |
| officeparser              | 7.8.0           | DOCX、XLSX、PPTX、PDF 内容读取       |
| docx                      | 9.7.1           | DOCX 创建与有限修改                  |
| ExcelJS                   | 4.4.0           | XLSX 创建与单元格/公式修改           |
| PptxGenJS                 | 4.0.1           | PPTX 创建与受控重建                  |
| pdf-lib                   | 1.17.1          | PDF 创建、拆分、重排、水印和表单处理 |
| Sharp                     | 0.34.5          | 图像处理和文档相关资源转换           |

本地检索使用固定版本的 BGE 模型生成 512 维向量，并与 FTS5 结果通过 RRF 融合；Embedding 不可用时可以降级到关键词检索。

## 构建、发布与更新

| 技术             | 当前版本/形态    | 主要用途                                   |
| ---------------- | ---------------- | ------------------------------------------ |
| electron-builder | 26.15.3          | macOS DMG/ZIP 与 Windows NSIS/ZIP 打包     |
| Bytenode         | 1.6.0            | Electron Main 生产 bundle 的 V8 字节码保护 |
| 桌面自动更新     | 未接入远程源     | 菜单「检查更新…」仅提示当前版本；无下载安装 |
| ASAR             | Electron Builder | 应用资源封装，原生依赖按需解包             |

Main 字节码只用于提高逆向成本，不替代代码签名、SecretStore、服务端权限和运行时安全边界。macOS 与 Windows 安装包仍需在各目标系统分别完成签名和真实升级验证。

## 测试与质量保障

| 技术            | 当前版本/形态 | 主要用途                        |
| --------------- | ------------- | ------------------------------- |
| Vitest          | 4.1.11        | 单元、契约和集成测试            |
| Testing Library | React 16.3.3  | 组件行为与无障碍测试            |
| Playwright      | 1.62.1        | Electron 关键用户旅程和安全 E2E |
| jsdom           | 30.0.1        | React 组件测试环境              |

标准质量门禁依次包括格式检查、Lint、TypeScript 类型检查、单元/契约测试、集成测试、生产构建，以及风险适用时的 Electron E2E。

## 当前未采用或未开放

以下能力不属于当前已落地技术栈：

- LangGraphJS 工作流运行时尚未正式接入；
- Phase 9 提供逐次人工审批的实验性宿主机 `run_command`，由 Main 的可替换 Adapter 启动固定平台 Shell；它拥有当前 OS 用户权限，不是发布级沙箱；
- 不支持 stdio MCP 或私网 MCP；
- 不执行 Plugin 第三方代码；
- Automation 后台调度和 Intent Router 自动执行尚未开放；
- Phase 9 网络 Tool 和发布级命令隔离仍等待 macOS/Windows 原生 OS 沙箱完成跨平台验收。

## 维护要求

- 新增或升级核心依赖时，同步更新本文件、相关 ADR 和功能文档；
- 影响运行时、安全边界、原生 ABI 或打包体积的依赖必须精确锁定并单独验证；
- 不以本文件代替依赖清单，发生版本差异时以 `package.json` 和 `pnpm-lock.yaml` 为准；
- 架构依赖方向始终保持 Renderer → Preload → Main → Application → Domain/Adapter。
