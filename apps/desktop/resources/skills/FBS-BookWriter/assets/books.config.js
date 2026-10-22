/**
 * FBS-BookWriter 多书配置
 *
 * 每本书一个对象，构建脚本会遍历此数组。
 * 运行:  node build.mjs          — 构建全部
 *        node build.mjs B1       — 只构建 id 匹配项
 */

export const BOOKS = [
  {
    /* ── 标识 ─────────────────────────────── */
    id: 'B1',                         // CLI 选择器: node build.mjs B1
    title: '书名',
    subtitle: '副标题（可空）',
    author: '作者名',
    outputName: 'B1-输出文件名',       // 生成文件名前缀（不含扩展名）

    /* ── 配色（五预设映射见 references/presets.md §2） ─ */
    color: '#2C5F7C',                 // → CSS --c-main 主色（默认⑤钢青蓝）
    lightBg: '#F4F7FA',               // → CSS --c-lightbg 浅背景
    accentBg: '#E3EDF4',              // → CSS --c-accentbg 强调背景
    accentGold: '#D4A843',            // → CSS --c-gold 金色强调（通常不改）

    /* ── 封面 ─────────────────────────────── */
    coverImage: '',                   // 封面图路径; 空→自动降级（见 visual.md §1）

    /* ── 源文件 ─────────────────────────────── */
    srcDir: './src',                  // Markdown 源文件目录
    files: [                          // 按阅读顺序排列
      '00-前言.md',
      '01-第一章.md',
      '02-第二章.md',
      // ...按需添加
      '99-附录.md',
    ],

    /* ── 系列 ─────────────────────────────── */
    series: 'standalone',             // standalone | 系列名
    copyrightExtra: '一句话定位',      // 版权页附加说明
    // brandMode: 'none',             // 可选：关闭 build.mjs 版权页/PDF 页脚/SVG 底栏品牌行（默认露出，见 references/05-ops/brand-outputs.md）

    /* ── 排版（可选覆盖，缺省用 style.css 默认值） ── */
    density: 'standard',              // standard | compact | loose

    /* ── 视觉资产（对应 visual.md + presets.md 视觉维度） ── */
    visualPreset: '',                 // 封面装饰预设: 'geometric'|'wave'|'grid'|'bubble'|'ladder'|''
    illustrationStyle: '',            // 插图风格: 'flat'|'watercolor'|'line-art'|'minimal'|''
    mermaidTheme: 'base',             // Mermaid主题: 'base'|'neutral'|'dark'|'forest'
    chartDensity: 'auto',             // 图表密度: 'auto'|'high'|'low'|'none'
    enableMermaidCDN: true,           // HTML中是否引入Mermaid.js CDN
  },
];
