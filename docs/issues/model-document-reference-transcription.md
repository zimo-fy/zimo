# 模型跨轮抄写文档 UUID 导致附件误报不存在

## 现象

用户上传附件并发送后，模型先成功检查文档，随后读取正文时报“文件不存在或不属于当前会话”。重启应用、重新上传仍可复现。

## 诊断证据

开发态 `llm-payloads.jsonl` 显示同一运行中：

1. 附件已导入、绑定到当前消息，并进入模型上下文；
2. 第一轮 `zimo.document.inspect` 使用数据库中的完整 artifact UUID，执行成功；
3. Tool 结果返回相同 UUID 和 revision UUID；
4. 第二轮 `zimo.document.read` 中，模型把 artifact UUID 的一个字符改写后再次调用；
5. Application 对精确 ID 和会话归属的校验按设计拒绝该调用。

因此故障不在文件持久化、重启恢复或会话绑定，而在于协议要求模型跨轮复制长随机标识符。普通语言模型不会保证逐字符无损复写 opaque UUID。

## 修复

- 模型侧文档协议改用当前会话内的稳定短引用：`doc_1`、`doc_2`；
- 内部 artifact UUID、revision UUID 不再出现在文档上下文、Tool Schema 或 Tool 结果中；
- 短引用仅映射当前会话中已经绑定消息的文档，未发送草稿和其他会话资产不进入映射；
- 映射沿用仓储 `created_at, id` 顺序，应用重启后保持稳定；
- patch 执行时由 Application 读取当前内部 revision ID，再交给原有乐观并发控制，不降低冲突保护；
- 创建和转换产生的新文档也只把新短引用及安全元数据返回模型。

## 安全边界

修复没有模糊匹配、纠正或猜测模型提供的 UUID，也没有移除会话归属校验。无效、越界或旧式 UUID 参数统一失败，避免借助相似 ID 访问其他文件。

## 回归范围

- 文档上下文不包含 artifact/revision UUID；
- Tool Schema 只接受格式受限的 `doc_n`；
- 同一短引用可连续用于 inspect/read；
- 未发送草稿不占用引用且不可解析；
- patch 使用内部当前 revision，而非模型提供的 revision；
- SQLite 稳定排序和重启后的附件恢复继续由集成/E2E 覆盖。
