import {
  documentImageDisplayUrl,
  type DocumentArtifactView,
  type DocumentDigestView,
} from "@zimo/contracts";
import { Button, cn } from "@zimo/ui";
import { Download, File, FileSpreadsheet, FileText, Image, Presentation, X } from "lucide-react";

export function DraftAttachmentStrip({
  artifacts,
  disabled,
  busy,
  onRemove,
  onPreview,
}: {
  artifacts: readonly DocumentArtifactView[];
  disabled: boolean;
  busy: boolean;
  onRemove(id: string): void;
  onPreview(id: string, revisionId: string): void;
}) {
  if (artifacts.length === 0 && !busy) return null;
  return (
    <div className="border-t border-neutral-100 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5" aria-label="待发送文件">
        {busy && (
          <span className="px-1 text-[11px] text-neutral-400" role="status">
            正在添加文件…
          </span>
        )}
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="flex min-w-0 max-w-52 items-center gap-1.5 rounded-lg bg-neutral-100/80 px-2 py-1.5 text-neutral-500"
          >
            {isImageArtifact(artifact) ? (
              <img
                src={documentImageDisplayUrl({
                  conversationId: artifact.conversationId,
                  artifactId: artifact.id,
                  revisionId: artifact.revisionId,
                })}
                alt=""
                className="size-8 shrink-0 rounded object-cover"
              />
            ) : (
              <DocumentIcon format={artifact.format} />
            )}
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer truncate text-left text-[11px] hover:text-neutral-700 hover:underline"
              title={`预览 ${artifact.displayName}`}
              onClick={() => onPreview(artifact.id, artifact.revisionId)}
            >
              {artifact.displayName}
            </button>
            <span className="shrink-0 text-[9px] text-neutral-400">
              {sizeLabel(artifact.sizeBytes)}
            </span>
            <button
              type="button"
              aria-label={`移除 ${artifact.displayName}`}
              className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled}
              onClick={() => onRemove(artifact.id)}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageAttachmentCards({
  artifacts,
  dark,
  onExport,
  onPreview,
}: {
  artifacts: readonly DocumentArtifactView[];
  dark: boolean;
  onExport(id: string, revisionId: string): void;
  onPreview(id: string, revisionId: string): void;
}) {
  if (artifacts.length === 0) return null;
  const images = artifacts.filter(isImageArtifact);
  const files = artifacts.filter((artifact) => !isImageArtifact(artifact));
  return (
    <div className="mt-2 grid gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="图片附件">
          {images.map((artifact) => (
            <div key={artifact.id} className="relative max-w-full">
              <button
                type="button"
                className="block max-w-full cursor-pointer overflow-hidden rounded-xl"
                aria-label={`预览 ${artifact.displayName}`}
                onClick={() => onPreview(artifact.id, artifact.revisionId)}
              >
                <img
                  src={documentImageDisplayUrl({
                    conversationId: artifact.conversationId,
                    artifactId: artifact.id,
                    revisionId: artifact.revisionId,
                  })}
                  alt={artifact.displayName}
                  className="max-h-64 max-w-full object-contain"
                />
              </button>
              <Button
                variant="ghost"
                className={cn(
                  "absolute right-1 top-1 size-7 min-h-7 cursor-pointer rounded-lg px-0",
                  dark ? "bg-black/40 text-white hover:bg-black/55" : "bg-white/80 hover:bg-white",
                )}
                aria-label={`导出 ${artifact.displayName}`}
                title="导出文件"
                onClick={() => onExport(artifact.id, artifact.revisionId)}
              >
                <Download size={13} />
              </Button>
            </div>
          ))}
        </div>
      )}
      {files.map((artifact) => (
        <div
          key={artifact.id}
          className={cn(
            "flex min-w-56 items-center gap-2 rounded-xl border px-3 py-2",
            dark ? "border-white/15 bg-white/10" : "border-neutral-200 bg-neutral-50",
          )}
        >
          <DocumentIcon format={artifact.format} />
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer text-left"
            aria-label={`预览 ${artifact.displayName}`}
            onClick={() => onPreview(artifact.id, artifact.revisionId)}
          >
            <p className="truncate text-xs font-medium hover:underline">{artifact.displayName}</p>
            <p className={cn("text-[10px]", dark ? "text-neutral-300" : "text-neutral-400")}>
              {artifact.format.toUpperCase()} · {sizeLabel(artifact.sizeBytes)}
            </p>
          </button>
          <Button
            variant="ghost"
            className={cn(
              "size-7 min-h-7 cursor-pointer rounded-lg px-0",
              dark && "text-white hover:bg-white/15",
            )}
            aria-label={`导出 ${artifact.displayName}`}
            title="导出文件"
            onClick={() => onExport(artifact.id, artifact.revisionId)}
          >
            <Download size={13} />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function DocumentPreviewDialog({
  preview,
  conversationId,
  onClose,
}: {
  preview: DocumentDigestView | null;
  conversationId?: string;
  onClose(): void;
}) {
  if (!preview) return null;
  const imageSrc =
    conversationId && isImageFormat(preview.format)
      ? documentImageDisplayUrl({
          conversationId,
          artifactId: preview.artifactId,
          revisionId: preview.revisionId,
        })
      : undefined;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`预览 ${preview.displayName}`}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-neutral-900">
              {preview.displayName}
            </h2>
            <p className="mt-1 text-[11px] text-neutral-400">
              {preview.format.toUpperCase()}
              {imageSrc ? "" : ` · ${preview.unitCount} 个结构单元`}
            </p>
          </div>
          <Button
            variant="ghost"
            className="size-8 min-h-8 px-0"
            aria-label="关闭文档预览"
            onClick={onClose}
          >
            <X size={15} />
          </Button>
        </header>
        {imageSrc ? (
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-neutral-50 p-4">
            <img
              src={imageSrc}
              alt={preview.displayName}
              className="max-h-[70vh] max-w-full object-contain"
            />
          </div>
        ) : (
          <>
            {preview.units.length > 0 && (
              <div className="border-b border-neutral-100 px-5 py-3 text-xs text-neutral-500">
                {preview.units.join(" · ")}
              </div>
            )}
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-sans text-xs leading-6 text-neutral-700">
              {preview.preview || "该文档没有可预览的文本内容。"}
            </pre>
            {preview.truncated && (
              <p className="border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-400">
                当前仅展示结构摘要；模型可按页、工作表或幻灯片继续读取。
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export function DocumentDropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-3xl border-2 border-dashed border-blue-400 bg-blue-50/90 backdrop-blur-sm">
      <div className="text-center text-blue-700">
        <File size={28} className="mx-auto" />
        <p className="mt-2 text-sm font-semibold">松开即可添加到当前对话</p>
        <p className="mt-1 text-xs text-blue-500">
          支持常见文档、文本与图片（含
          Office、PDF、Markdown、HTML、JSON、CSV、OpenDocument、EPUB、PNG、JPEG、WebP）；也可拖入文件夹作为受控工作目录
        </p>
      </div>
    </div>
  );
}

function isImageFormat(format: DocumentArtifactView["format"]): boolean {
  return format === "png" || format === "jpeg" || format === "webp";
}

function isImageArtifact(artifact: DocumentArtifactView): boolean {
  return isImageFormat(artifact.format);
}

function DocumentIcon({ format }: { format: DocumentArtifactView["format"] }) {
  const className = "size-4 shrink-0";
  if (format === "xlsx" || format === "ods" || format === "csv") {
    return <FileSpreadsheet className={cn(className, "text-emerald-600")} />;
  }
  if (format === "pptx" || format === "odp") {
    return <Presentation className={cn(className, "text-orange-600")} />;
  }
  if (format === "pdf") return <FileText className={cn(className, "text-red-600")} />;
  if (format === "png" || format === "jpeg" || format === "webp") {
    return <Image className={cn(className, "text-violet-600")} />;
  }
  return <FileText className={cn(className, "text-blue-600")} />;
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
