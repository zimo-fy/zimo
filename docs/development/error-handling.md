# 错误处理

## AppError

```ts
type ErrorCategory =
  "user" | "configuration" | "network" | "model" | "storage" | "security" | "internal";

class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly safeDetails?: Readonly<Record<string, string | number | boolean>>;
  override readonly cause?: unknown;
}
```

`code` 是稳定的机器码，例如 `MODEL_AUTH_FAILED`；`userMessage` 是可本地化的消息 key/安全文案；内部 `message/cause/stack` 只留在 Main 且经日志策略处理。

## 分类与 UX

| 分类          | 示例                             | UI 行为                      |
| ------------- | -------------------------------- | ---------------------------- |
| user          | 空输入、名称重复                 | 就地提示，聚焦字段，不重试   |
| configuration | 无默认模型、密钥库不可用         | 引导设置，保留草稿           |
| network       | 超时、DNS、断线                  | 保留内容，提供重试           |
| model         | 鉴权、限流、上下文过长、非法响应 | 友好映射；可重试项显示重试   |
| storage       | DB 锁、migration、磁盘写失败     | 停止相关写入，必要时恢复页   |
| security      | 非法 sender/URL/payload          | 默认拒绝，通用提示，安全日志 |
| internal      | 不变量或未知异常                 | 通用错误与 trace reference   |

Renderer 不根据厂商原始字符串猜测类别；Adapter 映射 HTTP 状态、SDK error 和解析错误。

## 边界处理

- Domain：只抛不变量错误或返回明确 Result；不负责用户文案/日志；
- Adapter：捕获第三方错误，保留 cause，映射 AppError；
- Application：决定恢复、补偿、重试、降级或传播，且每个失败只记录一次主要 error；
- IPC：把 AppError 序列化为安全 DTO，未知错误变 `INTERNAL_UNEXPECTED`；
- Renderer：Error Boundary 处理渲染崩溃；异步错误进入 feature error state。

## Router 特例

Router 的 timeout、model、schema、低置信度和非法 target 不向聊天传播错误。Application 生成 `intent=chat`、`confidence` 保留或归零、`shouldExecute=false` 的 route，记录 fallback reason，然后继续模型调用。只有更高层的取消才停止两者。

## 流式失败

1. 用户消息和 assistant 占位先原子写入；
2. 每批 delta 先更新内存并节流写库；
3. provider 失败时 flush 已有文本，将 message 改为 failed；
4. 发送安全 `run.failed`，UI 保留部分回答并提供“重新生成”；
5. retry 创建新 message，通过 `replacesMessageId` 关联，不覆盖原失败记录。

取消不是错误：message 状态为 cancelled，发送 `run.cancelled`，日志 outcome 为 cancelled。

## 重试

只重试幂等或带幂等键的操作。V0.1 不在 Application 内自动重试模型生成，避免双重计费/重复回答；UI 由用户触发重新生成。连接测试可对明确瞬态网络错误最多重试一次并使用短抖动退避。鉴权、Schema、不变量和安全错误不重试。

## 启动故障

- migration/数据库完整性失败：不打开正常主界面，进入只读恢复页并给出安全错误码；
- SecretStore 不可用：允许应用启动和无密钥原型功能，但禁止保存 Key；
- 日志文件不可写：降级安全 console；
- 远程 session 过期、Token 缺失、校验拒绝或云端用户不一致：清除 session 与对应 Token 并回登录页，不删除其他数据；暂时网络错误保留本地记录并返回可重试错误。

## 错误码治理

错误码集中定义，删除/改义视为破坏性变更。每码需有 category、默认用户文案、retryable 和测试。禁止把路径、provider body、API Key hint 之外的凭据信息或堆栈放入 safeDetails。
