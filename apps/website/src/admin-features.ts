export type AdminFeatureGroup = "组织与权限" | "AI 资源" | "系统监控" | "客户与用量";

export interface AdminFeature {
  readonly id: string;
  readonly group: AdminFeatureGroup;
  readonly title: string;
  readonly summary: string;
  readonly actions: readonly string[];
}

export const adminFeatureGroups: readonly AdminFeatureGroup[] = [
  "组织与权限",
  "AI 资源",
  "系统监控",
  "客户与用量",
];

export const adminFeatures: readonly AdminFeature[] = [
  {
    id: "admin-org",
    group: "组织与权限",
    title: "组织、用户与角色",
    summary:
      "按部门、岗位和角色分配后台入口。谁能登录管理端、能看到哪些菜单，由这里统一配置，而不是写在桌面应用里。",
    actions: [
      "维护用户、角色、菜单、部门、岗位和字典。",
      "给角色分配菜单权限，给用户分配角色。",
      "发布通知公告，管理个人中心资料。",
    ],
  },
  {
    id: "admin-ai-catalog",
    group: "AI 资源",
    title: "模型、Agent 与 Skill",
    summary:
      "企业把可下发的模型、Agent 和 Skill 作为共享资源管理。桌面用户端登录后，从这里提供的目录安装或绑定能力。",
    actions: [
      "配置对话模型连接，供登录账号托管使用。",
      "维护 Agent 目录、详情、以及与 Skill 的关联。",
      "上架、编辑 Skill，并对提交的技能包做审核。",
    ],
  },
  {
    id: "admin-ai-connect",
    group: "AI 资源",
    title: "知识、MCP 与 HTTP 连接",
    summary: "把企业知识文档和外部系统接进受控目录，再授权给用户端会话、Agent 或工作流使用。",
    actions: [
      "管理企业知识文档，供桌面知识库浏览或检索。",
      "登记 MCP 连接（公网 HTTPS）和 HTTP 工具连接。",
      "连接变更后，用户端使用最新已授权快照，而不是各自保存一套密钥。",
    ],
  },
  {
    id: "admin-monitor",
    group: "系统监控",
    title: "运行状态与审计",
    summary:
      "管理员查看后台自身是否健康，以及谁在何时做了配置变更。这与桌面端的动作审批、本地审计互补。",
    actions: [
      "查看在线用户、操作日志和登录日志。",
      "管理后台定时任务、服务监控和缓存。",
      "需要时使用代码生成与接口文档辅助扩展管理模块。",
    ],
  },
  {
    id: "admin-tenant",
    group: "客户与用量",
    title: "客户企业、权限与用量",
    summary:
      "按客户企业隔离可见资源和权限，并查看员工 Token 使用记录，避免桌面端各自统计、无法汇总。",
    actions: [
      "维护客户企业及其权限配置。",
      "查看员工 Token 使用记录。",
      "用量只作治理参考，不在用户端伪造套餐或计费状态。",
    ],
  },
];
