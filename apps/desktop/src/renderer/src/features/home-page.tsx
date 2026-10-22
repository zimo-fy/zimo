import type { AuthSessionView } from "@zimo/contracts";
import { Badge, Button, Card } from "@zimo/ui";
import { ArrowRight, Database, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";

export function HomePage({
  session,
  onOpenChat,
}: {
  session: AuthSessionView;
  onOpenChat(): void;
}) {
  const foundations = [
    {
      icon: ShieldCheck,
      title: "安全桌面容器",
      detail: "Renderer 与本地系统能力已隔离",
      status: "已就绪",
    },
    {
      icon: LockKeyhole,
      title: "账户身份",
      detail: "登录状态会在本机安全恢复",
      status: "已就绪",
    },
    {
      icon: Database,
      title: "本地数据基础",
      detail: "SQLite 迁移与 Repository 已建立",
      status: "已就绪",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-7 py-8 lg:px-12 lg:py-10">
      <header className="flex items-start justify-between gap-6">
        <div>
          <Badge>Phase 6 · Knowledge Retrieval</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-neutral-950">
            你好，{session.displayName}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
            Agent 与 instruction Skill 已开始本地持久化；可以安全安装纯指令 Skill，Agent
            运行与绑定将在下一切片接通。
          </p>
        </div>
        <Button onClick={onOpenChat}>
          <MessageSquare size={16} aria-hidden="true" />
          新建对话
        </Button>
      </header>

      <section className="mt-10 grid gap-4 md:grid-cols-3" aria-labelledby="foundation-title">
        <h2 id="foundation-title" className="sr-only">
          基础能力状态
        </h2>
        {foundations.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <Badge className="bg-emerald-50 text-emerald-700">{item.status}</Badge>
              </div>
              <h3 className="mt-5 text-sm font-semibold text-neutral-900">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-5 text-neutral-500">{item.detail}</p>
            </Card>
          );
        })}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden p-7">
          <div className="flex items-center justify-between gap-5">
            <div>
              <Badge>本阶段</Badge>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
                低延迟意图识别
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
                规则优先、模型分类后备；任何超时或异常都会安全降级并继续普通聊天。
              </p>
            </div>
            <span className="hidden size-24 shrink-0 place-items-center rounded-full bg-neutral-50 text-neutral-300 sm:grid">
              <MessageSquare size={34} strokeWidth={1.2} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-7 flex items-center gap-2 text-xs font-medium text-neutral-400">
            进入对话开始使用
            <ArrowRight size={13} aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            当前边界
          </p>
          <ul className="mt-5 grid gap-4 text-sm text-neutral-600">
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-300" />
              仅连接用户主动配置的模型
            </li>
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-300" />
              不执行 Agent 或本地命令
            </li>
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-300" />
              未开放能力均明确标注阶段
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
