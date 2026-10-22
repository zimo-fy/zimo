# 新手引导体系（§8 完整版）

> **原章节**：SKILL.md §8
> **主题**：新手引导体系的说明、交互规范与实现要点（UI 由宿主实现）

---

## 导航

- [返回SKILL.md](../../SKILL.md)
- [返回§3工作流](./section-3-workflow.md)
- [偏好管理](#83-偏好管理)
- [资产管理](#84-资产管理)

---

## §8 新手引导体系

> **本章定位**：新手引导的交互与信息架构；具体组件由宿主实现

### 8.1 系统架构

#### 三层架构

```
前端交互层：
  - S0.5引导
  - 偏好面板
  - 资产面板
  - 模式切换

后端服务层：
  - NLU拦截层 (NLUInterceptor)
  - 用户分层服务 (Profile)
  - 偏好管理API (Preference)
  - 资产管理API (Asset)
  - 自动化规则API (Automation)

本地持久层：
  - onboarding状态 / preference配置 / assets索引 / rules配置
```

#### 模块依赖关系

```
NLUInterceptor (意图拦截)
    ↓
ModeSwitcher (模式切换) → UserClassifier (用户分层)
    ↓                           ↓
NoviceGuideHandler (引导处理)  PreferenceStore (偏好存储)
    ↓                           ↓
          PreferenceAPI (偏好API)
                ↓
          AssetIndex (资产索引)
                ↓
          RuleEngine (规则引擎)
```

---

### 8.2 S0.5 引导流程

> **与主规范对齐**：宿主若将「写书」类触发与 **S0 前置调研** 合并为首响，须遵守 [`SKILL.md`](../../SKILL.md) **「技能加载后的行为约定 → 触发词首响」**：避免仅追问「写什么主题」而不带 S0 说明；主题已在用户话术中时应直接推进调研/定位。

#### 触发条件

| 条件 | 触发逻辑 |
|------|----------|
| 新用户首次登录 | 用户ID无任何历史记录 |
| 180天未活跃回归 | lastActiveAt < (NOW - 180天) |
| 用户主动触发 | 说"重新引导"/"重新开始新手引导" |

#### 两轮对话流程

**第1轮：主题收集（必填）**
- 输入框：单行，最大200字符
- 占位符示例：例如"我想写一本关于理财的书"

**第2轮：确认启动（含可选模式）**

| 模式 | 适用场景 | 预计时长 | 推荐画像 |
|------|----------|----------|----------|
| 轻量 | 短篇指南、单篇文章 | 30分钟 | 探索者、退休人士 |
| 标准 | 手册，白皮书、课程 | 1-2小时 | 写作者、在读学生 |
| 完整 | 书籍、深度报告 | 3-5小时 | 专家、资深写作者 |

- 开始写作（主按钮）：关闭引导对话框，进入写作流程
- 自定义设置（次按钮）：打开偏好管理面板
- 可选模式：轻量/标准/完整（不单独计轮次）

#### 跳过引导
- **跳过指令**：跳过引导/专家模式/直接开始
- **恢复引导**：重新引导/重新开始新手引导

---

### 8.3 偏好管理

#### 偏好数据结构

```javascript
{
  preference: {
    profile: 'explorer' | 'writer' | 'expert' | 'student' | 'retiree',
    mode: 'light' | 'standard' | 'full',
    settings: {
      volume: 'light' | 'standard' | 'complete',
      style: 'narrative' | 'analytical' | 'balanced',
      approvalLevel: 'minimal' | 'normal' | 'strict',
      autoSave: boolean,
      grammarCheck: boolean
    },
    templates: [],
    updatedAt: timestamp
  }
}
```

#### 画像选择器

| 画像 | 图标 | 描述 | 推荐模式 |
|------|------|------|----------|
| 探索者 | 🔍 | 刚接触写作的新手小白 | 轻量/标准 |
| 写作者 | ✍️ | 有明确写作目标的进阶用户 | 标准/完整 |
| 专家 | 🎓 | 行业资深人士，需要深度内容创作 | 完整 |
| 在读学生 | 📖 | 学术/课程作业撰写需求 | 标准 |
| 退休人士 | 🌅 | 经验分享/传记写作爱好者 | 轻量/标准 |

#### 模板管理
- **预置模板**（不可删除）：商业计划书、产品白皮书、实战手册、行业分析报告
- **用户模板**（上限10个）：可创建、编辑、重命名、删除

---

### 8.4 资产管理

#### 资产分类

| 类型 | 图标 | 颜色标识 | 说明 |
|------|------|----------|------|
| 写作中 | 📝 | #6366F1 | 正在进行中的写作项目 |
| 已完成 | ✅ | #10B981 | 已完成的完整作品 |
| 草稿 | 📋 | #F59E0B | 未完成的片段/章节 |
| 归档 | 📦 | #6B7280 | 已归档的历史项目 |

#### 批量操作
- **移动到**：改变资产类型
- **删除**：批量删除资产（需二次确认）

---

### 8.5 自动化规则

#### 预置规则

| 规则ID | 触发条件 | 执行动作 |
|--------|----------|----------|
| R001 | S3完成时 | 提醒章节已就绪，请查看质量评分 |
| R002 | 质量评分小于7.5 | 提醒建议优化内容 |
| R003 | 180天未活跃 | 提示是否重新开始新手引导 |
| R004 | 每日首次访问 | 显示上次写作：项目名，继续吗 |

---

### 8.6 模式切换机制

#### 三种模式对比

| 特性 | 新手模式 | 熟手模式 | 专家模式 |
|------|----------|----------|----------|
| S0.5引导 | ✅ 强制 | ⚠️ 可选 | ❌ 跳过 |
| 偏好管理面板 | ✅ | ✅ | ✅ |
| 资产管理 | ✅ | ✅ | ✅ |
| 自动化规则 | ✅ 预置4条 | ✅ 预置加自定义 | ✅ 完全自定义 |
| 核心写作流程 | 标准流程 | 标准流程 | 标准流程 |
| B层审核 | ✅ 完整保留 | ✅ 完整保留 | ✅ 完整保留 |

#### 切换规则

| 操作 | 行为 |
|------|------|
| 新手到专家 | 立即切换，后续无引导 |
| 专家到新手 | 提示重新开始引导，确认后触发S0.5 |
| 新手到熟手 | 立即切换，保留偏好配置 |
| 180天未活跃 | 提示是否切换模式，不强制 |

---

### 8.7 积分系统（可选增强）

> **设计原则**：未绑定时功能零损失，绑定后平滑升级。

#### 功能开关机制

| 状态 | 功能 | 说明 |
|------|------|------|
| **未绑定**（默认） | 全部基础功能 | 无积分扣减，无积分奖励 |
| **已绑定** | 基础功能 + 积分功能 | 自动解锁积分奖励和消耗 |

#### 积分绑定流程

```
用户输入：绑定积分账户 <账户名> <密码>
   ↓
1. 接收账户和密码
2. 调用 U3W-AI 验证接口
3. 验证成功 → 保存绑定状态到 PreferenceStore
4. 解锁积分功能 → 提示用户
```

#### 积分规则编码

| 规则编码 | 说明 | 积分值 | 方向 |
|----------|------|--------|------|
| `DAILY_LOGIN` | 每日登录 | +10 | 奖励 |
| `CHAPTER_COMPLETE` | 完成章节 | +50 | 奖励 |
| `BOOK_COMPLETE` | 完成书籍 | +500 | 奖励 |
| `TEMPLATE_USE` | 使用模板 | -1 | 扣减 |
| `TEMPLATE_PUBLISH` | 发布模板 | +50 | 奖励 |
| `ASSET_SHARE` | 分享资产 | +30 | 奖励 |

#### API对接

| 端点 | 方法 | 说明 |
|------|------|------|
| `/points/precheck` | POST | 积分前置校验（扣减/奖励） |
| `/points/balance/{userId}` | GET | 查询积分余额 |
| `/points/records/{userId}` | GET | 查询积分明细 |

#### 容错机制

| 场景 | 行为 | 说明 |
|------|------|------|
| 积分 API 不可用 | 业务继续执行 | 降级，不阻塞用户操作 |
| 积分验证失败 | 提示错误 | 不改变任何状态 |
| 网络超时 | 重试1次 | 失败则降级 |

> **详细实现**：详见 `references/points-system.md`

---

### 8.7 NLU拦截层实现

#### 拦截器工作流程

```javascript
async function intercept(input, context) {
  const matchedIntent = matchIntentKeywords(input);
  if (!matchedIntent) {
    return { intercepted: false };
  }
  const handler = getHandler(matchedIntent.intent);
  const result = await handler.handle(input, context);
  return {
    intercepted: true,
    intent: matchedIntent.intent,
    result: result,
    latency: Date.now() - startTime
  };
}
```

#### 模块注册

```javascript
registry.register('mode_switch', new ModeSwitcherHandler());
registry.register('preference', new PreferenceAPIHandler());
registry.register('asset', AssetAPIAdapter);
registry.register('automation', new AutomationAPI());
registry.register('writing_topic', new NoviceGuideHandler());
```

#### 新增意图池（5类）

| 意图 | 中文触发 | 映射流程 |
|------|----------|----------|
| MODE_SWITCH | 切换模式/专家模式/新手模式 | → 模式切换UI |
| PREFERENCE | 偏好/设置/配置 | → 偏好管理面板 |
| ASSET | 资产/记忆/历史 | → 资产管理面板 |
| AUTOMATION | 自动化/提醒/规则 | → 自动化规则面板 |
| WRITING_TOPIC | 关于...的书/我想写 | → S0.5引导流程 |

---

### 8.8 前端组件清单

#### 新手引导组件

| 组件 | 文件 | 职责 |
|------|------|------|
| NoviceGuide | NoviceGuide.jsx | 引导流程主组件 |
| ModeSwitchUI | ModeSwitchUI.jsx | 模式切换UI |
| GuideDialog | GuideDialog.jsx | 引导对话框 |

#### 偏好管理组件

| 组件 | 文件 | 职责 |
|------|------|------|
| PreferencePanel | PreferencePanel.js | 偏好面板主组件 |
| ProfileSelector | ProfileSelector.js | 画像选择器 |
| TemplateCard | TemplateCard.js | 模板卡片 |
| QuickPreferenceInput | QuickPreferenceInput.js | 快速偏好输入 |

#### 资产管理组件

| 组件 | 文件 | 职责 |
|------|------|------|
| AssetPanel | AssetPanel.js | 资产面板主组件 |
| BatchCleaner | BatchCleaner.js | 批量清理工具 |
| AssetDetailDrawer | AssetDetailDrawer.jsx | 资产详情抽屉 |
| AssetNotificationToast | AssetNotificationToast.jsx | 资产通知Toast |

---

### 8.9 后端API清单

#### 偏好管理API

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/preference | GET | 获取用户偏好 |
| /api/preference | PUT | 更新用户偏好 |
| /api/preference/profile | PUT | 更新用户画像 |
| /api/preference/templates | GET | 获取模板列表 |
| /api/preference/templates | POST | 创建模板 |
| /api/preference/templates/:id | DELETE | 删除模板 |

#### 资产管理API

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/assets | GET | 获取资产列表 |
| /api/assets/:id | GET | 获取资产详情 |
| /api/assets | POST | 创建资产 |
| /api/assets/:id | PUT | 更新资产 |
| /api/assets/:id | DELETE | 删除资产 |
| /api/assets/batch | POST | 批量操作 |

#### 自动化规则API

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/automation/rules | GET | 获取规则列表 |
| /api/automation/rules | POST | 创建规则 |
| /api/automation/rules/:id | PUT | 更新规则 |
| /api/automation/rules/:id | DELETE | 删除规则 |
| /api/automation/rules/:id/enable | PUT | 启用规则 |
| /api/automation/rules/:id/disable | PUT | 禁用规则 |

---

### 8.10 测试覆盖

#### 单元测试

| 模块 | 测试文件 | 用例数 |
|------|----------|--------|
| NLU拦截层 | NLUInterceptor.test.js | 28 |
| 用户分层 | UserClassifier.test.js | 22 |
| 偏好管理 | PreferenceAPI.test.js | 35 |
| 资产管理 | AssetAPI.test.js | 31 |
| 自动化规则 | RuleEngine.test.js | 27 |
| 新手引导 | NoviceGuideHandler.test.js | 19 |

#### 集成测试

| 测试场景 | 测试文件 | 用例数 |
|----------|----------|--------|
| 端到端引导流程 | onboarding-e2e.test.js | 15 |
| 模式切换 | mode-switch-e2e.test.js | 18 |
| 偏好管理面板 | preference-panel-e2e.test.js | 22 |
| 资产管理面板 | asset-panel-e2e.test.js | 26 |
| 自动化规则触发 | automation-e2e.test.js | 20 |

**总计**：17个测试文件，263个测试用例，100%通过

---

### 8.11 设计文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| S0.5引导流程 | design/onboarding-flow.md | 引导流程交互规范 |
| 偏好面板 | design/preference-panel.md | 偏好管理面板交互规范 |
| 资产面板 | design/asset-panel.md | 资产管理面板交互规范 |
| 通用组件 | design/components.md | 通用组件设计规范 |

---

### 8.12 验收标准

#### 功能验收

- [x] S0.5引导流程完整可用（两轮对话）
- [x] 三种模式可自由切换
- [x] 5种画像可正常选择
- [x] 偏好管理面板功能完整
- [x] 资产管理支持四类资产
- [x] 批量操作功能完整
- [x] 自动化规则可正常触发
- [x] NLU拦截器不破坏原有功能
- [x] 短指令响应正确（新增19条）

#### 性能验收

- [x] 拦截器延迟 小于5ms
- [x] 引导流程动画流畅（60fps）
- [x] 资产面板虚拟滚动可用（大于50条）
- [x] localStorage读写 小于10ms

#### 用户体验验收

- [x] 专家模式与当前 SKILL 规范一致
- [x] 新手模式引导友好、无卡顿
- [x] 偏好设置实时生效
- [x] 资产管理操作直观、反馈清晰
- [x] 响应式布局正确（小于768px适配）

---

### 8.13 已知限制

| 限制 | 影响 | 计划 |
|------|------|------|
| localStorage存储容量限制（5MB） | 大量资产可能超出 | 后续支持IndexedDB |
| 用户模板上限10个 | 高级用户可能不足 | 后续支持付费扩容 |
| 自动化规则仅客户端执行 | 多端不同步 | 后续支持云端同步 |
| 无跨设备同步 | 用户换设备丢失数据 | 后续支持账号登录同步 |

---

## §8 新手引导体系 结束

---

**上一页**：[§3工作流](./section-3-workflow.md)  
**下一页**：[返回SKILL.md](../../SKILL.md)
