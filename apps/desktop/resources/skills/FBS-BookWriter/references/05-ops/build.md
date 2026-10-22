# 构建系统

> **主题**：阶段4加载、构建流程、配置、降级策略
> **关键路径**：项目构建 → 环境配置 → 生产部署

---

## 导航

- 📄 **返回SKILL.md主文档**：[FBS-BookWriter](../../SKILL.md)
- 📄 **相关文档**：[技术实现](./section-6-tech.md) | [产品框架](./product-framework.md) | [用户安装](./user-install-guide.md)

---

## 两档输出策略

| 档次 | 条件 | 产出 |
|------|------|------|
| **标准输出** | 无需环境 | Markdown + HTML（单页面，可直接打开） |
| **可选增强** | Node.js 18+ | PDF（需Playwright）或 DOCX（在线工具） |

用户无 Node.js 时，本技能以 Markdown 与 HTML 为标准输出。用户有 Node.js 且需要 PDF 时，可执行 `assets/build.mjs` 等脚本生成 PDF。DOCX 可通过在线工具、Word/WPS、`html-to-docx` 或 Pandoc 生成。

---

## 多书配置

每本书通过配置对象定义。配色与排版密度字段详见 `presets.md` §2。

```javascript
// books.config.js
export const BOOKS = [
  {
    id: 'B1',                       // node build.mjs B1
    title: '书名',
    subtitle: '副标题',
    outputName: '输出文件名',
    color: '#2C5F7C',               // 主色
    lightBg: '#F4F7FA',
    accentBg: '#E3EDF4',
    accentGold: '#D4A843',
    coverImage: '',                  // 空→生成SVG文字封面
    srcDir: './src',
    series: 'standalone',
    author: '作者名',
    copyrightExtra: '一句话定位',
    files: ['01-前言.md', '02-第一章.md', ...],
  },
];
```

---

## 构建命令

> **前置条件**：用户需自行安装Node.js 18+

### 依赖包安装（用户可选）

如果用户希望本地生成PDF/DOCX，需自行安装以下包（可选）：

```bash
# 方案A：使用Playwright渲染PDF（推荐，中文支持完整）
npm install markdown-it playwright

# 方案B：使用Puppeteer渲染PDF
npm install markdown-it puppeteer

# 方案C：转DOCX使用（可选）
npm install html-to-docx
```

### 构建方式

```bash
# 仅生成Markdown（无需任何额外安装）
node build.mjs output-md

# 生成HTML（无需任何额外安装）
node build.mjs output-html

# 生成PDF（需安装方案A或B）
node build.mjs output-pdf

# 生成全部
node build.mjs all
```

---

## 构建流程

```
main()
  ├── puppeteer.launch()（共享实例）
  ├── for each book:
  │     ├── buildHTML(book)
  │     │     ├── MarkdownIt.render(合并所有MD)
  │     │     ├── H1-H7后处理（见 typography.md §八）
  │     │     ├── H8 插图标记处理（<!-- ILLUST: --> → .illustration容器）
  │     │     ├── H9 Mermaid处理（```mermaid → .mermaid-container）
  │     │     ├── 提取目录（h1/h2双层）
  │     │     ├── 生成封面/版权页/目录页
  │     │     │     └── 封面：coverImage → 设计SVG → 纯文字SVG（三级降级）
  │     │     ├── Mermaid CDN注入（enableMermaidCDN时加<script>）
  │     │     └── 组装完整HTML（CSS内联）
  │     ├── 写入HTML预览
  │     ├── Puppeteer → PDF
  │     └── html-to-docx → DOCX
  └── browser.close()
```

**H8-H9 后处理说明**：
- **H8 `H8_illustration`**：检测 `<!-- ILLUST: type | prompt: ... | caption: ... -->` 标记，转换为 `.illustration` 容器 + `.illustration-caption` 图注 + `.illustration-placeholder` 占位框
- **H9 `H9_mermaid`**：检测 ` ```mermaid ` 代码块，包裹为 `.mermaid-container`；若 `enableMermaidCDN: true` 则保留供CDN渲染，否则转为 `.mermaid-code` 显示源码

**Mermaid CDN 降级**：
- `enableMermaidCDN: true`（默认）→ 在HTML `<head>` 注入 `<script src="https://unpkg.com/mermaid/dist/mermaid.min.js"></script>`
- `enableMermaidCDN: false` → 不注入，Mermaid代码块以 `<pre><code>` 形式保留

> **稳定性优化**：CDN 从 jsDelivr 换为 unpkg，减轻部分地区访问受限问题。

