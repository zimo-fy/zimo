# 目录结构

Phase 1 起按以下 pnpm workspace 结构落地。Phase 0 只创建文档，不创建空工程目录。

```text
zimo/
├── apps/
│   └── desktop/
│       ├── resources/            # 图标及打包资源
│       ├── src/
│       │   ├── main/             # Electron Main、组合根、IPC handlers
│       │   ├── preload/          # 唯一 window.zimo 白名单桥
│       │   └── renderer/         # React UI
│       │       ├── app/          # providers、router、layout
│       │       ├── features/     # 按产品模块垂直切片
│       │       ├── components/   # 本应用共享 UI
│       │       └── styles/
│       ├── e2e/
│       └── package.json
├── packages/
│   ├── application/              # 用例、DTO mapping、stream orchestration
│   ├── contracts/                # IPC/DTO/Event 的 Zod Schema 与派生类型
│   ├── domain/                   # 实体、值对象、策略、端口
│   ├── adapters/
│   │   ├── auth-zimo/
│   │   ├── database-sqlite/
│   │   ├── model-langchain/
│   │   ├── repositories-mock/
│   │   ├── secret-store/
│   │   └── logging/
│   ├── test-kit/                 # fixtures、contract suites、builders
│   └── ui/                       # 无业务含义的设计系统组件
├── docs/
│   ├── adr/
│   ├── architecture/
│   ├── development/
│   └── security/
├── tooling/                      # lint、tsconfig、tailwind、vitest 共用配置
├── migrations/                   # 只向前的版本化 SQL
├── IMPLEMENTATION_PLAN.md
├── PROGRESS.md
├── REQUIREMENTS.md
├── pnpm-workspace.yaml
└── package.json
```

## 包依赖规则

```text
domain                  contracts
  ▲                        ▲
  │                        │
application ───────────────┘
  ▲
  ├── adapters/*
  └── apps/desktop/main

apps/desktop/renderer ──► contracts + ui
apps/desktop/preload  ──► contracts
```

- `domain` 不依赖工作区其他包。
- `contracts` 只依赖 Zod 和无副作用工具，不依赖 `domain`，避免把领域对象跨 IPC 暴露。
- `application` 依赖 `domain` 与 `contracts`。
- Adapter 实现 `domain` 端口，可依赖第三方 SDK。
- Renderer 不能导入 `domain`、`application`、任何 Adapter 或 Main/Preload 源码。
- `ui` 不包含产品实体、数据获取或 IPC。

这些规则由 TypeScript project references、ESLint import boundaries 和 CI 循环依赖检查共同约束。

## Feature 目录约定

```text
features/conversations/
├── api/               # 仅封装 window.zimo
├── components/
├── hooks/
├── pages/
├── state/             # 仅呈现状态，不保存秘密
├── tests/
└── index.ts           # 唯一公开出口
```

跨 feature 复用先提升到 `components` 或 Application API，禁止从另一个 feature 的内部路径导入。

## 文件命名

- 组件：`conversation-list.tsx`，导出 `ConversationList`；
- Hook：`use-conversation-stream.ts`；
- 用例：`send-message.use-case.ts`；
- 端口：`conversation.repository.ts`；
- 适配器：`sqlite-conversation.repository.ts`；
- Schema：`conversation.schema.ts`；
- 测试与源文件同名加 `.test.ts(x)`；E2E 用 `.spec.ts`；
- 每个包只通过 `src/index.ts` 暴露稳定公共 API。
