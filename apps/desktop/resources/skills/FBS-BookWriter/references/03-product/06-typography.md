# 中文排版规范

> 阶段4/5加载 | 排版构建和终审时对照
> 排版质量三层分级：底线规范（不可违反）/ 创意空间（有范围可变）/ 审美指导（参考方向）

---

## 一、底线规范（不可违反 — 一校机械检测）

**这些规则是中文排版标准，不得以"优化"为由违反。**

| 规则 | CSS | 严禁 |
|------|-----|------|
| 所有段落2em缩进 | `p { text-indent: 2em; }` | `h1+p{text-indent:0}`（英文惯例） |
| 段落两端对齐 | `p { text-align: justify; }` | — |
| h1左对齐 | `h1 { text-align: left; }` | 居中（英文惯例） |
| h1无字间距 | `h1 { letter-spacing: 0; }` | `letter-spacing:6px`（英文惯例） |
| h1仅下边框 | `border-bottom: 3px solid var(--c-main);` | 上边框 |
| h1自动分页 | `h1 { page-break-before: always; }` | — |
| h2左侧色条 | `border-left: 4px solid var(--c-main);` | — |
| 金句左对齐 | `text-align: justify; text-indent: 2em;` | 居中+装饰线（英文pull-quote） |
| 金句左金色边条 | `border-left: 3px solid var(--c-gold);` | `border-image:gradient` |
| 题引两端对齐 | `text-align: justify; text-indent: 2em;` | 居中+斜体（英文惯例） |
| A4页面 | `@page { size: A4; margin: 25mm 20mm; }` | — |

> **根因**：搜索"typography best practices"得到的结果默认面向英文。中文有独立排版传统，AI必须主动拒绝英文默认值。

---

## 二、创意空间（有范围的可变区域 — 终审评估）

以下元素允许在约束范围内自由发挥，鼓励每本书形成独特的视觉个性。

| 元素 | 可变范围 | 约束（红线） |
|------|---------|-------------|
| 金句呈现 | 左边条 / 卡片式 / 浅底色块 / 引号装饰 | 必须可区分正文；风格全书统一 |
| 章首装饰 | 大号首字 / 装饰线 / 主题图标 / 纯色块 | 不遮挡标题；不超过标题区30%面积 |
| 信息图风格 | 扁平 / 线框 / 手绘感 / 渐变 | 全书统一风格；可读性优先于美观 |
| 配色明暗 | 主色基础上可调亮度±15% | 不脱离配色预设的色相 |
| CTA提示框 | 渐变 / 纯色 / 描边 / 圆角变化 | 必须可一眼识别为行动提示 |
| 表格样式 | 斑马纹 / 无线框 / 卡片式 | 对齐清晰；字号不小于9pt |
| 代码块 | 深底浅字 / 浅底深字 / 带行号 | 等宽字体不可更改 |

---

## 三、审美指导（参考方向，非强制 — 三校体感判断）

| 维度 | 指导原则 |
|------|---------|
| 留白 | 信息密集段后留白缓冲；章尾留至少1/3页空白 |
| 视觉重心 | 每个跨页有一个视觉锚点（表/图/金句/CTA），避免纯文字连续3页 |
| 图文比 | 每5000字至少1个非文字元素（表格/流程图/对比图） |
| 节奏可视化 | 长段落（>150字）后跟短元素（表/清单/金句），避免连续3个长段 |
| 封面构图 | 主色占60%以上面积，标题视觉权重最大，留呼吸空间 |
| 色彩情绪 | 暖色（橙/金）→活力感；冷色（蓝/绿）→专业感；紫→创意感 |

---

## 四、字族策略

| 角色 | 字族 | CSS变量 | 场景 |
|------|------|---------|------|
| 标题/强调 | 黑体 | `--fn-hei` | h1-h4、表头、CTA |
| 正文/阅读 | 宋体 | `--fn-song` | 段落、列表、表格 |
| 引用/辅助 | 楷体 | `--fn-kai` | 引用、题引、金句、过渡语 |

Fallback链（覆盖Win/Mac/Linux）：
```css
--fn-hei: "Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei","SimHei",sans-serif;
--fn-song: "Source Han Serif SC","Noto Serif CJK SC","SimSun","宋体",serif;
--fn-kai: "KaiTi","STKaiti","楷体",serif;
```

---

## 五、版面密度

| 选项 | 行距 | 段间距 | 页边距 |
|------|------|--------|--------|
| 标准 | 1.8 | 8px | 25mm/20mm |
| 紧凑 | 1.5 | 4px | 20mm/15mm |
| 宽松 | 2.2 | 16px | 30mm/25mm |

> 详细密度参数见 `presets.md` §2 排版密度。

---

## 语义元素CSS

