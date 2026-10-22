import { useEffect, useMemo, useState } from "react";
import type { AppUpdateStateView } from "@zimo/contracts";
import { Download, RefreshCw, X } from "lucide-react";

export function AppUpdateNotice() {
  const [state, setState] = useState<AppUpdateStateView>();
  const [dismissed, setDismissed] = useState<string>();
  const [showNotes, setShowNotes] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = window.zimo.updates.onState((next) => {
      setState(next);
      setShowNotes(false);
    });
    void window.zimo.updates.getState(crypto.randomUUID()).then((result) => {
      if (active && result.ok) setState(result.data);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const stateKey = useMemo(
    () => (state ? `${state.status}:${state.availableVersion ?? "current"}` : undefined),
    [state],
  );
  if (!state || !shouldShow(state) || dismissed === stateKey) return null;

  async function install() {
    setInstalling(true);
    try {
      const result = await window.zimo.updates.install(crypto.randomUUID());
      if (result.ok) return;
      setInstalling(false);
      setState((current) =>
        current
          ? { ...current, status: "error", errorMessage: result.error.message, userInitiated: true }
          : current,
      );
    } catch {
      setInstalling(false);
      setState((current) =>
        current
          ? {
              ...current,
              status: "error",
              errorMessage: "无法启动更新安装，请稍后重试。",
              userInitiated: true,
            }
          : current,
      );
    }
  }

  async function checkAgain() {
    try {
      await window.zimo.updates.check(crypto.randomUUID());
    } catch {
      setState((current) =>
        current
          ? {
              ...current,
              status: "error",
              errorMessage: "暂时无法检查更新，请稍后重试。",
              userInitiated: true,
            }
          : current,
      );
    }
  }

  return (
    <aside className="fixed bottom-5 left-5 z-50 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-950/15">
      <button
        type="button"
        aria-label="关闭更新提示"
        className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        onClick={() => setDismissed(stateKey)}
      >
        <X size={16} />
      </button>
      <div className="flex gap-3 pr-7">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Download size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-neutral-900">{titleFor(state)}</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">{descriptionFor(state)}</p>
          {state.status === "downloading" && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-[width]"
                  style={{ width: `${state.progressPercent ?? 0}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[11px] text-neutral-400">
                {Math.round(state.progressPercent ?? 0)}%
              </p>
            </div>
          )}
          {showNotes && state.status === "ready" && (
            <div className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
              {state.releaseNotes || "本次更新未提供更新日志。"}
            </div>
          )}
          <UpdateActions
            state={state}
            installing={installing}
            showNotes={showNotes}
            onToggleNotes={() => setShowNotes((value) => !value)}
            onInstall={() => void install()}
            onCheck={() => void checkAgain()}
          />
        </div>
      </div>
    </aside>
  );
}

function UpdateActions(props: {
  state: AppUpdateStateView;
  installing: boolean;
  showNotes: boolean;
  onToggleNotes: () => void;
  onInstall: () => void;
  onCheck: () => void;
}) {
  if (props.state.status === "ready") {
    return (
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
          onClick={props.onToggleNotes}
        >
          {props.showNotes ? "收起日志" : "更新日志"}
        </button>
        <button
          type="button"
          disabled={props.installing}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          onClick={props.onInstall}
        >
          {props.installing ? "正在重启…" : "重启升级"}
        </button>
      </div>
    );
  }
  if (props.state.status === "error") {
    return (
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        onClick={props.onCheck}
      >
        <RefreshCw size={13} />
        重新检查
      </button>
    );
  }
  return null;
}

function shouldShow(state: AppUpdateStateView): boolean {
  return (
    state.status === "downloading" ||
    state.status === "ready" ||
    (state.userInitiated && !["idle"].includes(state.status))
  );
}

function titleFor(state: AppUpdateStateView): string {
  if (state.status === "ready") return "新版本就绪";
  if (state.status === "downloading") return "正在下载新版本";
  if (state.status === "checking") return "正在检查更新…";
  if (state.status === "up-to-date") return "已是最新版本";
  if (state.status === "disabled") return "开发环境不检查更新";
  return "更新检查失败";
}

function descriptionFor(state: AppUpdateStateView): string {
  if (state.status === "ready") return `Zimo ${state.availableVersion ?? "新版本"} 已下载完成。`;
  if (state.status === "downloading")
    return `正在获取 Zimo ${state.availableVersion ?? "新版本"}。`;
  if (state.status === "up-to-date") return `当前版本 ${state.currentVersion} 已是最新版本。`;
  if (state.status === "disabled") return "请在正式打包应用中验证更新流程。";
  return state.errorMessage ?? "正在连接更新服务。";
}
