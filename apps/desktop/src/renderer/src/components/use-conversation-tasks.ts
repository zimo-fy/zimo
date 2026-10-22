import type { ConversationSummaryView } from "@zimo/contracts";
import { useCallback, useEffect, useState } from "react";

export function useConversationTasks(enabled: boolean) {
  const [tasks, setTasks] = useState<ConversationSummaryView[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string>();
  const [draftTaskId, setDraftTaskId] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const result = await window.zimo.conversations.list(crypto.randomUUID());
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(undefined);
    const visibleTasks = result.data.filter((task) => task.messageCount > 0);
    setTasks(visibleTasks);
    setDraftTaskId(result.data.find((task) => task.messageCount === 0)?.id);
    setActiveTaskId((current) => {
      if (current && visibleTasks.some((task) => task.id === current)) return current;
      return visibleTasks[0]?.id;
    });
    setRevision((value) => value + 1);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void window.zimo.conversations.list(crypto.randomUUID()).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(undefined);
      const visibleTasks = result.data.filter((task) => task.messageCount > 0);
      const existingDraft = result.data.find((task) => task.messageCount === 0);
      setTasks(visibleTasks);
      setActiveTaskId(visibleTasks[0]?.id);
      if (existingDraft) setDraftTaskId(existingDraft.id);
      else {
        void window.zimo.conversations.create(crypto.randomUUID()).then((created) => {
          if (active && created.ok) setDraftTaskId(created.data.id);
        });
      }
      setRevision((value) => value + 1);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  const createDraft = useCallback(async () => {
    if (draftTaskId) return { ok: true as const, id: draftTaskId };
    const result = await window.zimo.conversations.create(crypto.randomUUID());
    if (!result.ok) return { ok: false as const, message: result.error.message };
    setDraftTaskId(result.data.id);
    return { ok: true as const, id: result.data.id };
  }, [draftTaskId]);

  const commitDraft = useCallback((id: string) => {
    setDraftTaskId((current) => (current === id ? undefined : current));
    setActiveTaskId(id);
  }, []);

  const rename = useCallback(
    async (id: string, title: string) => {
      const result = await window.zimo.conversations.rename(crypto.randomUUID(), id, title);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await window.zimo.conversations.delete(crypto.randomUUID(), id);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      if (activeTaskId === id) setActiveTaskId(undefined);
      await refresh();
      return { ok: true as const };
    },
    [activeTaskId, refresh],
  );

  const setPinned = useCallback(
    async (id: string, pinned: boolean) => {
      const result = await window.zimo.conversations.setPinned(crypto.randomUUID(), id, pinned);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  return {
    tasks,
    activeTaskId,
    draftTaskId,
    revision,
    error,
    setActiveTaskId,
    refresh,
    createDraft,
    commitDraft,
    rename,
    setPinned,
    remove,
  };
}
