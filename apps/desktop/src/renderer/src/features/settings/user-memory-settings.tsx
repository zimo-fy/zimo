import { useEffect, useState } from "react";
import type { SaveUserMemoryInput, UserMemoryView } from "@zimo/contracts";
import { Button, useAppDialog } from "@zimo/ui";

const kindNames: Record<UserMemoryView["kind"], string> = {
  preference: "用户偏好",
  goal: "当前目标",
  open_issue: "未解决问题",
};

export function UserMemorySettings() {
  const { confirm } = useAppDialog();
  const [memories, setMemories] = useState<readonly UserMemoryView[]>([]);
  const [kind, setKind] = useState<UserMemoryView["kind"]>("preference");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void window.zimo.userMemories
      .list(crypto.randomUUID())
      .then((result) => {
        if (!active) return;
        if (result.ok) setMemories(result.data);
        else setError(result.error.message);
      })
      .catch(() => {
        if (active) setError("记忆暂时无法加载，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(input: SaveUserMemoryInput) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.zimo.userMemories.save(crypto.randomUUID(), input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMemories((current) => [
        result.data,
        ...current.filter((item) => item.id !== result.data.id),
      ]);
      setContent("");
      setEditingId(null);
    } catch {
      setError("保存失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy || !(await confirm("确定删除这条记忆吗？删除后后续模型请求将不再使用它。"))) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.zimo.userMemories.delete(crypto.randomUUID(), id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMemories((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setContent("");
      }
    } catch {
      setError("删除失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-neutral-500">
        模型可能在对话中自动保存偏好、目标和未解决问题；你可以在这里修改或删除。启用的记忆会在后续会话请求时发送给当前模型服务。当前指令可以覆盖旧偏好；请不要保存密码或密钥。
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            ...(editingId ? { id: editingId } : {}),
            kind,
            content,
            enabled: editingId
              ? (memories.find((item) => item.id === editingId)?.enabled ?? true)
              : true,
          });
        }}
      >
        <label className="block text-sm text-neutral-700">
          类别
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as UserMemoryView["kind"])}
            className="mt-1 block w-full rounded-lg border border-neutral-200 p-2"
          >
            {Object.entries(kindNames).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-neutral-700">
          记忆内容
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={500}
            required
            rows={3}
            className="mt-1 block w-full resize-y rounded-lg border border-neutral-200 p-2"
            placeholder="例如：请始终使用简体中文回答"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !content.trim()}>
            {editingId ? "保存修改" : "添加记忆"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setContent("");
              }}
            >
              取消编辑
            </Button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="space-y-2" aria-label="已保存的记忆">
        {memories.map((memory) => (
          <li key={memory.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-neutral-500">
                {kindNames[memory.kind]} · {memory.enabled ? "已启用" : "已停用"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(memory.id);
                    setKind(memory.kind);
                    setContent(memory.content);
                  }}
                  className="text-violet-700"
                >
                  编辑
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void save({
                      id: memory.id,
                      kind: memory.kind,
                      content: memory.content,
                      enabled: !memory.enabled,
                    })
                  }
                  className="text-violet-700"
                >
                  {memory.enabled ? "停用" : "启用"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(memory.id)}
                  className="text-red-700"
                >
                  删除
                </button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-neutral-800">
              {memory.content}
            </p>
          </li>
        ))}
      </ul>
      {memories.length === 0 && !error && (
        <p className="text-xs text-neutral-500">还没有保存记忆。</p>
      )}
    </div>
  );
}
