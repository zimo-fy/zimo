import { ArrowRight, Info } from "lucide-react";

import { AdminFeatureGuide } from "./components/admin-feature-guide";
import { GettingStartedGuide } from "./components/getting-started-guide";
import { MenuFeatureGuide } from "./components/menu-feature-guide";
import { DesktopNavigation, MobileNavigation, PageOutline } from "./components/page-navigation";
import { SiteHeader } from "./components/site-header";
import { WhatIsZimo } from "./components/what-is-zimo";

const userPages = [
  { name: "新建任务", detail: "开始一项问答或需要工具、资料、流程的工作。" },
  { name: "历史任务", detail: "继续过去的会话，支持重命名、删除和按最近活动排列。" },
  { name: "附件与模型", detail: "添加办公文档或图片，并按目录选择当前模型。" },
  { name: "Agent / Skill", detail: "安装并绑定角色指令、专业方法或受审核脚本。" },
  { name: "知识库 / 工作流 / MCP", detail: "准备资料、可见流程和本轮授权的在线工具。" },
  { name: "自动化", detail: "在应用运行且已登录时，按计划在专用会话执行。" },
  { name: "设置与账号", detail: "查看登录状态、托管模型连接和本地安全存储。" },
] as const;

const startRows = [
  { goal: "写作、总结、翻译或改一份办公文档", entry: "新建任务，需要时附加 DOCX / PDF / 表格" },
  { goal: "查询公开网页和最新资料", entry: "新建任务，由模型调用受控搜索或读取公开网页" },
  { goal: "查询本机或企业资料", entry: "先选知识库，再在任务中提问" },
  { goal: "调用已连接的 MCP 或业务系统", entry: "先在 MCP 中授权工具，再发到当前任务" },
  { goal: "重复的多步骤工作", entry: "先画工作流，再在任务中选择该流程" },
] as const;

export function App() {
  return (
    <>
      <SiteHeader />
      <MobileNavigation />
      <div className="page-layout">
        <DesktopNavigation />
        <main className="article-content">
          <WhatIsZimo />

          <section className="article-section" id="getting-started">
            <div className="section-heading">
              <p>平台概览</p>
              <h2>快速开始</h2>
              <span>
                用户端在本仓库用 pnpm 启动 Desktop；企业管理端在独立的 Zimo 仓库分别启动 FastAPI
                后端和 Vue 前端。
              </span>
            </div>
            <GettingStartedGuide />
          </section>

          <section className="article-section" id="user-overview">
            <div className="section-heading">
              <p>用户端</p>
              <h2>桌面工作区</h2>
              <span>
                业务人员不需要理解进程分层，就可以在同一窗口里发起任务、使用知识、连接工具、运行
                Skill，并查看本机定时任务。
              </span>
            </div>
            <ul className="page-compose">
              {userPages.map((item) => (
                <li key={item.name}>
                  <strong>{item.name}</strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="article-section" id="user-start">
            <div className="section-heading">
              <p>用户端</p>
              <h2>从哪里开始</h2>
              <span>只是提问时，直接在输入框描述目标。涉及特定来源时，先选对应入口。</span>
            </div>
            <table className="start-table">
              <thead>
                <tr>
                  <th>目标</th>
                  <th>推荐入口</th>
                </tr>
              </thead>
              <tbody>
                {startRows.map((row) => (
                  <tr key={row.goal}>
                    <td>{row.goal}</td>
                    <td>{row.entry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="article-section" id="menu-features">
            <div className="section-heading">
              <p>用户端</p>
              <h2>功能说明</h2>
              <span>
                以下对应 Zimo Desktop 当前菜单。状态区分已经可用、基础连接和仍在预览的能力。
              </span>
            </div>
            <MenuFeatureGuide />
          </section>

          {/* <section className="article-section" id="admin-overview">
            <div className="section-heading">
              <p>企业管理端</p>
              <h2>组织治理与能力目录</h2>
              <span>
                管理员在浏览器后台管理账号、角色、模型、Skill、知识和
                MCP，用户端登录后只消费已授权资源。交互参考 Zimo 管理后台的系统管理、监控和 AI
                管理模块。
              </span>
            </div>
          
            <AdminFeatureGuide />
          </section> */}

          <section className="quick-start" id="quick-start">
            <div>
              <p>用户端</p>
              <h2>从桌面任务开始使用</h2>
              <span>登录后新建任务，按需要绑定资料和工具。企业目录与权限由管理端另行配置。</span>
            </div>
            <a href="#user-overview">
              查看用户端
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </section>
          <footer>
            <span>Zimo · 功能说明</span>
            <span>用户端按已实现能力整理 </span>
          </footer>
        </main>
        <PageOutline />
      </div>
    </>
  );
}
