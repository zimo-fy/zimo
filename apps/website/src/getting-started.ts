export interface GettingStartedStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly commands?: readonly string[];
  readonly notes?: readonly string[];
}

export const gettingStartedSteps: readonly GettingStartedStep[] = [
  {
    id: "prepare",
    title: "准备环境",
    body: "用户端在本仓库用 Node.js 开发或打包。企业管理端是独立的 Zimo 仓库，需要 Python、MySQL（或 PostgreSQL）和 Redis。",
    notes: [
      "用户端：Node.js 22.12+、pnpm 10；macOS 或 Windows。",
      // "企业管理端：Node.js 14+、Python 3.10+、MySQL 5.7+ 或 PostgreSQL、Redis 6.2+。",
      "不要把模型 API Key 写进仓库或命令行；桌面端密钥由登录下发并进入系统安全存储。",
    ],
  },
  {
    id: "desktop",
    title: "启动用户端（Zimo Desktop）",
    body: "在桌面仓库根目录安装依赖后启动 Electron 开发版。页面必须出现在应用窗口里，不要用浏览器打开 Renderer 的 file:// 地址。",
    commands: ["pnpm install --frozen-lockfile", "pnpm run dev"],
    notes: [
      "macOS 也可使用 pnpm run dev:mac。",
      "登录使用 Zimo 统一身份认证（员工账号 ID 或注册手机号 + 密码）。",
    ],
  },
  // {
  //   id: "admin-backend",
  //   title: "启动企业管理端后端",
  //   body: "在 Zimo 企业管理端仓库的 zimo-backend 目录配置数据库与 Redis 后启动 API。",
  //   commands: [
  //     "cd zimo-backend",
  //     "pip3 install -r requirements.txt",
  //     "python3 app.py --env=dev",
  //   ],
  //   notes: [
  //     "在 .env.dev 中填写开发库和 Redis；先创建数据库并导入 sql/zimo.sql（PostgreSQL 用对应 pg 脚本和 requirements-pg.txt）。",
  //     "生产环境改用 .env.prod 与 python3 app.py --env=prod。",
  //   ],
  // },
  // {
  //   id: "admin-frontend",
  //   title: "启动企业管理端前端",
  //   body: "在 zimo-frontend 安装依赖并启动管理后台。前后端分离，后端需先可达。",
  //   commands: ["cd zimo-frontend", "npm install", "npm run dev"],
  //   notes: [
  //     "生产构建使用 npm run build:prod。",
  //     "框架默认入口为 http://localhost:80，默认账号 admin / admin123，登录后应立即修改。",
  //     "也可用 docker compose -f docker-compose.my.yml up -d --build（PostgreSQL 换 docker-compose.pg.yml）；注意默认可能未做数据卷持久化。",
  //   ],
  // },
];

export const gettingStartedEntries = [
  {
    name: "用户端 Desktop",
    address: "Electron 窗口（pnpm run dev）",
    use: "对话、知识、Skill、工作流与本机工具",
  },
  {
    name: "企业管理端",
    address: "http://localhost:80",
    use: "组织、账号、模型、知识、Skill 与治理配置",
  },
  
] as const;
