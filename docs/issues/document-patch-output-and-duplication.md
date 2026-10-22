# 文档修改结果未显示附件且 DOCX 标题重复

状态：已修复
日期：2026-09-15

## 症状与影响

模型对会话中的 DOCX 执行多处错别字替换后，文字回复声称已返回附件，但 assistant 消息没有结果卡片。导出的最新版本还会在正文开头重复插入多次文件标题。

## 证据

真实运行 `ccebc391-ef1d-4376-b85e-19b6911b113e` 成功执行 12 个 `zimo.document.patch` Tool Call。数据库中的同一 artifact 产生 13 个 revision，但 `message_artifact_bindings` 仍只有原用户消息的 `input` 记录，没有 assistant `output` 记录。最终文档中标题重复次数与逐项 patch 重建次数一致。

## 根因

1. `patch` 每接收一个 `operation` 就立即读取、重建并持久化一个 revision；模型把 12 处替换拆成 12 个 Tool Call，因此一次用户任务产生 12 个中间版本；
2. DOCX 文本重建既保留了解析正文中的标题，又额外使用 artifact 显示名创建标题段落，每轮都会再追加一次；
3. `patch` 没有调用输出附件绑定；旧表又对 `artifact_id` 设置唯一约束，无法同时把原 revision 绑定到用户消息、把最终 revision 绑定到 assistant 消息；
4. 预览和导出只按 artifact 当前版本读取，历史消息卡片无法固定到发送时版本。

## 修复

- `zimo.document.patch` 改为接收有界 `operations[]`，一次读取源文件、顺序应用并只持久化一个最终 revision；同一模型轮次针对同一 `documentRef` 的多个 patch 调用在执行前继续合并；
- DOCX 文本重建不再从 artifact 显示名额外生成标题，避免多次修改累积标题；
- `0024_document_message_revisions.sql` 为消息附件绑定增加 `revision_id`，移除 artifact 单次绑定限制；升级旧输入绑定时优先固定到最早的用户导入 revision；
- 对旧版本中“只有 input 绑定、current 却已被隐藏 patch 推进”的 artifact，migration 将逻辑 current 恢复到原始输入 revision；旧 revision 和托管文件仍保留到会话删除时统一清理；
- revision 写入和 assistant 输出绑定位于同一 SQLite 事务，重复绑定使用 upsert 指向本批次最终 revision；
- 附件 IPC、预览和另存为携带并校验 revision ID，历史输入和输出卡片各自读取固定版本；模型仍只看到 `doc_n`，不接收内部 UUID。

## 回归覆盖

- 多处 DOCX 替换后标题只出现一次，全部替换生效；
- 操作批次只调用一次内容 Adapter、只写一个文件并只提交一次 revision/output 事务；
- 同轮多个 patch Tool Call 合并执行，同时为每个模型 Tool Call 返回协议要求的 Tool message；
- migration 后同一 artifact 可同时列出原始 input revision 和最终 output revision；
- Renderer 输出卡片按 artifact/revision 组合执行预览与另存为。

## 剩余边界

同一文档若在模型后续轮次明确发起新的独立 patch，仍会产生新的不可变 revision；这属于可恢复版本历史。当前批量错别字修改会在一个 `operations[]` 调用中完成，只保留一个本轮最终修改版本。migration 不重写既有损坏文件，而是把这类未作为输出返回的 artifact 恢复到原始输入 revision，用户可在原任务中重新执行修改。
