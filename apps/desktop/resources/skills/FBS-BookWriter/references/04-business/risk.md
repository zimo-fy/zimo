# FBS-BookWriter 风险管控体系

> 版本：v1.0 | 生效日期：2026-03-21 | 归口：风险管控（文档维护）

---

## 1. 风险分类响应框架

### 1.1 四类风险响应策略

| 风险类型 | 定义 | 响应策略 | 示例 |
|----------|------|----------|------|
| **瞬时故障** | 临时性不稳定，通常来自网络抖动或远程服务偶发异常 | 指数退避重试（最大3次） | CDN短暂超时、API偶发500 |
| **确定性故障** | 输入或条件确定错误，重试无法解决 | 停止重试，修复输入 | 格式错误、依赖缺失、权限不足 |
| **外部依赖故障** | 第三方服务不可用或返回错误 | 降级方案，通知用户 | Mermaid CDN失效、图像API宕机 |
| **策略阻止** | 内容/行为触发平台策略限制 | 请求批准，上报人类 | 学术警告触发、敏感词拦截 |

### 1.2 响应流程图

```
风险检测
    │
    ▼
┌─────────────────────────────────────────┐
│  瞬时故障?  ──是──→  指数退避重试(≤3次) │
└─────────────────────────────────────────┘
    │否
    ▼
┌─────────────────────────────────────────┐
│  确定性故障? ──是──→  停止重试，修复输入 │
└─────────────────────────────────────────┘
    │否
    ▼
┌─────────────────────────────────────────┐
│  外部依赖故障? ──是──→  触发降级方案     │
└─────────────────────────────────────────┘
    │否
    ▼
┌─────────────────────────────────────────┐
│  策略阻止?  ──是──→  请求批准/上报人类   │
└─────────────────────────────────────────┘
    │否
    ▼
    记录日志，继续执行
```

### 1.3 指数退避规范

```javascript
// 瞬时故障重试策略
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,      // 初始延迟 1秒
  maxDelay: 10000,      // 最大延迟 10秒
  backoffMultiplier: 2  // 退避倍数
};

// 重试延迟计算
function getRetryDelay(attempt) {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );
  // 添加 jitter 避免雷鸣坑
  return delay * (0.5 + Math.random() * 0.5);
}
```

---

## 2. 状态终端定义

### 2.1 四种终态

| 状态 | 含义 | 触发条件 | 后续动作 |
|------|------|----------|----------|
| `NEED_INPUT` | 等待用户输入 | 任务需用户补充信息 | 提示用户，提供选项 |
| `NEED_APPROVAL` | 等待用户审批 | 触发策略阻止或高风险操作 | 展示风险，等待确认 |
| `QUEUED` | 排队中 | 系统繁忙，资源不足 | 显示队列位置，预计时间 |
| `SAFE_FAILURE` | 安全失败，已降级 | 所有降级方案耗尽 | 记录原因，通知用户，提供替代 |

### 2.2 状态流转

```
          ┌──────────────┐
          │   PENDING    │
          └──────┬───────┘
                 │
          ┌──────▼───────┐
    ┌─────│  瞬时故障?   │─────┐
    │     └──────────────┘     │
    │yes                       │no
    ▼                          ▼
┌─────────┐            ┌───────────────┐
│ 重试≤3? │            │ 确定性故障?   │
└────┬────┘            └───────┬───────┘
     │yes                      │yes
     ▼                         ▼
┌─────────┐            ┌───────────────┐
│RETRYING │            │ NEED_INPUT    │
└─────────┘            └───────────────┘
     │no                      │
     ▼                        │no
┌─────────────┐               ▼
│SAFE_FAILURE │     ┌───────────────┐
└─────────────┘     │外部依赖故障?  │
                     └───────┬───────┘
                             │yes
                             ▼
                     ┌───────────────┐
                     │ 触发降级方案   │
                     └───────┬───────┘
                             │
                             ▼
                     ┌───────────────┐
                     │  策略阻止?    │
                     └───────┬───────┘
                             │yes
                             ▼
                     ┌───────────────┐
                     │NEED_APPROVAL  │
                     └───────────────┘
```

---

## 3. 2026 AI工具可靠性设计硬性限制

### 3.1 运行时硬性限制

| 限制项 | 硬性上限 | 说明 |
|--------|----------|------|
| 单任务最大调用次数 | **50次** | 超出强制终止，防止无限循环 |
| 单任务最大重试次数 | **3次** | 瞬时故障重试上限 |
| 单任务最大步骤数 | **100步** | 防止长流程失控 |
| 单任务最大运行时长 | **10分钟** | 防止后台持续消耗资源 |

