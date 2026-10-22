import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { Button } from "./button";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type AlertRequest = {
  kind: "alert";
  message: string;
  resolve: () => void;
};
type ConfirmRequest = {
  kind: "confirm";
  message: string;
  resolve: (value: boolean) => void;
};
type DialogRequest = AlertRequest | ConfirmRequest;

export interface AppDialogApi {
  alert(message: string): Promise<void>;
  confirm(message: string): Promise<boolean>;
}

const AppDialogContext = createContext<AppDialogApi | null>(null);

export function useAppDialog(): AppDialogApi {
  const api = useContext(AppDialogContext);
  if (!api) throw new Error("useAppDialog must be used within AppDialogProvider");
  return api;
}

export function AppDialogProvider({ children }: PropsWithChildren) {
  const [current, setCurrent] = useState<DialogRequest | null>(null);
  const queueRef = useRef<DialogRequest[]>([]);

  const dequeue = useCallback(() => {
    setCurrent(queueRef.current.shift() ?? null);
  }, []);

  const enqueue = useCallback((request: DialogRequest) => {
    setCurrent((existing) => {
      if (existing) {
        queueRef.current.push(request);
        return existing;
      }
      return request;
    });
  }, []);

  const api = useMemo<AppDialogApi>(
    () => ({
      alert: (message) =>
        new Promise((resolve) => {
          enqueue({ kind: "alert", message, resolve });
        }),
      confirm: (message) =>
        new Promise((resolve) => {
          enqueue({ kind: "confirm", message, resolve });
        }),
    }),
    [enqueue],
  );

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      {current ? <AppDialogPanel request={current} onFinished={dequeue} /> : null}
    </AppDialogContext.Provider>
  );
}

function AppDialogPanel({ request, onFinished }: { request: DialogRequest; onFinished(): void }) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const title = request.kind === "alert" ? "提示" : "请确认";

  const settle = useCallback(
    (confirmed: boolean) => {
      if (finished.current) return;
      finished.current = true;
      if (request.kind === "alert") request.resolve();
      else request.resolve(confirmed);
      onFinished();
    },
    [onFinished, request],
  );

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panelRef.current;
    const focusables = (): HTMLElement[] => {
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.tabIndex !== -1,
      );
    };
    const items = focusables();
    (request.kind === "confirm" ? items.at(-1) : items[0])?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        settle(false);
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const nodes = focusables();
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const active = document.activeElement;
      const stillInDialog =
        !active || active === document.body || (root ? root.contains(active) : false);
      if (stillInDialog && previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [request, settle]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5"
      >
        <h2 id={titleId} className="text-sm font-semibold text-neutral-900">
          {title}
        </h2>
        <p id={messageId} className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-600">
          {request.message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {request.kind === "confirm" && (
            <Button variant="secondary" onClick={() => settle(false)}>
              取消
            </Button>
          )}
          <Button
            variant={request.kind === "confirm" ? "danger" : "primary"}
            onClick={() => settle(true)}
          >
            确定
          </Button>
        </div>
      </div>
    </div>
  );
}
