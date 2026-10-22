import type { WeixinLoginStartView } from "@zimo/contracts";
import { Button, Card } from "@zimo/ui";
import { CheckCircle2, Clock3, MessageCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type LoginStatus =
  "idle" | "starting" | "waiting" | "scanned" | "verification_required" | "expired";

export function WeixinBindingPanel({ onBound }: { onBound(): Promise<void> }) {
  const [login, setLogin] = useState<WeixinLoginStartView>();
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [remaining, setRemaining] = useState(0);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string>();

  const start = useCallback(async () => {
    setStatus("starting");
    setError(undefined);
    const result = await window.zimo.communicationChannels.startWeixin(crypto.randomUUID());
    if (!result.ok) {
      setStatus("idle");
      setError(result.error.message);
      return;
    }
    setLogin(result.data);
    setRemaining(secondsUntil(result.data.expiresAt));
    setStatus("waiting");
  }, []);

  useEffect(
    () => () => {
      if (login)
        void window.zimo.communicationChannels.cancelWeixin(crypto.randomUUID(), login.sessionId);
    },
    [login],
  );
  useEffect(() => {
    if (!login || status === "expired") return;
    const timer = window.setInterval(() => {
      const seconds = secondsUntil(login.expiresAt);
      setRemaining(seconds);
      if (seconds === 0) setStatus("expired");
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [login, status]);
  useEffect(() => {
    if (!login || !["waiting", "scanned"].includes(status)) return;
    let active = true;
    let retryTimer: number | undefined;
    const poll = async () => {
      const result = await window.zimo.communicationChannels.pollWeixin(
        crypto.randomUUID(),
        login.sessionId,
      );
      if (!active) return;
      if (!result.ok) {
        setError(result.error.message);
        setStatus("expired");
        return;
      }
      if (result.data.status === "confirmed") {
        await onBound();
        return;
      }
      setStatus(result.data.status);
      if (result.data.status === "waiting" || result.data.status === "scanned") {
        retryTimer = window.setTimeout(() => void poll(), 250);
      }
    };
    void poll();
    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [login, status, onBound]);

  async function submitCode() {
    if (!login) return;
    const result = await window.zimo.communicationChannels.pollWeixin(
      crypto.randomUUID(),
      login.sessionId,
      verifyCode,
    );
    if (!result.ok) return setError(result.error.message);
    if (result.data.status === "confirmed") return onBound();
    setStatus(result.data.status);
  }

  return (
    <Card className="p-6 text-center lg:p-8">
      {!login || status === "idle" || status === "starting" ? (
        <div className="grid min-h-72 place-items-center">
          <div>
            <MessageCircle className="mx-auto text-emerald-600" size={42} />
            <p className="mt-4 text-sm text-neutral-500">二维码仅用于连接个人微信 Clawbot。</p>
            <Button className="mt-6" disabled={status === "starting"} onClick={() => void start()}>
              {status === "starting" ? "正在生成…" : "生成二维码"}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mx-auto w-fit rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <img
              src={login.qrCodeDataUrl}
              alt="个人微信绑定二维码"
              className={`size-64 ${status === "expired" ? "opacity-25" : ""}`}
            />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-neutral-500">
            <Clock3 size={15} />
            {status === "expired" ? "二维码已过期" : `有效期 ${formatSeconds(remaining)}`}
          </div>
          <p className="mt-3 text-sm font-medium text-neutral-700">{statusText(status)}</p>
          {status === "verification_required" && (
            <div className="mx-auto mt-4 flex max-w-sm gap-2">
              <input
                className="field text-center tracking-[0.3em]"
                inputMode="numeric"
                maxLength={8}
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, ""))}
              />
              <Button disabled={verifyCode.length < 4} onClick={() => void submitCode()}>
                确认
              </Button>
            </div>
          )}
          {status === "expired" && (
            <Button className="mt-5" variant="secondary" onClick={() => void start()}>
              <RefreshCw size={15} />
              重新生成
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-400">
        <CheckCircle2 size={14} />
        登录凭据只保存在本机系统安全存储
      </p>
    </Card>
  );
}

function statusText(status: LoginStatus): string {
  if (status === "scanned") return "已扫码，请在手机上确认";
  if (status === "verification_required") return "请输入手机微信显示的数字";
  if (status === "expired") return "请重新生成二维码";
  return "请使用手机微信扫码";
}

function secondsUntil(value: string): number {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1_000));
}

function formatSeconds(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
