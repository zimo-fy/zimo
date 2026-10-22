export interface ZimoOffering {
  readonly title: string;
  readonly summary: string;
}

export const whatIsZimoLead =
  "Zimo 是面向企业使用的 Agent 平台。业务人员在 Zimo 里完成对话、资料、Skill、工作流和本机工具调用；管理员在独立后台规划组织、模型和可下发的能力目录。";

export const whatIsZimoSentence =
  "用户端负责把任务做完，企业管理端负责谁能用哪些能力。会话、文档和密钥默认留在本机。";

export const zimoOfferings: readonly ZimoOffering[] = [
  {
    title: "任务与对话",
    summary:
      "登录托管模型后流式问答、停止与重新生成、任务列表和上下文压缩。声明视觉能力的模型可对本轮图片提问。",
  },
  {
    title: "知识、文档与检索",
    summary:
      "解析常见办公文档，本机混合检索并保留引用。会话附件进入受控工作区，模型可检查、阅读、修改或转换 DOCX / XLSX / PPTX / PDF。",
  },
  {
    title: "Agent、Skill 与工作流",
    summary:
      "安装 Agent 与 Skill，把开始、知识、Skill、工具、Agent、结束节点画成可达流程，在任务中串行执行。",
  },
  {
    title: "工具、浏览器与本机调度",
    summary:
      "连接公网 HTTPS MCP，受控搜索或打开网页，用本机浏览器完成导航与点击。应用存活且已登录时，可按计划在专用会话执行。",
  },
  {
    title: "企业管理端",
    summary:
      "规划中的浏览器后台：组织权限、模型与 Agent / Skill 目录、知识与 MCP、审计和用量。",
  },
];

export const zimoScenarios: readonly string[] = [
  "企业内部资料问答、制度查询和本机知识检索。",
  "办公文档的阅读、改写、翻译、表格处理与格式转换。",
  "通过受控网页搜索、抓取或本机浏览器完成公开信息收集和表单操作。",
  "把已连接的 HTTPS MCP、Skill 或工作流接到当前任务，并在应用运行期间按计划执行。",
];