### 3.2 资源监控点

```javascript
const runtimeLimits = {
  maxCalls: 50,
  maxRetries: 3,
  maxSteps: 100,
  maxRuntimeMinutes: 10,

  // 监控指标
  currentCalls: 0,
  currentRetries: 0,
  currentSteps: 0,
  startTime: null,

  // 预警阈值（达到80%时警告）
  warningThreshold: 0.8,

  // 检查函数
  shouldWarn() {
    return this.currentCalls >= this.maxCalls * this.warningThreshold ||
           this.currentSteps >= this.maxSteps * this.warningThreshold ||
           this.getElapsedMinutes() >= this.maxRuntimeMinutes * this.warningThreshold;
  },

  shouldTerminate() {
    return this.currentCalls >= this.maxCalls ||
           this.currentSteps >= this.maxSteps ||
           this.getElapsedMinutes() >= this.maxRuntimeMinutes;
  }
};
```

### 3.3 超限处理流程

```
监控检查（每步骤执行后）
    │
    ▼
┌─────────────────────────────────────────┐
│  shouldWarn()? ──是──→  发送状态警告     │
└─────────────────────────────────────────┘
    │否
    ▼
┌─────────────────────────────────────────┐
│  shouldTerminate()? ──是──→  强制终止   │
│                                 │       │
│                     SAFE_FAILURE +      │
│                     记录完整日志         │
└─────────────────────────────────────────┘
    │否
    ▼
    继续执行
```

---

## 4. 降级策略

### 4.1 Mermaid渲染失败降级（L1-L4）

| 级别 | 策略 | 触发条件 | 恢复方式 |
|------|------|----------|----------|
| **L1** | 替换CDN | jsDelivr超时/错误 | 切换到unpkg CDN |
| **L2** | 本地Mermaid | CDN完全不可用 | 使用内置mermaid.min.js |
| **L3** | ASCII图表 | 本地渲染也失败 | Mermaid → 文字方框图 |
| **L4** | 纯文字描述 | 所有渲染失败 | 输出结构化文字说明 |

#### L1: CDN替换方案

```javascript
const mermaidCDNs = [
  'https://unpkg.com/mermaid@10/dist/mermaid.esm.min.mjs',  // Primary
  'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'  // Fallback (deprecated but kept)
];

let currentCDNIndex = 0;

async function loadMermaid() {
  for (let attempt = 0; attempt < mermaidCDNs.length; attempt++) {
    try {
      const cdn = mermaidCDNs[currentCDNIndex];
      await loadScript(cdn);
      mermaid.initialize({ startOnLoad: true });
      return true;
    } catch (error) {
      console.warn(`CDN ${currentCDNIndex} failed, trying next...`);
      currentCDNIndex++;
    }
  }
  return false; // 触发L2
}
```

#### L2: 本地Mermaid方案

```javascript
// 本地Mermaid文件路径
const localMermaidPath = './assets/mermaid.min.js';

async function loadLocalMermaid() {
  try {
    await loadScript(localMermaidPath);
    mermaid.initialize({ startOnLoad: true });
    return true;
  } catch (error) {
    console.error('Local mermaid also failed');
    return false; // 触发L3
  }
}
```

#### L3: ASCII图表降级

```javascript
function mermaidToAscii(mermaidCode) {
  // 将常见Mermaid图表转为ASCII
  const diagramType = mermaidCode.match(/^(\w+)\s*Diagram/) || ['', 'flowchart'];

  switch (diagramType[1]) {
    case 'flowchart':
      return flowchartToAscii(mermaidCode);
    case 'sequence':
      return sequenceToAscii(mermaidCode);
    case 'class':
      return classToAscii(mermaidCode);
    case 'state':
      return stateToAscii(mermaidCode);
    default:
      return textToAscii(mermaidCode);
  }
}

function flowchartToAscii(code) {
  // 简化实现：提取节点和连接，转为方框图
  const nodes = extractNodes(code);
  const edges = extractEdges(code);

  let ascii = '┌─────────┐\n';
  ascii += '│  START  │\n';
  ascii += '└────┬────┘\n';
  ascii += '     │\n';

  nodes.forEach((node, i) => {
    ascii += '┌─────────┐\n';
    ascii += `│   ${node.substring(0, 7)}   │\n`;
    ascii += '└────┬────┘\n';
    ascii += '     │\n';
  });

  ascii += '┌─────────┐\n';
  ascii += '│   END    │\n';
  ascii += '└─────────┘';

  return ascii;
}
```

#### L4: 纯文字描述降级