**Mermaid CDN 对 PDF 的限制**：HTML模式下CDN脚本有效，Mermaid图表正常渲染。PDF由Puppeteer渲染时，需确保 `waitUntil: 'networkidle0'` 以等待CDN脚本加载并执行完成，否则Mermaid图表可能在PDF中显示为空白或源码。

**本地化备选方案**（2026年2月更新）：
如需完全离线运行，可将mermaid.min.js下载到本地 `assets/mermaid.min.js`，修改引用为相对路径。

---

## PDF关键参数

```javascript
await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="font-size:9pt;color:#999;width:100%;text-align:center;">
    第 <span class="pageNumber"></span> 页，共 <span class="totalPages"></span> 页
  </div>`,
});
```

- `waitUntil: 'networkidle0'`：确保SVG、字体及Mermaid CDN脚本加载完成
- `printBackground: true`：打印背景色
- 多本书共享browser实例

---

## DOCX注意事项

- 去掉Base64图片减小体积
- `html-to-docx`对CSS支持有限，保真度低于PDF
- 主要用于提供可编辑格式

---

## AI声明（两个独立位置）

本书在两个位置包含AI辅助声明，用途不同：

| 位置 | 定义来源 | 内容性质 | 生成方式 |
|------|---------|---------|---------|
| **前言声明** | `templates.md` §一 前言模板 | 用户确认的个性化内容，说明AI如何辅助写作 | 用户在前言MD中编写，构建时原样保留 |
| **版权页声明** | `build.mjs` 版权页模板 | 标准化法律声明格式 | `build.mjs` 自动生成，无需用户编辑 |

两个声明互为补充：前言面向读者解释写作过程，版权页面向版权合规。

---

## 版权页模板

```html
<div class="copyright-page">
  <p>${book.title}</p>
  <p>作者：${book.author}</p>
  <p>本书在资料整理、数据分析和初稿生成过程中使用了协作工具协同平台。<br>
     所有内容均经过协作工具审核、事实核查和独立判断。最终文责由作者承担。</p>
  <p>版本：${date}</p>
</div>
```

---

## 视觉资产降级策略

封面与插图的完整降级路径定义见 `visual.md` §1（封面三层路径）和 §2（插图三路径）。

构建时根据环境自动选择最佳路径，保证无依赖也能输出：

| 资产类型 | L1 最佳 | L2 降级 | L3 兜底 |
|----------|---------|---------|---------|
| **封面** | 用户提供 `coverImage`；或宿主侧图像工具生成后落盘再配置 | 设计感 SVG 封面（`visualPreset`） | 纯文字 SVG 封面 |
| **图表** | Mermaid.js CDN 渲染（HTML 模式） | Mermaid 代码块保留（可复制到在线编辑器） | 纯文字流程块（↓├└→符号） |
| **插图** | 宿主侧图像工具（若可用）+ 用户确认路径；否则标记 `ILLUST` | SVG 几何插图（程序生成） | 占位框 + prompt 文字（供后续替换） |

**降级触发条件**：
- `enableMermaidCDN: false` → 图表降为L2
- 无 `coverImage` 且 `visualPreset` 非空 → 封面走L2设计SVG
- 插图始终生成L3占位，用户可自行替换为L1/L2成品

---

## 封面生成策略

| 条件 | 形式 |
|------|------|
| `coverImage`存在 | PNG→Base64内嵌 |
| 无封面图+standalone | 自动SVG文字封面（主色渐变+书名+装饰） |
| 其他 | 简单文字标题 |

---

## 陷阱与教训

### 中英排版差异（最高优先级）

| 维度 | 英文惯例 | 中文标准 | AI常犯错误 |
|------|----------|----------|-----------|
| 缩进 | 选择性 | 全部2em | `h1+p{text-indent:0}` |
| 章标题 | 居中+大字距 | 左对齐+0字距 | `center; letter-spacing:6px` |
| 金句 | 居中+装饰线 | 左对齐+左边条 | `center; border-image` |
| 题引 | 居中斜体 | 两端对齐楷体 | `center; font-style:italic` |

### 数据脱敏

- 搜索大数字：`grep "\d+[,.]?\d{3}人\|万人" *.md`
- SVG图表文字同步检查
- 内部数据→通用描述

### 构建问题

| 问题 | 原因 | 解决 |
|------|------|------|
| EBUSY | PDF在阅读器中打开 | 关闭阅读器 |
| 中文乱码 | 缺字体 | `apt install fonts-noto-cjk` |
| SVG文字缺失 | 无对应字体 | 确保font-family可用 |
