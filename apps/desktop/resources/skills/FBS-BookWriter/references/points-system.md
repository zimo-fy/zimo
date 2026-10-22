# 积分系统（规范说明）

> 本文档包含积分系统的完整技术实现，可作为外部引用文件。

---

## 1. 功能开关机制

### 1.1 状态定义

| 状态 | 功能 | 说明 |
|------|------|------|
| **未绑定**（默认） | 全部基础功能 | 无积分扣减，无积分奖励 |
| **已绑定** | 基础功能 + 积分功能 | 自动解锁积分奖励和消耗 |

### 1.2 解锁的积分功能

| 功能 | 说明 |
|------|------|
| 章节完成积分奖励 | 每完成一章自动获得积分 |
| 积分余额实时显示 | 界面显示当前积分余额 |
| 积分不足智能提示 | 积分不足时提示获取方式 |
| 模板使用积分扣减 | 使用高级模板时检查积分 |

---

## 2. 积分绑定流程

### 2.1 绑定指令

```
用户输入：绑定积分账户 <账户名> <密码>
```

### 2.2 绑定流程

```
1. 接收账户和密码
   ↓
2. 调用 U3W-AI 验证接口
   ↓
3. 验证成功 → 保存绑定状态到 PreferenceStore
   ↓
4. 解锁积分功能 → 提示用户
```

### 2.3 绑定成功响应

```
✅ 积分账户绑定成功！

已解锁以下功能：
  • 章节完成自动获得积分
  • 模板使用积分提醒
  • 积分余额实时显示
  • 积分不足智能提示

当前积分余额：XXX
```

### 2.4 绑定失败处理

| 错误码 | 提示 | 处理 |
|--------|------|------|
| `USER_NOT_FOUND` | 账户不存在 | 请检查账户名 |
| `PASSWORD_ERROR` | 密码错误 | 请重新输入密码 |
| `ACCOUNT_DISABLED` | 账户已被禁用 | 联系管理员 |
| `NETWORK_ERROR` | 验证服务暂时不可用 | 请稍后重试 |

---

## 3. 积分数据存储

### 3.1 PreferenceStore 扩展字段

```javascript
// 在用户偏好中增加 pointsBinding 字段
{
  pointsBinding: {
    enabled: false,        // 是否已绑定
    account: null,         // 绑定的积分账户
    userId: null,          // U3W-AI 用户ID
    boundAt: null,         // 绑定时间
    autoUnlock: true       // 绑定后自动解锁积分功能
  }
}
```

---

## 4. 积分功能集成点

### 4.1 功能开关检查

```javascript
/**
 * 检查用户是否已绑定积分账户
 */
function isPointsBound(userPreference) {
  return userPreference?.pointsBinding?.enabled === true
      && !!userPreference?.pointsBinding?.account;
}

/**
 * 积分功能门控
 */
class PointsFeatureGate {
  constructor(userPreference) {
    this.bound = isPointsBound(userPreference);
    this.userId = userPreference?.pointsBinding?.userId;
  }

  isDeductEnabled() { return this.bound; }
  isRewardEnabled() { return this.bound; }
  isBalanceVisible() { return this.bound; }
  getUserIdForAPI() { return this.userId; }
}
```

### 4.2 积分奖励集成点（章节完成）

```javascript
// 在 onChapterComplete 函数末尾添加
async function onChapterComplete_points(userPreference, chapterInfo) {
  const gate = new PointsFeatureGate(userPreference);

  if (!gate.isRewardEnabled()) {
    return null; // 未绑定，不触发积分
  }

  // 绑定后，自动发放积分
  const result = await pointsBridge.tryChangePoints(
    gate.getUserIdForAPI(),
    'CHAPTER_COMPLETE',  // 章节完成积分奖励
    null
  );

  if (result.success) {
    return {
      pointsEarned: result.delta,
      balance: result.balanceAfter
    };
  }

  return null;
}
```

### 4.3 积分扣减集成点（模板使用）

