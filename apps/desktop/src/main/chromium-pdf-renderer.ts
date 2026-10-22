import type { DocumentCreateContent } from "@zimo/domain";
import { BrowserWindow } from "electron";

export async function renderDocumentPdf(
  content: DocumentCreateContent,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (signal.aborted) throw abortError();
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: false,
    },
  });
  const abort = () => window.destroy();
  signal.addEventListener("abort", abort, { once: true });
  try {
    await window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildPrintHtml(content))}`,
    );
    if (signal.aborted) throw abortError();
    const bytes = await window.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });
    if (signal.aborted) throw abortError();
    return bytes;
  } catch (error) {
    if (signal.aborted) throw abortError();
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    if (!window.isDestroyed()) window.destroy();
  }
}

function buildPrintHtml(content: DocumentCreateContent): string {
  const paragraphs = (content.paragraphs ?? []).map((value) => `<p>${escapeHtml(value)}</p>`);
  const rows = (content.rows ?? []).map(
    (row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`,
  );
  const slides = (content.slides ?? []).map(
    (slide) =>
      `<section><h2>${escapeHtml(slide.title)}</h2>${slide.body ? `<p>${escapeHtml(slide.body)}</p>` : ""}</section>`,
  );
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>@page{size:A4;margin:18mm}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif;color:#27272a;font-size:12pt;line-height:1.65}h1{font-size:24pt;margin:0 0 18pt}h2{font-size:18pt}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td{border:1px solid #d4d4d8;padding:6pt}section{break-after:page}section:last-child{break-after:auto}</style></head><body><h1>${escapeHtml(content.title)}</h1>${paragraphs.join("")}${rows.length ? `<table>${rows.join("")}</table>` : ""}${slides.join("")}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function abortError(): DOMException {
  return new DOMException("PDF generation cancelled", "AbortError");
}
