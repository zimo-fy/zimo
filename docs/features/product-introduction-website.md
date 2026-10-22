# Zimo 产品介绍站点

## 目标

`apps/website` 是独立于 Electron 桌面端的静态功能说明页，结构对应用户文档中的「平台概览 / 用户端 / 企业管理端」分栏。平台概览含「Zimo 是什么」与快速开始；前者概述已交付桌面能力和规划中的管理端，后者给出用户端 pnpm 启动和企业管理端独立仓库的前后端命令，详见 [快速开始](getting-started.md)。

用户端对应当前 Zimo Desktop 已交付菜单。企业管理端按 Zimo 管理后台的组织权限、AI 资源、监控和客户用量模块整理，并统一标记为规划中，避免把独立后台写成已经做进桌面应用。

## 展示范围

- 登录托管模型的流式对话、任务恢复和能力绑定；
- Agent 人才库、Skill Store、本地 instruction Skill 与受审核脚本 Skill；
- 本地文档解析、混合检索和资料引用；
- 可视化 Workflow 编辑、受限运行和逐节点状态；
- 多 Server 公网 HTTPS MCP Registry、授权方式与受控 Tool Calling；
- 个人微信扫码与邮箱地址登记的通信渠道基础能力；
- Automation 应用存活期调度能力和 Intent Router 的功能预览边界；
- 设置与账号中的会话、托管模型连接和本地安全状态；
- 企业管理端规划：用户/角色/菜单/部门、模型与 Agent/Skill 审核、知识与 MCP/HTTP 连接、操作与登录日志、客户企业权限和 Token 用量。

## 明确限制

页面不得把未实现能力描述为可用。用户端仍标明通信渠道为「基础能力」、Automation 仅在应用存活期调度。企业管理端全部为规划中，不提供可点击的后台登录或伪造治理结果。

介绍站点不调用 Desktop IPC、不读取用户数据、不接入账号、模型或外部服务，也不提供伪造的下载和执行成功状态。

## 品牌与产品截图

- Website Logo 与 favicon 复用 `apps/desktop/resources/icon.png`，站点副本位于 `apps/website/public/zimo-icon.png`；自动测试要求两份文件保持一致；
- 首屏产品图使用真实 Zimo Desktop 新建任务界面，不再使用 HTML/CSS 模拟界面；桌面端使用 1440×900 截图，窄窗口通过 `picture` 切换为 480×800 的真实响应式界面；
- 截图通过现有 Electron E2E 假认证服务、隔离临时 `userData` 和禁用本地 Embedding 的测试环境生成，不包含真实员工账号、密钥、用户正文或本地路径；
- 网站截图位于 `apps/website/public/screenshots/`。用户端每个功能的步骤图在 `screenshots/features/`，与「你可以做什么」一一对应。
- 更新截图时运行 `ZIMO_CAPTURE_WEBSITE_SHOTS=1 pnpm exec playwright test apps/desktop/e2e/capture-website-screenshots.spec.ts`，必须继续使用隔离测试数据，并在提交前进行人工隐私检查。

## 本地运行

```bash
pnpm dev:website
```

开发服务器固定监听 `0.0.0.0:5174`。本机使用 `http://127.0.0.1:5174/`，同一局域网内的设备使用开发电脑的内网 IP，例如 `http://192.168.112.56:5174/`。操作系统防火墙仍可能要求允许 Node.js 接受入站连接；只应在可信局域网中运行开发服务器。

生产构建：

```bash
pnpm build:website
```

Vite 输出位于 `apps/website/dist`。部署与公开域名不在本功能范围内。

## 验证

- TypeScript 严格类型检查；
- Vite 生产构建；
- 仓库 Prettier 与 ESLint；
- 桌面、窄窗口和 reduced-motion 样式检查；
- 页面链接、标题结构、键盘焦点和移动端目录检查。
- Website Logo 与 Desktop Logo 二进制一致性，以及桌面/窄窗口产品截图尺寸检查。
