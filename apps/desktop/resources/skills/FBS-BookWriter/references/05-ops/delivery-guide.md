# 用户自助交付指南

> **文档信息**
> - **名称**：delivery-guide.md
> - **描述**：FBS-BookWriter 从 MD/HTML 到各格式输出的指南
> - **归属于**：references/
> - **导航**：[返回SKILL.md](../../SKILL.md) | [用户安装指南](../03-product/01-user-install-guide.md) | [文档索引](../01-core/skill-index.md)

---

## 标准输出说明

FBS-BookWriter 的**标准输出格式**为：

| 格式 | 说明 | 获取方式 |
|------|------|----------|
| **Markdown (.md)** | 纯文本，通用性最强 | AI直接输出 |
| **HTML (.html)** | 美化排版，含Mermaid图表 | AI生成或本地构建 |

这两个格式**无需安装任何npm包**，核心功能100%可用。

---

## 可选转换指南

### HTML → PDF

#### 方案1：浏览器打印（推荐 - 零配置）

**优点**：
- 零安装
- 渲染质量最高（含CSS样式的完整呈现）
- Mermaid图表完美渲染
- 中文支持最好

**操作步骤**：

```
1. 在浏览器中打开HTML文件
2. 按 Ctrl + P 打开打印对话框
3. 目标打印机选择"保存为PDF"
4. 布局选择"横向"（推荐）
5. 边距选择"无"（获得最大内容区）
6. 勾选"背景图形"选项
7. 点击"保存"或"打印"
```

**优化建议**：

| 设置项 | 推荐值 | 原因 |
|--------|--------|------|
| 布局 | 横向 | 避免代码块换行 |
| 边距 | 无 | 最大内容区 |
| 背景图形 | 勾选 | 确保CSS样式和图表打印 |
| 纸张大小 | A4 / Letter | 根据用途选择 |

---

#### 方案2：Playwright PDF生成

**适用场景**：
- 需要自动化批量生成
- 服务端渲染
- 追求一致的跨平台输出

**安装步骤**：
```bash
npm install playwright
npx playwright install chromium
```

**使用示例**：
```javascript
const { chromium } = require('playwright');

async function generatePDF(inputPath, outputPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 加载HTML文件
  await page.goto(`file://${inputPath}`, { waitUntil: 'networkidle' });

  // 生成PDF
  await page.pdf({
    path: outputPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });

  await browser.close();
  console.log(`✅ PDF已生成: ${outputPath}`);
}

// 使用
generatePDF('./output/book.html', './output/book.pdf');
```

**Python 示例**（自行保存为脚本即可，最小技能包不附带仓库内路径）：
```bash
python pdf_generator.py --input ./output/book.html --output ./output/book.pdf
```

---

#### 方案3：Puppeteer PDF生成

**安装**：
```bash
npm install puppeteer
```

**使用示例**：
```javascript
const puppeteer = require('puppeteer');

async function generatePDF(inputPath, outputPath) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`file://${inputPath}`, { waitUntil: 'networkidle' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    landscape: true,
    printBackground: true
  });

  await browser.close();
}
```

---

### HTML → DOCX

#### 方案1：在线工具（推荐）

**优点**：
- 零配置
- 格式保真度高
- 无需安装软件

**推荐工具**：

| 工具 | 地址 | 免费额度 | 隐私保护 | 推荐度 |
|------|------|----------|----------|--------|
| **CloudConvert** | cloudconvert.com/html-to-docx | 25次/天 | 中 | ⭐⭐⭐⭐⭐ |
| **Convertio** | convertio.co/html-docx | 10次/天 | 中 | ⭐⭐⭐⭐ |
| **iLovePDF** | ilovepdf.com/html_to_word | 无限 | 中 | ⭐⭐⭐⭐ |

**操作步骤（以CloudConvert为例）**：

```
1. 打开 https://cloudconvert.com/html-to-docx
2. 点击"Select File"选择HTML文件
3. 确认输出格式为DOCX
4. 点击"Convert"开始转换
5. 等待转换完成，下载DOCX文件
```

**注意事项**：
- 上传文件涉及隐私，请勿上传敏感内容
- 大文件可能需要付费

---

#### 方案2：html-to-docx（本地转换）

**安装**：
```bash
npm install html-to-docx
```

**使用示例**：
```javascript
const { convert } = require('html-to-docx');
const fs = require('fs-extra');

async function convertToDocx(inputPath, outputPath) {
  try {
    const htmlContent = await fs.readFile(inputPath, 'utf-8');

    const buffer = await convert(htmlContent, {
      outputDir: './output',
      fileName: 'book',
      headers: {
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: ''
      }
    });

    await fs.writeFile(outputPath, buffer);
    console.log(`✅ DOCX已生成: ${outputPath}`);
  } catch (error) {
    console.error('❌ 转换失败:', error.message);
  }
}

