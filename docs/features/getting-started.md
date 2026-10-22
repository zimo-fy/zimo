# 快速开始：用户端与企业管理端部署

本文对应功能说明页「平台概览 → 快速开始」。命令以当前仓库和独立管理端仓库为准，不要套用其他产品的 Docker Compose 一键脚本。

## 1. 准备环境

用户端（Zimo Desktop）需要：

- Node.js 22.12 或更高版本；
- pnpm 10；
- macOS 或 Windows。

企业管理端是独立的 Zimo 仓库，需要：

- Node.js 14 或更高版本；
- Python 3.10 或更高版本；
- MySQL 5.7+ 或 PostgreSQL；
- Redis 6.2 或更高版本。

模型 API Key 不要写入仓库或普通环境文件。桌面端密钥由登录下发并进入系统安全存储。

## 2. 启动用户端

在本仓库根目录：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

macOS 也可使用 `pnpm dev:mac`。登录使用 Zimo 统一身份认证（员工账号 ID 或注册手机号 + 密码）。页面必须出现在 Electron 窗口中，不要用浏览器打开 Renderer 的 `file://` 地址。

生产目录预览或安装包：

```bash
pnpm package:dir
pnpm package:win
pnpm package:mac
```

详见 [本地开发与验收](../development/getting-started.md) 和 [打包与发布](../development/packaging.md)。

功能说明页（本站）单独启动：

```bash
pnpm dev:website
```

本机访问 `http://127.0.0.1:5174/`。该站点不连接用户数据、账号或模型。

## 3. 启动企业管理端后端

在 Zimo 企业管理端仓库中：

```bash
cd zimo-backend
pip3 install -r requirements.txt
python3 app.py --env=dev
```

使用 PostgreSQL 时改为 `pip3 install -r requirements-pg.txt`。先在 `.env.dev` 填写数据库和 Redis，创建数据库并导入 `sql/zimo.sql`（PostgreSQL 用对应 pg 脚本）。生产使用 `.env.prod` 与 `python3 app.py --env=prod`。

该服务不在本桌面仓库内，也不随 `pnpm dev` 启动。

## 4. 启动企业管理端前端

```bash
cd zimo-frontend
npm install
npm run dev
```

生产构建使用 `npm run build:prod`。框架默认入口为 `http://localhost:80`，默认账号 `admin` / `admin123`，登录后应立即修改。

可选 Docker Compose（注意默认可能未做数据卷持久化）：

```bash
docker compose -f docker-compose.my.yml up -d --build
```

PostgreSQL 换 `docker-compose.pg.yml`。

## 5. 入口对照

| 入口           | 地址                        | 用途                                     |
| -------------- | --------------------------- | ---------------------------------------- |
| 用户端 Desktop | Electron 窗口（`pnpm dev`） | 对话、知识、Skill、工作流与本机工具      |
| 企业管理端     | `http://localhost:80`       | 组织、账号、模型、知识、Skill 与治理配置 |
| 功能说明页     | `http://127.0.0.1:5174/`    | 产品功能说明，不连接用户数据             |

用户端启动后发一条普通对话即可验收。企业管理端需确认默认模型已配置。两端分属不同仓库，不要把管理端页面理解成本仓库已经内置的窗口。
