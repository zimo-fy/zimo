import type {
  DocumentArtifactView,
  DocumentDigestView,
  DocumentImportResultView,
  IpcResult,
  ZimoDesktopApi,
} from "@zimo/contracts";
import { useCallback, useState } from "react";

type ArtifactApi = ZimoDesktopApi["artifacts"];

export function useChatArtifacts(onError: (message: string | null) => void) {
  const [artifacts, setArtifacts] = useState<readonly DocumentArtifactView[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DocumentDigestView | null>(null);

  const refresh = useCallback(
    async (conversationId: string): Promise<void> => {
      try {
        const result = await requireArtifactApi().list(crypto.randomUUID(), conversationId);
        if (result.ok) setArtifacts(result.data);
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
      applyImportResult(result);
    });
  }

  async function importDropped(conversationId: string, files: readonly File[]): Promise<void> {
    if (files.length === 0) return;
    if (files.length > 10) {
      onError("每条消息最多添加 10 个文档，请分批处理。");
      return;
    }
    await run(async (api) => {
      const result = await api.importDropped(crypto.randomUUID(), conversationId, files);
      applyImportResult(result);
    });
  }

  async function remove(conversationId: string, artifactId: string): Promise<void> {
    await run(async (api) => {
      const result = await api.removeDraft(crypto.randomUUID(), conversationId, artifactId);
      if (result.ok) {
        setArtifacts((current) => current.filter((item) => item.id !== artifactId));
      } else onError(result.error.message);
    });
  }

  async function exportArtifact(
    conversationId: string,
    artifactId: string,
    revisionId: string,
  ): Promise<void> {
    await run(async (api) => {
      const result = await api.export(crypto.randomUUID(), conversationId, artifactId, revisionId);
      if (!result.ok) onError(result.error.message);
    });
  }

  async function previewArtifact(
    conversationId: string,
    artifactId: string,
    revisionId: string,
  ): Promise<void> {
    await run(async (api) => {
      const result = await api.inspect(crypto.randomUUID(), conversationId, artifactId, revisionId);
      if (result.ok) setPreview(result.data);
      else onError(result.error.message);
    });
  }

  async function run(action: (api: ArtifactApi) => Promise<void>): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await action(requireArtifactApi());
    } catch {
      onError(unavailableMessage());
    } finally {
      setBusy(false);
    }
  }

  function applyImportResult(result: IpcResult<DocumentImportResultView | null>): void {
    if (!result.ok) {
      onError(result.error.message);
      return;
    }
    if (!result.data) return;
    const data = result.data;
    setArtifacts((current) => [...current, ...data.imported]);
    onError(data.rejected.map((item) => item.message).join("；") || null);
  }

  return {
    artifacts,
    busy,
    preview,
    refresh,
    select,
    importDropped,
    remove,
    exportArtifact,
    previewArtifact,
    closePreview: () => setPreview(null),
  };
}

function requireArtifactApi(): ArtifactApi {
  const api = (window.zimo as Partial<ZimoDesktopApi>).artifacts;
  if (!api) throw new Error("Document artifact bridge unavailable");
  return api;
}

function unavailableMessage(): string {
  return "文件功能尚未加载，请完全退出并重新启动 Zimo 后重试。";
}