convertToDocx('./output/book.html', './output/book.docx');
```

**局限性**：
- CSS支持有限，复杂排版可能失真
- Mermaid图表不会保留

---

### HTML → PPTX

**说明**：目前没有完美的自动化方案，建议手动处理。

**方案**：
1. **复制粘贴**：在浏览器中打开HTML，选择性复制内容，粘贴到PowerPoint
2. **在线工具**：使用Convertio等工具尝试HTML到PPTX转换
3. **手动创建**：根据HTML内容手动创建PPT

---

## 各格式渲染质量对比

| 格式 | CSS样式 | Mermaid图表 | 中文渲染 | 表格 | 代码高亮 |
|------|---------|-------------|----------|------|----------|
| **HTML** | ✅ 完整 | ✅ 渲染 | ✅ 完美 | ✅ 完整 | ✅ 完整 |
| **PDF（浏览器）** | ✅ 完整 | ✅ 完整 | ✅ 完美 | ✅ 完整 | ✅ 完整 |
| **PDF（Playwright）** | ✅ 完整 | ✅ 完整 | ✅ 完美 | ✅ 完整 | ✅ 完整 |
| **DOCX（在线工具）** | ⚠️ 部分 | ❌ 丢失 | ✅ 完整 | ⚠️ 部分 | ⚠️ 部分 |
| **DOCX（html-to-docx）** | ❌ 丢失 | ❌ 丢失 | ✅ 完整 | ✅ 完整 | ⚠️ 部分 |
| **PPTX** | ❌ 丢失 | ❌ 丢失 | ✅ 完整 | ⚠️ 需手动 | ❌ 丢失 |

---

## 工作流推荐

### 场景A：快速分享（最常用）

```
1. 获取AI生成的Markdown
2. 直接分享.md文件
   或
3. 用浏览器打开HTML版本
4. Ctrl+P 打印为PDF
5. 分享PDF
```

### 场景B：正式出版

```
1. 获取AI生成的Markdown
2. 构建HTML版本
3. 使用Playwright生成高质量PDF
4. 如需Word版本：
   - 使用在线工具转换PDF为DOCX
   - 或在Word中打开PDF手动调整
```

### 场景C：团队协作

```
1. 生成Markdown版本
2. 托管到GitHub/GitLab
3. 团队成员克隆后自行构建所需格式
4. 使用浏览器打印生成PDF
```

### 场景D：学术发表

```
1. 生成Markdown版本
2. 使用专业排版工具（如LaTeX）
3. 或使用在线工具转换为DOCX后在Word中精调
4. 确保格式符合期刊要求
```

---

## 输出格式选择决策树

```
                    需要输出？
                       │
         ┌─────────────┴─────────────┐
         │                           │
        是                           否
         │                           │
         ▼                           ▼
   ┌─────────────┐            继续使用Markdown
   │ 什么格式？   │
   └─────────────┘
         │
    ┌────┴────┬──────────┐
    │         │          │
   PDF       DOCX       其他
    │         │          │
    ▼         ▼          ▼
 浏览器打印  在线工具   手动处理
（最简单）  （最保真）
    │
    ▼
需要自动化？
  │
  ├─ 是 → Playwright
  └─ 否 → 浏览器打印
```

---

## 常见问题

### Q1：生成的PDF排版错乱怎么办？

**A：** 尝试以下解决方案：

1. **使用浏览器打印**（而非第三方工具）
2. **更新浏览器**（Chrome最新版本排版最准确）
3. **检查CSS**（确保HTML中的CSS与浏览器兼容）

### Q2：Mermaid图表在PDF中显示为代码？

**A：** 确保：
1. 使用浏览器打印（不是截图）
2. 勾选了"背景图形"选项
3. Mermaid.js库正确加载

### Q3：中文显示为方块或乱码？

**A：** 
1. 确保HTML中指定了中文字体
2. 系统安装了中文字体
3. 使用Playwright方案（中文支持最好）

### Q4：表格在DOCX中格式错乱？

**A：** 
1. 使用在线工具转换（如CloudConvert）
2. 或手动在Word中复制表格
3. html-to-docx对表格支持较好，可尝试

### Q5：想保留Mermaid图表但需要Word版本？

**A：** 
1. 将Mermaid图表单独导出为图片
2. 在Word中插入图片替代
3. 或使用在线OCR工具处理

---

## 下一步

交付指南完成后，建议阅读：

1. [SKILL.md](../../SKILL.md) - 主技能文档
2. [用户安装指南](../03-product/01-user-install-guide.md) - npm 按需安装说明
3. [文档索引](../01-core/skill-index.md) - 规范导航

---
