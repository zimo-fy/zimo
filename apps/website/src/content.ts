export interface NavigationGroup {
  readonly title: string;
  readonly links: readonly { readonly href: string; readonly label: string }[];
}

export const navigationGroups: readonly NavigationGroup[] = [
  {
    title: "平台概览",
    links: [
      { href: "#what-is-zimo", label: "Zimo 是什么" },
      { href: "#getting-started", label: "快速开始" },
      { href: "#user-overview", label: "用户端" },
      // { href: "#admin-overview", label: "企业管理端" },
    ],
  },
  {
    title: "用户端",
    links: [
      { href: "#user-start", label: "从哪里开始" },
      { href: "#tasks", label: "新建任务" },
      { href: "#agents", label: "Agent" },
      { href: "#skills", label: "Skill" },
      { href: "#knowledge", label: "知识库" },
      { href: "#workflow", label: "工作流" },
      { href: "#channels", label: "通信渠道" },
      { href: "#mcp", label: "MCP" },
      { href: "#automation", label: "自动化" },
      { href: "#settings", label: "设置与账号" },
    ],
  },
  // {
  //   title: "企业管理端",
  //   links: [
  //     { href: "#admin-org", label: "组织与权限" },
  //     { href: "#admin-ai-catalog", label: "模型、Agent 与 Skill" },
  //     { href: "#admin-ai-connect", label: "知识、MCP 与 HTTP" },
  //     { href: "#admin-monitor", label: "运行状态与审计" },
  //     { href: "#admin-tenant", label: "客户企业与用量" },
  //   ],
  // },
] as const;
