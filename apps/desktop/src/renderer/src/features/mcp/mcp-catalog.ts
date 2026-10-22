import type { ConnectMcpInput } from "@zimo/contracts";

export type McpCatalogIcon =
  | "business"
  | "code"
  | "custom"
  | "design"
  | "docs"
  | "issues"
  | "knowledge"
  | "map"
  | "meeting"
  | "observability"
  | "payments"
  | "travel";

export interface McpCatalogEntry {
  input: ConnectMcpInput;
  description: string;
  credentialLabel?: string;
  credentialPlaceholder?: string;
  icon: McpCatalogIcon;
}

export const MCP_CATALOG: readonly McpCatalogEntry[] = [
  entry("qcc-company", "企查查", "https://agent.qcc.com/mcp/company/stream", "bearer", {
    description: "查询企业工商、股东、人员和经营信息。",
    credentialLabel: "API Key",
    credentialPlaceholder: "输入企查查 API Key",
    icon: "business",
  }),
  entry(
    "tencent-meeting",
    "腾讯会议",
    "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1",
    "header_token",
    {
      description: "查询和管理会议、参会人、录制、转写与智能纪要。",
      credentialLabel: "长期 Token",
      credentialPlaceholder: "输入腾讯会议 AI Skill Token",
      icon: "meeting",
    },
  ),
  entry("github", "GitHub", "https://api.githubcopilot.com/mcp/", "oauth", {
    description: "管理仓库、Issue、Pull Request、代码与 Actions。",
    icon: "code",
  }),
  entry("sentry", "Sentry", "https://mcp.sentry.dev/mcp", "oauth", {
    description: "排查 Sentry Issue、错误事件、Trace 与项目配置。",
    icon: "observability",
  }),
  entry("hugging-face", "Hugging Face", "https://huggingface.co/mcp", "bearer", {
    description: "搜索模型、数据集、论文和已配置的 Hugging Face 工具。",
    credentialLabel: "Access Token",
    credentialPlaceholder: "输入 Hugging Face Access Token",
    icon: "knowledge",
  }),
  entry("context7", "Context7", "https://mcp.context7.com/mcp", "bearer", {
    description: "获取最新、版本匹配的开源库文档和代码示例。",
    credentialLabel: "API Key",
    credentialPlaceholder: "输入 Context7 API Key",
    icon: "docs",
  }),
  entry("microsoft-learn", "Microsoft Learn", "https://learn.microsoft.com/api/mcp", "none", {
    description: "搜索微软官方技术文档、完整文章和代码示例。",
    icon: "knowledge",
  }),
  entry("tencent-docs", "腾讯文档", "https://docs.qq.com/openapi/mcp", "api_key", {
    description: "搜索、读取、创建和编辑腾讯文档、表格与智能表格。",
    credentialLabel: "个人 Token",
    credentialPlaceholder: "输入腾讯文档 MCP Token",
    icon: "docs",
  }),
  entry("amap", "高德地图", "https://mcp.amap.com/mcp", "query_token", {
    description: "查询地点、天气、地理编码并规划驾车、步行和公交路线。",
    credentialLabel: "Web 服务 Key",
    credentialPlaceholder: "输入高德开放平台 Key",
    icon: "map",
  }),
  entry("58pic", "千图 AI", "https://mcp.58pic.com/mcp", "bearer", {
    description: "搜索设计素材，并使用千图 AI 生成图片、视频等内容。",
    credentialLabel: "API Key",
    credentialPlaceholder: "输入千图 AI API Key",
    icon: "design",
  }),
  entry("edgeone-pages", "EdgeOne Pages", "https://mcp-on-edge.edgeone.site/mcp-server", "none", {
    description: "将生成的 HTML 页面部署到腾讯云 EdgeOne Pages。",
    icon: "code",
  }),
  entry("youhuo-b", "有活招工", "https://mcp-server.hopped.com.cn/b/mcp", "none", {
    description: "通过微信扫码连接有活，管理岗位、排班、考勤与结算。",
    icon: "business",
  }),
  entry("yingmi", "盈米基金", "https://stargate.yingmi.com/mcp/v2", "api_key", {
    description: "查询基金和市场数据，分析资产配置与投资组合。",
    credentialLabel: "API Key",
    credentialPlaceholder: "输入盈米 AI 开放平台 API Key",
    icon: "payments",
  }),
  entry("didi", "滴滴出行", "https://mcp.didichuxing.com/mcp-servers", "query_token", {
    description: "查询出行信息并使用滴滴提供的智能出行能力。",
    credentialLabel: "MCP Key",
    credentialPlaceholder: "输入滴滴 MCP Key",
    icon: "travel",
  }),
  entry("investoday", "今日投资", "https://data-api.investoday.net/data/mcp", "query_token", {
    description: "查询国内金融市场、公司、基金、研报与宏观数据。",
    credentialLabel: "MCP API Key",
    credentialPlaceholder: "输入今日投资 MCP API Key",
    icon: "payments",
  }),
  entry("mcdonalds", "麦当劳中国", "https://mcp.mcd.cn", "bearer", {
    description: "查询麦当劳中国餐厅、菜单、活动及会员相关服务。",
    credentialLabel: "MCP Token",
    credentialPlaceholder: "输入麦当劳中国 MCP Token",
    icon: "business",
  }),
  entry("uapi", "UAPI", "https://uapis.cn/mcp", "api_key", {
    description: "使用中文公共 API 完成搜索、翻译、网页解析与文本处理。",
    credentialLabel: "UAPI Key",
    credentialPlaceholder: "输入 UAPI Key",
    icon: "knowledge",
  }),
];

function entry(
  serverId: string,
  name: string,
  endpoint: string,
  authentication: ConnectMcpInput["authentication"],
  metadata: Omit<McpCatalogEntry, "input">,
): McpCatalogEntry {
  return {
    input: { serverId, name, endpoint, source: "catalog", authentication },
    ...metadata,
  };
}