```javascript
// 在模板使用逻辑前添加
async function beforeTemplateUse_points(userPreference, templateId) {
  const gate = new PointsFeatureGate(userPreference);

  if (!gate.isDeductEnabled()) {
    return { allowed: true }; // 未绑定，不检查积分
  }

  // 绑定后，检查积分余额
  const result = await pointsBridge.tryChangePoints(
    gate.getUserIdForAPI(),
    'TEMPLATE_USE',  // 模板使用积分扣减
    null
  );

  if (!result.success) {
    return {
      allowed: false,
      message: result.msg,
      code: result.code
    };
  }

  return { allowed: true, balance: result.balanceAfter };
}
```

---

## 5. 积分系统 API 对接

### 5.1 U3W-AI 积分 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/points/precheck` | POST | 积分前置校验（扣减/奖励） |
| `/points/balance/{userId}` | GET | 查询积分余额 |
| `/points/records/{userId}` | GET | 查询积分明细 |

### 5.2 PointsBridgeService 设计

```javascript
class PointsBridgeService {
  constructor(options = {}) {
    this.userId = options.userId;
    this.baseURL = process.env.U3W_API_BASE_URL;
  }

  /**
   * 积分前置校验
   * @param {string} ruleCode - 规则编码
   * @param {number|null} changeAmount - 自定义积分值
   */
  async tryChangePoints(ruleCode, changeAmount = null) {
    const response = await fetch(`${this.baseURL}/points/precheck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.userId,
        ruleCode: ruleCode,
        changeAmount: changeAmount
      })
    });

    return response.json();
  }

  /**
   * 查询积分余额
   */
  async getBalance() {
    const response = await fetch(`${this.baseURL}/points/balance/${this.userId}`);
    return response.json();
  }

  /**
   * 查询积分明细
   */
  async getRecords() {
    const response = await fetch(`${this.baseURL}/points/records/${this.userId}`);
    return response.json();
  }
}
```

---

## 6. 积分规则编码

### 6.1 预置规则

| 规则编码 | 说明 | 积分值 | 方向 |
|----------|------|--------|------|
| `DAILY_LOGIN` | 每日登录 | +10 | 奖励 |
| `CHAPTER_COMPLETE` | 完成章节 | +50 | 奖励 |
| `BOOK_COMPLETE` | 完成书籍 | +500 | 奖励 |
| `TEMPLATE_USE` | 使用模板 | -1 | 扣减 |
| `TEMPLATE_PUBLISH` | 发布模板 | +50 | 奖励 |
| `ASSET_SHARE` | 分享资产 | +30 | 奖励 |

---

## 7. 容错机制

### 7.1 降级策略

| 场景 | 行为 | 说明 |
|------|------|------|
| 积分 API 不可用 | 业务继续执行 | 降级，不阻塞用户操作 |
| 积分验证失败 | 提示错误 | 不改变任何状态 |
| 网络超时 | 重试1次 | 失败则降级 |

### 7.2 离线模式

```javascript
async function safeChangePoints(userId, ruleCode) {
  try {
    const bridge = new PointsBridgeService({ userId });
    return await bridge.tryChangePoints(ruleCode);
  } catch (error) {
    // 积分服务不可用时，不阻塞业务
    console.warn('[PointsBridge] 积分服务异常，业务继续:', error.message);
    return { success: true, offline: true };
  }
}
```

---

## 8. 错误码处理

### 8.1 错误码表

| 错误码 | 说明 | 处理建议 |
|--------|------|---------|
| `USER_EMPTY` | 用户ID为空 | 检查用户登录状态 |
| `USER_NOT_FOUND` | 用户不存在 | 检查用户ID是否正确 |
| `USER_DISABLED` | 用户不可用 | 联系管理员启用用户 |
| `RULE_EMPTY` | 规则编码为空 | 检查规则编码参数 |
| `RULE_NOT_FOUND` | 积分规则不存在 | 检查规则编码是否正确 |
| `RULE_DISABLED` | 积分规则已停用 | 联系管理员启用规则 |
| `POINTS_ZERO` | 积分变动值无效 | 检查规则配置 |
| `LIMIT_REACHED` | 已达到限频上限 | 提示用户稍后再试 |
| `MAX_AMOUNT_REACHED` | 已达到累计上限 | 提示用户已达到上限 |
| `INSUFFICIENT_BALANCE` | 积分余额不足 | 提示用户充值或获取积分 |
| `POINTS_ERROR` | 积分处理失败 | 记录日志，联系技术支持 |

---

