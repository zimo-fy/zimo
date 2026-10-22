# 停止生成后流式用量未计入

## 现象与影响

用户中途停止后，助手页脚「共消耗」只显示 Router 分类用量。提供商后台仍记录了已发出的流式主回复（例如非流 462+537=999，流式 4,658+409=5,067，页脚只显示 999）。

## 证据与根因

OpenAI-compatible SSE 的 usage 通常只在流正常结束的最后一块到达；`streamUsage:false` 不向端点要求逐 chunk usage。停止原先把同一个 AbortSignal 传给模型 HTTP，连接在最后一块之前被掐掉，客户端拿不到 `usage_metadata`。分类请求已改为超时不 abort，所以页脚只补上了非流分类。

## 修复与验证

- 运行取消立刻停止文本增量并发送 `run.cancelled`；当前模型流使用独立信号，最多再读 15s。
- 读到 usage / `[DONE]` 后用 `mergeMessageUsage` 合入同一条助手消息，并发送带 `messageId` 的 `usage.updated`。
- 仍不估算、不打开 `streamUsage`。Tool 轮取消后不再执行后续工具，但会保留本轮已到的 usage。
- 单测覆盖：独立流信号在取消后延迟 abort；Tool Loop 取消后仍收获 usage；会话在 usage 块到达前停止仍能合并 5,067。

## 剩余边界

Drain 窗口内提供商仍不返回 usage 时页脚不会出现该次流式消耗。后台计费若含缓存折扣，仍可能和 input+output 之和不同。
