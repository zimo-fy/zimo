import type { WorkspaceAuthorizationView, ZimoDesktopApi } from "@zimo/contracts";
import { Button, Spinner } from "@zimo/ui";
import { FolderCheck, RotateCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type WorkspaceApi = ZimoDesktopApi["workspaces"];

export function AuthorizedWorkspaceList() {
  const [items, setItems] = useState<readonly WorkspaceAuthorizationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAuthorizations = useCallback(
    () => workspaceApi().listAuthorizations(crypto.randomUUID()),
    [],
  );

  const applyResult = useCallback(
    (result: Awaited<ReturnType<typeof fetchAuthorizations>>): void => {
      if (result.ok) {
        setItems(result.data);
        setError(null);
      } else setError(result.error.message);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void fetchAuthorizations().then((result) => {
      if (active) applyResult(result);
    });
    return () => {
      active = false;
    };
  }, [applyResult, fetchAuthorizations]);

  async function revoke(item: WorkspaceAuthorizationView): Promise<void> {
    if (confirmingId !== item.id) {
      setConfirmingId(item.id);
      return;
    }
    setBusyId(item.id);
    const result = await workspaceApi().revokeAuthorization(crypto.randomUUID(), item.id);
    if (result.ok) {
      setItems((current) => current.filter((value) => value.id !== item.id));
      setConfirmingId(null);
      setError(null);
    } else setError(result.error.message);
    setBusyId(null);
  }

  return (
    <section className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-medium text-neutral-800">已放行目录</h3>
          <p className="mt-1 text-[11px] text-neutral-400">
            低风险文件操作可直接执行；撤销后再次写入会重新请求审批。
          </p>
        </div>
        <Button
          variant="ghost"
          className="size-8 min-h-8 px-0"
          aria-label="刷新已放行目录"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void fetchAuthorizations().then(applyResult);
          }}
        >
          <RotateCw size={13} aria-hidden="true" />
        </Button>
      </div>
      {loading ? (
        <div className="grid min-h-20 place-items-center">
          <Spinner label="正在读取目录授权" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 rounded-lg bg-white px-3 py-3 text-center text-[11px] text-neutral-400">
          暂无已放行目录
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-lg border border-neutral-100 bg-white px-3 py-2.5"
            >
              <FolderCheck size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-neutral-700">{item.displayName}</p>
                <p
                  className="mt-0.5 truncate font-mono text-[10px] text-neutral-400"
                  title={item.location}
                >
                  {item.location}
                </p>
              </div>
              <Button
                variant={confirmingId === item.id ? "secondary" : "ghost"}
                className="h-7 min-h-7 px-2 text-[11px]"
                disabled={busyId === item.id}
                onClick={() => void revoke(item)}
              >
                <Trash2 size={12} aria-hidden="true" />
                {confirmingId === item.id ? "确认撤销" : "撤销"}
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
    </section>
  );
}

function workspaceApi(): WorkspaceApi {
  const api = (window.zimo as Partial<ZimoDesktopApi>).workspaces;
  if (!api) throw new Error("Workspace bridge unavailable");
  return api;
}
