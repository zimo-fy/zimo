# ADR 0023：会话按需能力发现与运行期加载

- 状态：Accepted
- 日期：2026-09-23

## 背景

旧 Intent Router 在每条普通消息前使用额外模型请求分类 Agent、Skill 或 Workflow，默认预算 800ms，只展示置信度和建议，不执行目标。它既增加延迟和模型费用，也看不到 MCP 与知识库，无法形成“当前能力不足时再查找已安装能力”的闭环。

同时，把所有已连接 MCP Tool 和全部能力说明一次性发送给模型会扩大上下文，并降低工具选择稳定性。Zimo 的 OpenAI-compatible 模型来源也不能统一依赖供应商原生 Tool Search。

## 决策

1. 普通会话不再执行前置 LLM Router 分类，也不展示置信度、fallback 或“继续普通对话”提示；显式绑定的 Agent/Workflow 继续按现有会话能力执行。
2. 支持 Tool Calling 的普通会话始终获得应用内建 `search_capabilities`。模型仅在当前能力不足时调用；一次运行最多调用两次，每次最多返回五个候选。
3. `CapabilityDiscoveryService` 从本地 Prototype Repository、可信 Tool Registry 和 Skill Runtime 聚合 Skill、Agent、MCP Tool、知识库与 Workflow。首版使用有界词项匹配，不增加向量数据库、IPC 或 migration。
   已知 Skill 身份的编排能力可提交最多五个稳定 `packageIds`；此时本地和市场候选按 package ID 精确过滤，避免统一入口误加载自身或相邻平台能力。Skill Store 的 `zimo.market.*` 继续作为安装身份，运行期从已持久化的 `SKILL.md` frontmatter 解析受校验的编排身份；同一编排身份存在多个启用 Skill 时拒绝动态加载。
4. 用户已安装并启用的能力无需再次授权：命中的 MCP Tool、受审核 Skill Tool 与本地知识检索 Tool 自动加入当前 run 的暴露集合；instruction Skill 的有界指令随搜索结果提供给模型。该临时加载不修改会话持久绑定。
5. “无需再次授权”不绕过工具自身的安全策略。文件、命令、脚本或远程写操作继续经过参数 Schema、动作策略、必要审批、超时、取消、输出上限和审计。
6. Agent 与 Workflow 可以被搜索，但首版不在当前 Tool Loop 内递归切换执行主体；结果明确引导使用现有会话选择入口。后续 handoff/嵌套运行需单独设计状态与取消语义。
7. 本地无匹配时，取消可传播地查询现有 Skill Store 与 Agent 人才库，只返回可安装建议。模型无权自动安装 Skill、连接 MCP 或修改应用配置。
8. MCP、Skill、市场描述和搜索结果均是不可信数据，只作为有界 JSON Tool result；Application 只加载可信注册表中实际存在的 Tool ID。
9. 动态加载的 Skill 可注册只读包内资源 Tool。资源必须来自对应 skill ID 与 checksum 的安装清单，只允许有界 UTF-8 文本和规范化相对路径；不得回退到会话 Workspace 或任意文件读取。

## 结果

普通消息移除一次额外模型分类和可见 Router 噪音；模型可在同一个 run 中发现并使用本地已安装工具。代价是本地已连接 MCP 与启用知识库从“会话显式绑定”扩展为“模型按需发现后临时使用”，用户应仅安装或连接可信能力。已安装脚本仍不代表低风险，其具体执行继续遵守 ADR 0013 与 ADR 0019。

ADR 0007 保留为历史设计记录，其中普通聊天前置分类和 UI 展示由本 ADR 取代；`route.completed` 暂时作为兼容事件保留，但不再来自普通会话 LLM 分类，也不被 Renderer 展示。
