# 交付体系设计

> 阶段6加载 | 一键导出系统、4种交付选项、全书预览HTML

---

## 核心策略

**MD+HTML为主，PDF/DOCX用户自助转换**

| 格式 | 定位 | 可靠性 | 用户操作 |
|------|------|--------|----------|
| **MD** | 主力文字输出 | 100% | 直接下载 |
| **HTML** | 主力可视化输出 | 100% | 直接下载 |
| **PDF** | 用户自助 | 依赖浏览器 | HTML用浏览器打印为PDF |
| **DOCX** | 用户自助 | 依赖在线工具 | HTML用在线工具转换 |

---

## 四种交付选项

| 选项 | 内容 | 产出物 | 适用场景 |
|------|------|--------|----------|
| **A轻量** | MD单文件 | `书名.md` | 快速分享、笔记存档 |
| **B标准** | MD + HTML可视化 | `书名.zip`（含.md和.html） | 最常用交付格式 |
| **C完整** | MD + HTML + 可视化资产 | `书名_完整.zip`（含.md、.html、所有图表/图片源文件） | 深度编辑/二次创作 |
| **D网站** | 完整网站包 | `书名_site.zip`（可直接部署的静态网站） | 直接托管/分享 |

### 选项A：轻量（MD单文件）

**产出物**：
```
📄 企业微信实战手册.md
```

**内容**：
- 单个`.md`文件包含全书所有章节
- Mermaid图表以代码块形式保存（```mermaid ...```）
- 插图以标记形式保存（<!-- ILLUST: type | prompt: ... -->）
- 读者可复制到任何Markdown编辑器查看

**导出命令**：
```bash
# 手动：直接下载src目录下合并的md文件
# 自动化：使用 export.js --option a
node export.js --option a
```

---

### 选项B：标准（MD + HTML可视化）

**产出物**：
```
📦 企业微信实战手册.zip
├── 企业微信实战手册.md      # 文字内容
└── 企业微信实战手册.html    # 可视化版本
```

**HTML支持特性**：
- Mermaid图表直接渲染（通过CDN或本地mermaid.js）
- Plotly/echarts图表交互
- 响应式布局，支持手机/平板/电脑
- 主题切换：明/暗/护眼
- 内置搜索功能（Ctrl+F）
- 目录侧边栏快速导航
- 浏览器打印为PDF（Ctrl+P）

**导出命令**：
```bash
node export.js --option b
```

---

### 选项C：完整（MD + HTML + 可视化资产）

**产出物**：
```
📦 企业微信实战手册_完整.zip
├── 企业微信实战手册.md              # 文字内容
├── 企业微信实战手册.html            # 可视化版本
├── assets/
│   ├── cover.svg                   # 封面设计
│   ├── cover.png                   # 封面PNG（用于网站部署）
│   ├── mermaid/                    # Mermaid源文件
│   │   ├── 01-流程图.svg
│   │   ├── 02-架构图.svg
│   │   └── ...
│   ├── illustrations/              # 插图源文件
│   │   ├── 01-场景图.svg
│   │   └── ...
│   └── data/                       # 数据文件（如有）
│       ├── 调研数据.xlsx
│       └── 案例清单.csv
└── 企业微信实战手册_导出说明.md     # 转换指南
```

**包含内容**：
- 全部B选项内容
- 所有Mermaid源文件（.mmd格式，渲染后SVG）
- 封面设计源文件（SVG/PNG）
- 插图源文件
- 数据文件（如Excel、CSV）
- 导出说明文档

**导出命令**：
```bash
node export.js --option c
```

---

### 选项D：网站（完整网站包）

**产出物**：
```
📦 企业微信实战手册_site.zip
├── index.html                      # 网站首页（全书预览）
├── assets/
│   ├── style.css                   # 样式文件
│   ├── mermaid.min.js               # Mermaid库（离线）
│   ├── cover.png                   # 封面
│   └── ...
├── chapters/                       # 章节HTML（可选，用于大型书籍）
│   ├── 01-前言.html
│   ├── 02-第一章.html
│   └── ...
└── README.md                       # 部署说明
```

**特性**：
- 可直接上传至静态网站托管（GitHub Pages/Vercel/Netlify/Cloudflare Pages）
- 内置离线Mermaid.js，无需CDN
- 响应式设计，移动端友好
- SEO友好的HTML结构
- README提供一键部署指南

**部署方式**：
```bash
# GitHub Pages
# 1. 解压zip
# 2. push到GitHub仓库
# 3. Settings → Pages → 选择main branch

# Vercel
# vercel --prod 直接部署

# Netlify
# netlify deploy --prod --dir=.
```

**导出命令**：
```bash
node export.js --option d
```

---

## 全书预览HTML设计

### 单文件包含全部内容

全书预览HTML（选项B/D中的`.html`文件）需满足：