```javascript
function mermaidToTextDescription(mermaidCode) {
  const lines = mermaidCode.split('\n');
  const description = {
    type: 'unknown',
    nodes: [],
    edges: []
  };

  lines.forEach(line => {
    if (line.includes('-->')) {
      const [from, to] = line.split('-->').map(s => s.trim());
      description.edges.push({ from, to });
    } else if (line.includes('[')) {
      const node = line.match(/\[([^\]]+)\]/)?.[1];
      if (node) description.nodes.push(node);
    }
  });

  return `此图表包含以下结构：\n` +
    `- 类型：${description.type}\n` +
    `- 节点：${description.nodes.join(' → ') || '无'}\n` +
    `- 连接：${description.edges.map(e => `${e.from} → ${e.to}`).join(', ') || '无'}`;
}
```

### 4.2 图像与图表降级（与 FBS-BookWriter 交付一致）

> 本技能包**不内置**位图生成 API 或固定供应商；下列为**规范层**降级顺序，供宿主或用户项目实现时参考。详述见 [`visual.md`](../visual.md)（根级）或 [`03-product/08-visual.md`](../03-product/08-visual.md)、[`assets/build.mjs`](../../assets/build.mjs)。

| 优先级 | 策略 | 说明 |
|--------|------|------|
| **P1** | Mermaid / SVG / 程序化图表 | 无外部密钥，构建链已覆盖部分场景 |
| **P2** | 用户提供 `coverImage` 或本地素材路径 | 文件在仓库内可复现 |
| **P3** | 宿主侧图像工具（若会话中可用） | 生成后须**保存为项目文件**再引用，避免悬空 URL |
| **P4** | `ILLUST` 占位 + 文案说明 | 构建脚本可输出占位，便于后续替换 |
| **P5** | 用户自管第三方图像 API | 密钥、合规与 SLA **由用户自负**；本仓库不提供示例端点 |

### 4.3 降级策略全景图（概念）

```
图表/装饰需求
      │
      ▼
┌─────────────────┐
│ P1 程序化/SVG   │ ← 默认优先
└────────┬────────┘
      不可用
      ▼
┌─────────────────┐
│ P2 用户素材路径 │
└────────┬────────┘
      不可用
      ▼
┌─────────────────┐
│ P3 宿主图像工具 │ → 落盘后再引用
└────────┬────────┘
      不可用
      ▼
┌─────────────────┐
│ P4 占位 / P5 自管 API │
└─────────────────┘
```

---

## 5. 风险登记册

### 5.1 高风险项

| ID | 风险描述 | 概率 | 影响 | 应对策略 | 归口领域 |
|----|----------|------|------|----------|----------|
| R-01 | Mermaid CDN完全不可用 | 中 | 高 | L1→L2→L3→L4降级链 | 风险管控 |
| R-02 | 位图/宿主图像能力不可用 | 低 | 中 | 按 §4.2：SVG→素材→占位 | 风险管控 |
| R-03 | 单任务超过50次调用 | 低 | 高 | 强制终止+SAFE_FAILURE | 风险管控 |
| R-04 | 学术警告误拦截 | 中 | 中 | NEED_APPROVAL人工复核 | 合规 |
| R-05 | 用户审批点堆积 | 中 | 中 | QUEUED状态+预估时间 | 用户体验 |

### 5.2 中风险项

| ID | 风险描述 | 概率 | 影响 | 应对策略 | 归口领域 |
|----|----------|------|------|----------|----------|
| R-06 | 重试3次后仍瞬时故障 | 低 | 中 | 指数退避+记录日志 | 风险管控 |
| R-07 | 外部依赖超时 | 高 | 低 | 超时配置+降级 | 稳定性 |
| R-08 | 多Agent协作死锁 | 低 | 高 | 心跳协议+强制清理 | 多Agent协作 |

---

## 6. 实施检查清单

### 6.1 P1-R1风险管控体系落地

- [ ] 状态机实现（NEED_INPUT/NEED_APPROVAL/QUEUED/SAFE_FAILURE）
- [ ] 指数退避重试逻辑（最大3次）
- [ ] 运行时限制检查（50次/100步/10分钟）
- [ ] 风险登记册更新机制

### 6.2 P1-R2降级策略落地

- [ ] Mermaid CDN替换机制（L1）
- [ ] 本地Mermaid fallback（L2）
- [ ] ASCII图表降级（L3）
- [ ] 纯文字描述降级（L4）
- [ ] 图像与图表：程序化 / SVG → 用户素材 → 宿主工具落盘 → 占位（与 §4.2 一致）

---

## 7. 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-03-21 | 初始版本 | 福帮手AI团队 |
