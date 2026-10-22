import type { WorkspaceGrantView, ZimoDesktopApi } from "@zimo/contracts";
import { useCallback, useState } from "react";

type WorkspaceApi = ZimoDesktopApi["workspaces"];

export function useChatWorkspaces(onError: (message: string | null) => void) {
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceGrantView[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (conversationId: string): Promise<void> => {
      try {
        const result = await requireWorkspaceApi().list(crypto.randomUUID(), conversationId);
        if (result.ok) setWorkspaces(result.data);
        else onError(result.error.message);
      } catch {
        onError(unavailableMessage());
      }
    },
    [onError],
  );

  async function select(conversationId: string): Promise<void> {
    await run(async (api) => {
      const result = await api.select(crypto.randomUUID(), conversationId);
      if (!result.ok) onError(result.error.message);
      else if (result.data) upsert(result.data);
    });
  }

  async function attachDropped(conversationId: string, file: File): Promise<boolean> {
    let handled = false;
    await run(async (api) => {
      const result = await api.attachDropped(crypto.randomUUID(), conversationId, file);
      if (result.ok) {
        upsert(result.data);
        handled = true;
      } else if (result.error.code !== "WORKSPACE_DIRECTORY_REQUIRED") {
        onError(result.error.message);
        handled = true;
      }
    });
    return handled;
  }

  async function remove(conversationId: string, workspaceId: string): Promise<void> {
    await run(async (api) => {
      const result = await api.remove(crypto.randomUUID(), conversationId, workspaceId);
      if (result.ok) setWorkspaces((current) => current.filter((item) => item.id !== workspaceId));
      else onError(result.error.message);
    });
  }

  async function changeMode(conversationId: string, mode: "ask" | "auto_approve"): Promise<void> {
    await run(async (api) => {
      const result = await api.changeMode(crypto.randomUUID(), conversationId, mode);
      if (result.ok) {
        setWorkspaces((current) =>
          current.map((item) =>
            item.conversationId === conversationId ? { ...item, mode } : item,
          ),
        );
        onError(null);
      } else onError(result.error.message);
    });
  }

  async function run(action: (api: WorkspaceApi) => Promise<void>): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await action(requireWorkspaceApi());
    } catch {
      onError(unavailableMessage());
    } finally {
      setBusy(false);
    }
  }

  function upsert(grant: WorkspaceGrantView): void {
    setWorkspaces((current) => [...current.filter((item) => item.id !== grant.id), grant]);
    onError(null);
  }

  return { workspaces, busy, refresh, select, attachDropped, remove, changeMode };
}

function requireWorkspaceApi(): WorkspaceApi {
  const api = (window.zimo as Partial<ZimoDesktopApi>).workspaces;
  if (!api) throw new Error("Workspace bridge unavailable");
  return api;
}

function unavailableMessage(): string {
  return "工作目录功能尚未加载，请完全退出并重新启动 Zimo 后重试。";
}