**结构要求**：
```
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>书名</title>
  <link rel="stylesheet" href="style.css">
  <script src="mermaid.min.js"></script>  <!-- 或CDN -->
  <style>/* 主题变量 */</style>
</head>
<body>
  <nav class="toc">...</nav>           <!-- 目录导航 -->
  <main class="content">
    <!-- 前言 -->
    <!-- 第一章 -->
    <!-- 第二章 -->
    <!-- ...
    <!-- 附录 -->
  </main>
  <div class="search-overlay">...</div>  <!-- 搜索功能 -->
  <div class="theme-switcher">...</div>   <!-- 主题切换 -->
  <script>mermaid.initialize({...})</script>
</body>
</html>
```

**必须支持的功能**：

| 功能 | 实现方式 | 说明 |
|------|----------|------|
| Mermaid渲染 | mermaid.min.js CDN或本地 | 统一使用unpkg |
| 目录导航 | 侧边栏fixed定位 | h1/h2双层目录 |
| 主题切换 | CSS变量切换 | 明/暗/护眼三主题 |
| 搜索 | 内置搜索浮层 | Ctrl+F触发 |
| 打印PDF | 浏览器原生打印 | Ctrl+P |
| 响应式 | CSS媒体查询 | 手机/平板/电脑 |

**主题切换实现**：
```css
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --accent-color: #2C5F7C;
}
[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e0e0e0;
  --accent-color: #6BA3C7;
}
[data-theme="eye-care"] {
  --bg-color: #F5F5DC;
  --text-color: #5B4636;
  --accent-color: #8B7355;
}
```

---

## 导出流程自动化

### export.js 脚本设计

**位置**：`FBS-BookWriter/export.js`

**使用方式**：
```bash
node export.js                    # 显示帮助
node export.js --option a         # 轻量导出
node export.js --option b         # 标准导出
node export.js --option c         # 完整导出
node export.js --option d         # 网站导出
node export.js --option b --book  # 指定书籍ID
```

**脚本流程**：

```
export.js
  ├── 解析参数（--option, --book, --output）
  ├── 读取books.config.js获取书籍配置
  │
  ├── 选项A：轻量
  │     └── 合并src/*.md → book.md
  │
  ├── 选项B：标准
  │     ├── 合并src/*.md → book.md
  │     ├── 生成book.html（全书记预览）
  │     └── 打包为zip
  │
  ├── 选项C：完整
  │     ├── 执行B选项
  │     ├── 导出Mermaid源文件（.mmd）
  │     ├── 导出封面（SVG/PNG）
  │     ├── 导出插图（如有）
  │     ├── 复制数据文件（如有）
  │     └── 打包为zip
  │
  └── 选项D：网站
        ├── 执行B选项
        ├── 添加离线mermaid.min.js
        ├── 添加部署README
        └── 打包为zip
```

**依赖**：
```javascript
// 仅用于打包
import archiver from 'archiver';
import fs from 'fs-extra';
// 其他功能均使用Node.js内置模块
```

---

## PDF/DOCX用户自助转换指南

当用户需要PDF或DOCX时，提供以下指南：

### HTML转PDF（推荐）

**方法1：浏览器打印（最简单）**
1. 用浏览器打开`.html`文件
2. 按`Ctrl + P`
3. 选择"另存为PDF"
4. 勾选"背景图形"
5. 保存

**方法2：命令行工具**
```bash
# 使用chromium
chromium --headless --print-to-pdf=output.pdf input.html

# 使用wkhtmltopdf
wkhtmltopdf input.html output.pdf
```

### HTML转DOCX（推荐）

**在线工具**：
- https://www.zamzar.com（免费）
- https://www.pdf2docx.com/html-to-docx

**桌面软件**：
- Microsoft Word：文件 → 打开 → 选择html文件 → 另存为docx
- WPS：直接打开html文件，另存为docx

---

## 文件命名规范

```
产出物命名格式：
  {书名}_{选项}.zip

示例：
  企业微信实战手册_A轻量.zip
  企业微信实战手册_B标准.zip
  企业微信实战手册_C完整.zip
  企业微信实战手册_D网站.zip

单文件命名：
  {书名}.md
  {书名}.html
```

---

## 导出状态显示

用户触发导出时，显示进度：

```
📦 导出系统中...
  → 正在合并章节内容...（3/12）
  → 正在生成HTML预览...（8/12）
  → 正在打包文件...（11/12）
  → 导出完成 ✓
```

---

## 降级策略

| 场景 | 降级方案 |
|------|----------|
| Mermaid CDN失败 | 使用本地mermaid.min.js |
| 本地mermaid也不可用 | 显示Mermaid源码块+提示"请用浏览器打开" |
| 打包失败 | 提供分批下载链接 |
| 内存不足 | 分章节打包 |
