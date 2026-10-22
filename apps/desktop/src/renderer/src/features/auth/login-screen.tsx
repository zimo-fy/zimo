import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import type { AuthSessionView } from "@zimo/contracts";
import { Badge, Button } from "@zimo/ui";

import { hasUsableModel } from "../settings/model-configuration-status";
import { ModelSettings } from "../settings/model-settings";

interface LoginScreenProps {
  restoredSession?: AuthSessionView | undefined;
  onAuthenticated(session: AuthSessionView): void;
}

type OnboardingStep = "welcome" | "model";

export function LoginScreen({ restoredSession, onAuthenticated }: LoginScreenProps) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<AuthSessionView>();
  const [modelReady, setModelReady] = useState(false);

  async function refreshModelReady() {
    const result = await window.zimo.models.list(crypto.randomUUID());
    if (result.ok) setModelReady(hasUsableModel(result.data));
    else setModelReady(false);
  }

  useEffect(() => {
    if (step !== "model" || !pendingSession) return;
    let active = true;
    void window.zimo.models.list(crypto.randomUUID()).then((result) => {
      if (!active) return;
      setModelReady(result.ok && hasUsableModel(result.data));
    });
    return () => {
      active = false;
    };
  }, [step, pendingSession]);

  async function handleStart() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (restoredSession) {
        setPendingSession(restoredSession);
        setStep("model");
        return;
      }
      const result = await window.zimo.auth.startOnboarding(crypto.randomUUID());
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPendingSession(result.data);
      setStep("model");
    } catch {
      setError("暂时无法开始配置，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    if (!pendingSession || !modelReady) return;
    onAuthenticated(pendingSession);
  }

  return (
    <WelcomeLayout>
      {step === "welcome" ? (
        <div className="w-full max-w-sm">
          <div className="mb-9 lg:hidden">
            <img src="/icon.png" alt="Zimo" className="size-12 rounded-2xl" />
          </div>
          <Badge>本地开始使用</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-neutral-950">
            欢迎使用 Zimo
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            首次使用请先完成模型配置，保存后即可进入对话主页。
          </p>
          {error && (
            <p className="mt-5 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button
            className="mt-8 w-full"
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleStart()}
          >
            {isSubmitting ? "正在准备…" : "开始使用 Zimo"}
            {!isSubmitting && <ArrowRight size={16} aria-hidden="true" />}
          </Button>
          <p className="mt-6 text-center text-xs leading-5 text-neutral-400">
            模型凭据仅保存在 Main 进程的系统安全存储中。
          </p>
        </div>
      ) : (
        <div className="w-full max-w-xl">
          <div className="mb-6 lg:hidden">
            <img src="/icon.png" alt="Zimo" className="size-12 rounded-2xl" />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="mb-5"
            onClick={() => {
              setModelReady(false);
              setStep("welcome");
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            返回到上一步
          </Button>
          {/* <Badge>模型配置</Badge> */}
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-neutral-950">
            配置模型
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            填写模型标识和 API 地址，保存后点击下一步进入主页。
          </p>
          <div className="mt-8">
            <ModelSettings onConfigured={() => void refreshModelReady()} />
          </div>
          {modelReady && (
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={handleNext}>
                下一步
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}
    </WelcomeLayout>
  );
}

function WelcomeLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 p-5 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.08)] ring-1 ring-black/5 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-neutral-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.1),transparent_32%)]" />
          <div className="relative flex items-center gap-3">
            <img src="/icon.png" alt="" className="size-10 rounded-xl" />
            <span className="text-lg font-semibold tracking-tight">Zimo</span>
            <Badge className="bg-white/10 text-white">V0.1</Badge>
          </div>
          <div className="relative max-w-lg">
            <Sparkles className="mb-7 text-neutral-400" aria-hidden="true" />
            <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em]">
              让想法自然抵达行动。
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-neutral-400">
              Zimo 是你的桌面 AI Agent 工作空间。当前版本正在建立安全、可靠的本地基础。
            </p>
          </div>
          <ul className="relative grid gap-3 text-sm text-neutral-300">
            {["本地优先的数据边界", "隔离的桌面运行环境", "面向多模型与 Agent 的开放架构"].map(
              (item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="grid size-5 place-items-center rounded-full bg-white/10">
                    <Check size={12} aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="flex items-center justify-center p-7 sm:p-12">{children}</section>
      </div>
    </main>
  );
}
