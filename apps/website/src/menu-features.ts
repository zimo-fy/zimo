import {
  Bot,
  BookOpen,
  GitBranch,
  MessageSquareText,
  Plug,
  Radio,
  Settings,
  Sparkles,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MenuFeatureGroup = "主要入口" | "工具" | "账户";

export interface MenuFeature {
  readonly id: string;
  readonly group: MenuFeatureGroup;
  readonly menuLabel: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "已可用" | "基础能力" | "功能预览";
  readonly icon: LucideIcon;
  readonly tone: "blue" | "violet" | "amber" | "green" | "rose" | "cyan" | "orange" | "slate";
  readonly actions: readonly string[];
  readonly collaboration: readonly string[];
  readonly note?: string;
}

export const menuFeatureGroups: readonly MenuFeatureGroup[] = ["主要入口", "工具", "账户"];

export const menuFeatures: readonly MenuFeature[] = [
  {
    id: "tasks",
    group: "主要入口",
    menuLabel: "新建任务",
    eyebrow: "Conversation",
    title: "从一个问题开始，持续推进完整任务",
    summary:
      "新建任务是 Zimo 的统一工作入口。对话会流式生成并自动保存，你可以随时停止、重新生成或回到历史任务继续处理。",
    status: "已可用",
    icon: MessageSquareText,
    tone: "blue",
    actions: [
      "使用账号托管的模型进行流式对话，并以 Markdown 阅读结构化结果。",
      "第一轮回答后自动生成简短标题，任务按最近活动时间排列并支持重命名、删除。",
      "通过输入区的“+”选择 Agent、Skill、知识库、工作流和 MCP 工具，选择结果随任务保存。",
    ],
    collaboration: [
      "选择 Agent 后，模型会同时获得它的角色指令、已绑定 Skill 与知识库。",
      "直接选择知识库时，回答下方保留资料名称以及页码或章节位置，方便回看来源。",
    ],
  },
  {
    id: "agents",
    group: "主要入口",
    menuLabel: "Agent",
    eyebrow: "Agent",
    title: "为重复出现的角色配置稳定工作方式",
    summary:
      "Agent 将模型、角色指令和专业能力组合成可复用的执行主体。你既可以从人才库安装，也可以在本地创建和维护。",
    status: "已可用",
    icon: Bot,
    tone: "blue",
    actions: [
      "按分类浏览 Agent 人才库，安装后与本地 Agent 统一管理。",
      "配置名称、分类、模型和系统指令，并绑定已启用的 Skill、知识库与 MCP Server。",
      "启用、编辑、使用或删除 Agent；删除时自动清理会话和工作流中的活动引用。",
    ],
    collaboration: [
      "在新建任务中选择 Agent，适合让同一类工作保持稳定的角色、资料和输出方式。",
      "在工作流中使用 Agent 节点，可把上游知识、Skill 指令和工具结果合并后交给模型处理。",
    ],
  },
  {
    id: "skills",
    group: "主要入口",
    menuLabel: "Skill",
    eyebrow: "Skill",
    title: "把专业步骤封装成可安装、可复用的能力",
    summary:
      "Skill 用来沉淀具体方法和操作规范。页面合并展示 Zimo Skill Store 与本机已安装能力，并明确安装状态。",
    status: "已可用",
    icon: Sparkles,
    tone: "violet",
    actions: [
      "按分类浏览、搜索并安装 Store 中的 Skill，也可以导入包含 SKILL.md 的本地完整包。",
      "对已安装 Skill 执行重新安装或卸载；卸载时同步清理会话和 Agent 绑定。",
      "支持纯指令 Skill，以及经过审核、使用固定解释器和结构化参数运行的 Python/Node 脚本 Skill。",
    ],
    collaboration: [
      "Skill 可以直接绑定到一次对话，也可以挂载到 Agent，形成稳定的专业工作方法。",
      "工作流中的 Skill 节点会把已安装能力的指令交给下游 Agent，不会开放任意命令执行。",
    ],
  },
  {
    id: "knowledge",
    group: "工具",
    menuLabel: "知识库",
    eyebrow: "Knowledge",
    title: "导入自己的资料，让回答有依据可追溯",
    summary:
      "知识库在本机管理文档、解析文本并建立检索索引。回答使用资料时，会保留文档与位置引用，而不是只给出无法核对的结论。",
    status: "已可用",
    icon: BookOpen,
    tone: "green",
    actions: [
      "创建、启用和管理本地知识库，并通过拖放或文件选择导入常见办公文档。",
      "支持 PDF、DOCX、XLSX、PPTX、CSV、Markdown 等格式，按内容摘要去重并保存受管理副本。",
      "结合关键词与本地向量进行混合检索，可在详情页直接测试召回结果。",
    ],
    collaboration: [
      "普通任务可以显式选择知识库；Agent 也可以预先绑定常用资料库。",
      "工作流可通过知识检索节点控制 Top K，再把命中的上下文交给后续 Agent。",
    ],
  },
  {
    id: "workflow",
    group: "工具",
    menuLabel: "工作流",
    eyebrow: "Workflow",
    title: "把多步骤任务画出来、检查好，再受控运行",
    summary:
      "工作流使用可视化无限画布编排任务。节点和连线会在保存前校验，测试运行时逐步展示状态、耗时、跳过原因与最终输出。",
    status: "已可用",
    icon: GitBranch,
    tone: "amber",
    actions: [
      "创建、复制、启停和删除工作流，在独立编辑页拖拽节点并连接为有向无环图。",
      "当前可运行开始、知识检索、Skill、受控 Tool、Agent 与结束节点。",
      "运行前保存快照，执行中可取消；画布和测试面板同步显示运行中、成功、跳过或失败。",
    ],
    collaboration: [
      "适合把检索资料、调用工具、模型整理和最终输出串成可复用步骤。",
      "Agent、Skill、知识库与 MCP 引用都会在运行前重新校验，失效能力不会被静默执行。",
    ],
    note: "条件分支、循环、人工确认、后台调度和运行历史持久化尚未开放。",
  },
  {
    id: "channels",
    group: "工具",
    menuLabel: "通信渠道",
    eyebrow: "Channels",
    title: "管理个人微信与邮箱的基础绑定",
    summary:
      "通信渠道集中展示外部触点的连接状态。当前版本先完成个人微信扫码绑定与邮箱地址登记，为后续通知和消息接入保留清晰边界。",
    status: "基础能力",
    icon: Radio,
    tone: "rose",
    actions: [
      "个人微信支持应用内二维码、五分钟倒计时、扫码状态轮询、数字验证兜底与解绑。",
      "邮箱只登记经过校验和规范化的地址，不收集邮箱密码、授权码或 SMTP 配置。",
      "绑定与解绑记录不含秘密的审计信息，微信凭据进入系统安全存储。",
    ],
    collaboration: [
      "页面目前用于建立和管理连接身份，还不会自动把普通会话或工作流结果发送到渠道。",
      "后续接入通知时仍需补齐收件人授权、模板限制、限流、失败重试和审计策略。",
    ],
    note: "邮件收取、主动通知、入站消息和后台常驻 Gateway 尚未接线。",
  },
  {
    id: "mcp",
    group: "工具",
    menuLabel: "MCP",
    eyebrow: "MCP Registry",
    title: "把在线服务作为本轮明确授权的工具",
    summary:
      "MCP 页面用于连接官方目录或自定义服务，发现并保存工具快照。授权给对话、Agent 或工作流后，模型才能在当前边界内调用。",
    status: "已可用",
    icon: Plug,
    tone: "cyan",
    actions: [
      "搜索官方服务或添加自定义公网 HTTPS MCP Server，并查看连接状态与工具清单。",
      "支持 OAuth、Bearer、Header、API Query 与无认证等受控连接方式。",
      "工具调用具有参数校验、超时、取消、输出上限和脱敏审计，凭据不会暴露给界面。",
    ],
    collaboration: [
      "会话按工具逐项授权；Agent 和工作流保存 Server 引用，运行时使用最新的可信工具快照。",
      "模型生成的工具参数仍需通过 Schema，外部工具输出作为不可信内容进入后续推理。",
    ],
    note: "仅允许显式配置的公网 HTTPS 服务；stdio、本地进程与私网地址不开放。",
  },
  {
    id: "automation",
    group: "工具",
    menuLabel: "自动化",
    eyebrow: "Automation",
    title: "组合会话能力，按计划自动执行",
    summary:
      "自动化页面可配置模型与会话能力，按单次、间隔、每天或每周计划执行，并展示下次时间和运行状态。",
    status: "已可用",
    icon: Timer,
    tone: "orange",
    actions: [
      "创建和编辑自动化任务，选择模型、Agent 或 Workflow，并绑定 Skill、知识库和 MCP Tool。",
      "支持单次、按分钟间隔、每天与每周计划，还可以限制每天允许执行的时间范围。",
      "支持启停、立即运行，并查看下次执行时间与近期运行结果。",
    ],
    collaboration: [
      "每个任务使用一个专用会话，能力解析、安全校验与普通会话保持一致。",
      "同一任务不会重叠运行；账号切换和退出会取消当前执行，Router 不会绕过授权自动调用工具。",
    ],
    note: "仅在桌面应用运行且账号已登录时调度；系统常驻服务、失败重试与 Router 自动执行尚未开放。",
  },
  {
    id: "settings",
    group: "账户",
    menuLabel: "设置与账号",
    eyebrow: "Settings",
    title: "查看账号、模型连接与本地安全状态",
    summary: "设置入口位于左下角账号菜单，用来管理当前登录会话、模型连接信息和应用运行状态。",
    status: "已可用",
    icon: Settings,
    tone: "slate",
    actions: [
      "查看当前账号和登录状态，按需退出登录。",
      "查看托管模型配置并执行连接测试；开发环境可编辑调试连接，打包版本保持只读。",
      "查看本地数据、安全存储和构建信息，了解哪些数据留在设备上。",
    ],
    collaboration: [
      "账号会话为人才库、Skill Store 和托管模型提供统一身份，但访问令牌不会进入 Renderer。",
      "模型或账号不可用时，任务会给出真实错误状态，不会伪造回答或安装结果。",
    ],
  },
] as const;
