import type {
  EmbeddingModelView,
  KnowledgeDocumentView,
  KnowledgeSearchHitView,
  PrototypeDetailView,
} from "@zimo/contracts";
import { Badge, Button, useAppDialog } from "@zimo/ui";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

export function KnowledgeManagement({
  detail,
  onNotice,
}: {
  detail: PrototypeDetailView;
  onNotice(message: string): void;
}) {
  const { confirm } = useAppDialog();
  const [documents, setDocuments] = useState<KnowledgeDocumentView[]>([]);
  const [model, setModel] = useState<EmbeddingModelView>();
  const [searchQuery, setSearchQuery] = useState("");
  const [hits, setHits] = useState<KnowledgeSearchHitView[]>([]);
  const [busy, setBusy] = useState<"import" | "search">();
  const [error, setError] = useState<string>();

  const reloadKnowledge = useCallback(async () => {
    const [documentsResult, modelResult] = await Promise.all([
      window.zimo.knowledge.listDocuments(crypto.randomUUID(), detail.id),
      window.zimo.knowledge.getEmbeddingModel(crypto.randomUUID()),
    ]);
    if (documentsResult.ok) setDocuments(documentsResult.data);
    else setError(documentsResult.error.message);
    if (modelResult.ok) setModel(modelResult.data);
  }, [detail.id]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      window.zimo.knowledge.listDocuments(crypto.randomUUID(), detail.id),
      window.zimo.knowledge.getEmbeddingModel(crypto.randomUUID()),
    ]).then(([documentsResult, modelResult]) => {
      if (!active) return;
      if (documentsResult.ok) setDocuments(documentsResult.data);
      else setError(documentsResult.error.message);
      if (modelResult.ok) setModel(modelResult.data);
    });
    return () => {
      active = false;
    };
  }, [detail.id]);

  async function finishImport(imported: number, duplicates: number) {
    await reloadKnowledge();
    onNotice(
      duplicates > 0
        ? `已索引 ${imported} 个文件，跳过 ${duplicates} 个重复文件`
        : `已解析并索引 ${imported} 个文件`,
    );
  }

  async function importSelected() {
    setBusy("import");
    setError(undefined);
    try {
      const result = await window.zimo.knowledge.importSelectedFiles(
        crypto.randomUUID(),
        detail.id,
      );
      if (!result.ok) setError(result.error.message);
      else if (result.data)
        await finishImport(result.data.imported.length, result.data.duplicates.length);
    } finally {
      setBusy(undefined);
    }
  }

  async function importDropped(files: readonly File[]) {
    if (files.length === 0) return;
    setBusy("import");
    setError(undefined);
    try {
      const result = await window.zimo.knowledge.importDroppedFiles(
        crypto.randomUUID(),
        detail.id,
        files,
      );
      if (!result.ok) setError(result.error.message);
      else await finishImport(result.data.imported.length, result.data.duplicates.length);
    } catch {
      setError("拖放文件无法安全读取，请改用“选择文件”。");
    } finally {
      setBusy(undefined);
    }
  }

  async function deleteDocument(document: KnowledgeDocumentView) {
    if (!(await confirm(`删除文档“${document.name}”及其索引？`))) return;
    const result = await window.zimo.knowledge.deleteDocument(
      crypto.randomUUID(),
      detail.id,
      document.id,
    );
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setHits((current) => current.filter((hit) => hit.documentId !== document.id));
    await reloadKnowledge();
    onNotice("文档、分段、索引和托管副本已删除");
  }

  async function searchKnowledge(event: FormEvent) {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    setBusy("search");
    setError(undefined);
    const result = await window.zimo.knowledge.search(
      crypto.randomUUID(),
      detail.id,
      searchQuery,
      8,
    );
    if (!result.ok) setError(result.error.message);
    else setHits(result.data);
    setBusy(undefined);
  }

  return (
    <div>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">本地 Embedding</h3>
            <p className="mt-1 text-xs text-neutral-500">
              {model?.displayName ?? "正在检查模型…"} · {model?.dimensions ?? 512} 维 ·{" "}
              {model ? embeddingStatusLabel(model.status) : "检查中"}
            </p>
          </div>
          {model?.status === "ready" && <Badge>离线可用</Badge>}
          {model?.status === "failed" && (
            <Badge className="bg-red-50 text-red-700">内置模型异常</Badge>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          INT8 模型随应用提供，无需单独下载；模型异常时仍可使用 FTS5 全文检索。
        </p>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold">文档</h3>
        <Button
          variant="secondary"
          disabled={busy === "import"}
          onClick={() => void importSelected()}
        >
          {busy === "import" ? "解析与索引中…" : "选择文件"}
        </Button>
      </div>
      <div
        className="mt-3 rounded-xl border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-500 transition-colors hover:border-neutral-500"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void importDropped(Array.from(event.dataTransfer.files));
        }}
      >
        拖放文件到这里。支持 PDF、Office、OpenDocument、TXT、Markdown、HTML、CSV、JSON 和
        EPUB，单文件最大 20 MB。
      </div>
      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <ul className="mt-3 divide-y divide-neutral-100">
        {documents.length === 0 && (
          <li className="py-5 text-center text-sm text-neutral-400">尚未导入真实文档</li>
        )}
        {documents.map((document) => (
          <li key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{document.name}</span>
              <span className="mt-0.5 block text-xs text-neutral-400">
                {formatBytes(document.sizeBytes)} · {knowledgeDocumentStatusLabel(document.status)}{" "}
                · {document.chunkCount} 个分段
              </span>
            </span>
            <Button
              variant="ghost"
              aria-label={`删除文档 ${document.name}`}
              className="shrink-0 text-red-600"
              onClick={() => void deleteDocument(document)}
            >
              <Trash2 size={15} />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-6 border-t border-neutral-100 pt-5"
        onSubmit={(event) => void searchKnowledge(event)}
      >
        <h3 className="text-sm font-semibold">检索测试</h3>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
          <input
            className="field min-w-0"
            aria-label="检索问题"
            placeholder="输入关键词或自然语言问题"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <Button
            type="submit"
            className="min-h-11 shrink-0 whitespace-nowrap px-5"
            disabled={busy === "search" || !searchQuery.trim()}
          >
            {busy === "search" ? "检索中…" : "检索"}
          </Button>
        </div>
      </form>
      {hits.length > 0 && (
        <ol className="mt-4 space-y-3">
          {hits.map((hit, index) => (
            <li key={hit.chunkId} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <Badge>#{index + 1}</Badge>
                <span>{hit.documentName}</span>
                <span>{knowledgeLocation(hit)}</span>
                <span>{matchTypeLabel(hit.matchType)}</span>
                <span>相关度 {Math.round(hit.score * 100)}%</span>
              </div>
              <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                {hit.text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function embeddingStatusLabel(status: EmbeddingModelView["status"]): string {
  return status === "ready" ? "已就绪" : "资源异常";
}
function knowledgeDocumentStatusLabel(status: KnowledgeDocumentView["status"]): string {
  if (status === "ready") return "索引就绪";
  if (status === "processing") return "处理中";
  if (status === "failed") return "处理失败";
  return "等待处理";
}
function matchTypeLabel(type: KnowledgeSearchHitView["matchType"]): string {
  return type === "hybrid" ? "混合命中" : type === "semantic" ? "语义命中" : "关键词命中";
}
function knowledgeLocation(hit: KnowledgeSearchHitView): string {
  if (hit.metadata.pageNumber) return `第 ${hit.metadata.pageNumber} 页`;
  if (hit.metadata.slideNumber) return `第 ${hit.metadata.slideNumber} 张幻灯片`;
  if (hit.metadata.sheetName) return `Sheet：${hit.metadata.sheetName}`;
  if (hit.metadata.heading) return `章节：${hit.metadata.heading}`;
  return "正文";
}
function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}
