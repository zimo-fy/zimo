export interface MenuFeatureStep {
  readonly caption: string;
  readonly src: string;
  readonly alt: string;
}

function steps(
  id: string,
  items: readonly { readonly caption: string; readonly alt: string }[],
): readonly MenuFeatureStep[] {
  return items.map((item, index) => ({
    caption: item.caption,
    alt: item.alt,
    src: `/screenshots/features/${id}-${String(index + 1).padStart(2, "0")}.png`,
  }));
}

export const menuFeatureSteps: Readonly<Record<string, readonly MenuFeatureStep[]>> = {
  tasks: steps("tasks", [
    {
      caption: "打开「新建任务」，用托管模型开始流式对话。",
      alt: "Zimo 新建任务页，主区域为输入框和能力选择",
    },
    {
      caption: "第一轮回答后会生成标题；左侧可重命名或删除历史任务。",
      alt: "侧栏任务列表与新建任务入口",
    },
    {
      caption: "点击输入区「+」，为本轮选择 Agent、Skill、知识库、工作流或 MCP。",
      alt: "新建任务输入区展开的添加对话能力菜单",
    },
  ]),
  agents: steps("agents", [
    {
      caption: "在 Agent 页浏览人才库与本地 Agent，按分类筛选。",
      alt: "Agent 列表，含人才库卡片和安装按钮",
    },
    {
      caption: "点「新建 Agent」，填写名称、分类、模型和系统指令。",
      alt: "新建 Agent 配置表单",
    },
    {
      caption: "编辑已有 Agent，绑定 Skill、知识库与 MCP 后保存。",
      alt: "编辑 Agent 时勾选知识库等绑定项",
    },
  ]),
  skills: steps("skills", [
    {
      caption: "在 Skill 页搜索并安装 Store 中的能力。",
      alt: "Skill Store 列表与安装按钮",
    },
    {
      caption: "或从包含 SKILL.md 的本地文件夹安装完整包。",
      alt: "Skill 页的从本地文件夹安装入口",
    },
    {
      caption: "已安装 Skill 可重新安装或卸载，并同步清理绑定。",
      alt: "已安装 Skill 卡片显示卸载操作",
    },
  ]),
  knowledge: steps("knowledge", [
    {
      caption: "打开知识库，创建或管理本机资料库。",
      alt: "知识库列表与新建入口",
    },
    {
      caption: "在资料库中选择文件，导入 PDF、DOCX、表格等常见格式。",
      alt: "知识库文档页的选择文件与文档列表",
    },
    {
      caption: "在详情中输入问题做检索测试，核对召回片段。",
      alt: "知识库检索问题输入框与检索结果",
    },
  ]),
  workflow: steps("workflow", [
    {
      caption: "在工作流列表中创建、复制或打开已有流程。",
      alt: "工作流卡片列表与编排入口",
    },
    {
      caption: "打开编辑器，从节点库拖入知识、Skill、Tool、Agent 等节点。",
      alt: "工作流画布与节点库",
    },
    {
      caption: "保存快照后运行或取消；画布显示运行中、成功或失败。",
      alt: "工作流详情中的节点数量与运行入口",
    },
  ]),
  channels: steps("channels", [
    {
      caption: "打开通信渠道，查看个人微信与邮箱的连接状态。",
      alt: "通信渠道页总览",
    },
    {
      caption: "个人微信支持应用内二维码扫码绑定。",
      alt: "个人微信扫码绑定面板",
    },
    {
      caption: "邮箱只登记校验后的地址，不填写密码或 SMTP。",
      alt: "添加邮箱地址表单",
    },
  ]),
  mcp: steps("mcp", [
    {
      caption: "在 MCP 页搜索官方目录或查看已连接服务。",
      alt: "MCP 服务列表与搜索框",
    },
    {
      caption: "点「新增 MCP」，填写公网 HTTPS 地址并选择认证方式。",
      alt: "新增 MCP 配置表单",
    },
    {
      caption: "打开已有服务查看工具清单；凭据以密码框保存，界面不回显。",
      alt: "MCP 服务配置页中的认证与测试连接",
    },
  ]),
  automation: steps("automation", [
    {
      caption: "打开自动化，查看计划任务与下次执行时间。",
      alt: "自动化任务列表",
    },
    {
      caption: "新建任务时选择模型、Agent 或工作流，并绑定 Skill、知识库和 MCP。",
      alt: "新建 Automation 表单",
    },
    {
      caption: "设置单次、间隔、每天或每周计划，保存后可启停或立即运行。",
      alt: "自动化计划类型与时间范围",
    },
  ]),
  settings: steps("settings", [
    {
      caption: "左下角打开账户菜单，进入设置或退出登录。",
      alt: "Zimo 账户菜单，含设置与退出登录",
    },
    {
      caption: "在设置中查看账号、本地数据目录和安全存储状态。",
      alt: "设置页的账号与本地数据信息",
    },
    {
      caption: "查看托管模型连接并可测试；打包版连接信息只读。",
      alt: "设置页中的登录模型与测试连接",
    },
  ]),
};