```css
/* 金句 */
p.jinqu {
  font-family: var(--fn-kai); font-size: 11pt; color: var(--c-main);
  text-align: justify; text-indent: 2em;
  border-left: 3px solid var(--c-gold);
  background: var(--c-accentbg); border-radius: 0 4px 4px 0;
  padding: 12px 16px; margin: 16px 0;
}
/* 题引 */
p.epigraph {
  font-family: var(--fn-kai); font-size: 11pt; color: #666;
  text-align: justify; text-indent: 2em;
  border-bottom: 1px solid var(--c-main)22; padding-bottom: 12px;
}
/* 章尾过渡 */
p.chapter-next {
  font-family: var(--fn-kai); font-size: 9.5pt; color: #999;
  text-align: right; text-indent: 0;
}
/* CTA */
.cta-box {
  background: linear-gradient(135deg, var(--c-accentbg), var(--c-lightbg));
  border-left: 5px solid var(--c-gold); border-radius: 6px; padding: 16px 20px;
}
/* 流程块 */
.flow-block {
  background: var(--c-accentbg); border-left: 4px solid var(--c-main);
  border-radius: 6px; font-family: var(--fn-hei); white-space: pre-wrap;
  padding: 16px; margin: 16px 0;
}
/* 清单 */
ul.checklist { list-style: none; }
ul.checklist li::before {
  content: ""; width: 14px; height: 14px;
  border: 2px solid var(--c-main); border-radius: 3px;
}
```

---

## 六·附、插图与Mermaid排版规则

| 元素 | CSS类 | 排版要求 |
|------|-------|---------|
| 插图容器 | `.illustration` | 居中，上下各`20px`间距，`max-width:90%` |
| 插图标题 | `.illustration-caption` | 居中，9pt，灰色`#888`，上间距`6px` |
| 章首插图 | `.chapter-header-illust` | `max-height:200px`，居中，与h1间距`16px` |
| 插图占位 | `.illustration-placeholder` | 虚线框`2px dashed #ccc`，浅灰底`#f9f9f9`，居中文字提示 |
| Mermaid容器 | `.mermaid-container` | 居中，上下各`20px`间距，`max-width:100%`，溢出滚动 |
| Mermaid代码块 | `.mermaid-code` | `display:none`（PDF模式隐藏源码，仅保留渲染图） |

**Mermaid排版约束**：
- 节点标签≤15汉字（超出换行或缩写）
- 中文字体指定：`fontFamily: "Source Han Sans SC,Microsoft YaHei,sans-serif"`
- 配色通过 `%%{init:...}%%` 注入，不在图内硬编码颜色

---

## 七、语义标记约定（写MD时对照）

| 语义 | Markdown写法 | 效果 |
|------|-------------|------|
| 章标题 | `# 标题` | 24pt黑体 左对齐 下边框 分页 |
| 节标题 | `## 标题` | 17pt黑体 左侧色条 |
| 金句 | `**一句话。**`（独立段落，无冒号） | 楷体 金色左边 浅背景 |
| 题引 | `#`后紧接的第一段 | 楷体 灰色 底线 |
| 过渡语 | `*下一章...*` | 右对齐 小字 |
| 流程图 | 代码块+↓├└→ | 黑体 预格式 强调背景 |
| CTA | `> 公众号...` | 金色边框提示框 |
| 图表 | `<!-- P02-1：标题 -->`+SVG | 居中 编号图注 |
| 清单 | `- [ ] 项目` | CSS checkbox |

---

## 八、后处理规则（构建引擎自动执行）

| 规则 | 检测 | 转换 |
|------|------|------|
| H1金句 | `<p><strong>纯文字</strong></p>`无冒号 | `.jinqu` |
| H2题引 | h1紧接的第一个`<p>` | `.epigraph` |
| H3过渡语 | `<em>`以"下一章/翻到"开头 | `.chapter-next` |
| H4流程块 | `<pre><code>`含↓├└→ | `.flow-block` |
| H5 CTA | `<blockquote>`含"公众号/后台回复" | `.cta-box` |
| H6图表 | `<!-- P02-1：标题 -->`+SVG | `.figure`+图注 |
| H7清单 | `<li>[ ]` | `.checklist` |
| H8插图标记 | `<!-- ILLUST: type \| prompt: ... \| caption: ... -->` | `.illustration` / `.chapter-header-illust` + `.illustration-placeholder` |
| H9 Mermaid | ` ```mermaid ` 代码块 | `.mermaid-container`（CDN渲染或`.mermaid-code`源码） |

H1→H9串行执行，各规则与 `build.mjs` 函数 1:1 对齐。

---

## 九、排版检查清单

- [ ] 所有段落2em缩进（无例外）
- [ ] h1左对齐、下边框、无字间距
- [ ] 金句：左对齐+金色左边条+浅背景
- [ ] 所有内部数据已脱敏
- [ ] SVG图表文字同步检查
- [ ] 流程图使用↓├└→
- [ ] CTA含触发关键词
- [ ] 每段不超200字
- [ ] 构建前关闭PDF阅读器
- [ ] 三格式正常生成
- [ ] Mermaid图表节点标签≤15汉字（定义见 `visual.md` §3）
- [ ] 每章Mermaid/插图标记数与目录视觉规划一致
- [ ] 插图标记格式正确（`<!-- ILLUST: type | prompt: ... | caption: ... -->`）
- [ ] 无孤立Mermaid代码块（每个均有容器包裹）
