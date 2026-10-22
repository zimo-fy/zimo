import type { CommunicationChannelView } from "@zimo/contracts";
import { Badge, Button, Card, Spinner, useAppDialog } from "@zimo/ui";
import { ArrowLeft, Mail, MessageCircle, Send, Unlink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmailBindingForm } from "./email-binding-form";
import { WeixinBindingPanel } from "./weixin-binding-panel";

type PageMode = "list" | "email" | "weixin";
type LoadState =
  | { status: "loading" }
  | { status: "ready"; channels: CommunicationChannelView[] }
  | { status: "error"; message: string };

export function CommunicationChannelsPage() {
  const { confirm } = useAppDialog();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [mode, setMode] = useState<PageMode>("list");
  const [notice, setNotice] = useState<string>();
  const [testing, setTesting] = useState(false);
  const reload = useCallback(async () => {
    const result = await window.zimo.communicationChannels.list(crypto.randomUUID());
    setLoad(
      result.ok
        ? { status: "ready", channels: result.data }
        : { status: "error", message: result.error.message },
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    if (mode !== "list" || load.status !== "ready") return;
    const timer = window.setInterval(() => void reload(), 3_000);
    return () => window.clearInterval(timer);
  }, [load.status, mode, reload]);

  async function unbind(channel: CommunicationChannelView) {
    if (!(await confirm(`解绑“${channel.name}”？相关渠道配置将被移除。`))) return;
    const result = await window.zimo.communicationChannels.unbind(
      crypto.randomUUID(),
      channel.kind,
    );
    setNotice(result.ok ? `${channel.name}已解绑` : result.error.message);
    if (result.ok) await reload();
  }

  async function sendWeixinTest() {
    setTesting(true);
    const result = await window.zimo.communicationChannels.sendWeixinTest(crypto.randomUUID());
    setNotice(result.ok ? "微信服务已接受测试消息" : result.error.message);
    setTesting(false);
    if (result.ok) await reload();
  }

  if (mode !== "list") {
    const weixin = mode === "weixin";
    return (
      <ChannelSubpage
        title={weixin ? "绑定个人微信 Clawbot" : "绑定邮箱"}
        onBack={() => setMode("list")}
      >
        {weixin ? (
          <WeixinBindingPanel onBound={() => finishBinding("个人微信 Clawbot 绑定成功")} />
        ) : (
          <EmailBindingForm onBound={() => finishBinding("邮箱地址添加成功")} />
        )}
      </ChannelSubpage>
    );
  }

  async function finishBinding(message: string) {
    setNotice(message);
    await reload();
    setMode("list");
  }

  return (
    <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
      <header>
        <Badge>通知连接</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">通信渠道</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          绑定接收执行结果的渠道。后续工作流和重要任务将通过统一通知能力调用，不会读取你的聊天记录。
        </p>
      </header>
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      {load.status === "loading" && (
        <div className="grid min-h-72 place-items-center">
          <Spinner />
        </div>
      )}
      {load.status === "error" && (
        <Card className="mt-7 p-8 text-center text-sm text-red-600">
          <p>{load.message}</p>
          <Button className="mt-4" variant="secondary" onClick={() => void reload()}>
            重试
          </Button>
        </Card>
      )}
      {load.status === "ready" && (
        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          {load.channels.map((channel) => (
            <ChannelCard
              key={channel.kind}
              channel={channel}
              onBind={() => setMode(channel.kind)}
              onUnbind={() => void unbind(channel)}
              onSendTest={() => void sendWeixinTest()}
              testing={testing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  onBind,
  onUnbind,
  onSendTest,
  testing,
}: {
  channel: CommunicationChannelView;
  onBind(): void;
  onUnbind(): void;
  onSendTest(): void;
  testing: boolean;
}) {
  const Icon = channel.kind === "weixin" ? MessageCircle : Mail;
  const accent =
    channel.kind === "weixin" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600";
  return (
    <Card className="flex min-h-64 flex-col p-6">
      <div className="flex items-start gap-4">
        <span className={`grid size-12 place-items-center rounded-2xl ${accent}`}>
          <Icon size={23} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{channel.name}</h2>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-medium ${channel.status === "bound" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
            >
              {channel.status === "bound" ? "已绑定" : "未绑定"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-500">{channel.description}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {channel.capabilities.map((value) => (
          <Badge key={value}>{value}</Badge>
        ))}
      </div>
      <div className="mt-auto border-t border-neutral-100 pt-4">
        {channel.status === "bound" ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-700">
                {channel.accountLabel}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {channel.kind === "weixin" ? "凭据已由系统安全存储保护" : "仅保存邮箱地址"}
              </p>
              {channel.kind === "weixin" && channel.runtimeStatus && (
                <p className="mt-1 text-xs text-neutral-500">
                  连接状态：{runtimeStatusText(channel.runtimeStatus)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {channel.kind === "weixin" && (
                <Button
                  variant="secondary"
                  disabled={testing || !channel.canSendTestMessage}
                  onClick={onSendTest}
                >
                  <Send size={15} />
                  {testing ? "发送中…" : "发送测试消息"}
                </Button>
              )}
              <Button variant="secondary" onClick={onUnbind}>
                <Unlink size={15} />
                解绑
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={onBind}>{channel.kind === "weixin" ? "扫码绑定" : "添加邮箱"}</Button>
        )}
      </div>
    </Card>
  );
}

function runtimeStatusText(status: NonNullable<CommunicationChannelView["runtimeStatus"]>): string {
  const labels = {
    stopped: "已停止",
    starting: "正在连接",
    listening: "正在接收指令",
    awaiting_activation: "等待微信先发一条消息",
    replying: "正在回复",
    degraded: "连接异常，正在重试",
    reauthentication_required: "登录已失效，请重新绑定",
  } satisfies Record<NonNullable<CommunicationChannelView["runtimeStatus"]>, string>;
  return labels[status];
}

function ChannelSubpage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack(): void;
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-5 -ml-2" onClick={onBack}>
          <ArrowLeft size={17} />
          返回通信渠道
        </Button>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
