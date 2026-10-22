import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import {
  AppError,
  isDocumentEditableFormat,
  type DocumentArtifact,
  type DocumentCreateContent,
  type DocumentFormat,
  type DocumentPatchOperation,
} from "@zimo/domain";

import { extractDocumentText } from "./document-content-reader";

export type PdfDocumentRenderer = (
  content: DocumentCreateContent,
  signal: AbortSignal,
) => Promise<Uint8Array>;

export async function createDocumentBytes(
  format: DocumentFormat,
  content: DocumentCreateContent,
  signal: AbortSignal,
  pdfRenderer?: PdfDocumentRenderer,
): Promise<Uint8Array> {
  checkSignal(signal);
  if (format === "docx") return createDocx(content);
  if (format === "xlsx") return createXlsx(content);
  if (format === "pptx") return createPptx(content);
  if (format === "pdf") return pdfRenderer ? pdfRenderer(content, signal) : createPdf(content);
  throw unsupported("当前文件格式不支持创建。");
}

export async function patchDocumentBytes(
  bytes: Uint8Array,
  artifact: DocumentArtifact,
  operation: DocumentPatchOperation,
  signal: AbortSignal,
): Promise<Uint8Array> {
  checkSignal(signal);
  if (artifact.format === "xlsx" && operation.type === "set_cells") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as never);
    const sheet = workbook.getWorksheet(operation.sheetName);
    if (!sheet) throw unsupported("找不到指定工作表。");
    const start = sheet.getCell(operation.startCell);
    operation.rows.forEach((row, rowOffset) =>
      row.forEach((value, columnOffset) => {
        sheet.getCell(start.row + rowOffset, start.col + columnOffset).value =
          typeof value === "string" && value.startsWith("=") ? { formula: value.slice(1) } : value;
      }),
    );
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }
  if (artifact.format === "pdf" && operation.type === "watermark") {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const text = toPdfText(operation.text);
    for (const page of pdf.getPages()) {
      page.drawText(text, {
        x: 36,
        y: 24,
        size: 10,
        font,
        color: rgb(0.45, 0.45, 0.45),
        opacity: 0.6,
      });
    }
    return pdf.save();
  }
  if (artifact.format === "pdf" && operation.type === "reorder_pages") {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const output = await PDFDocument.create();
    const indexes = operation.pageNumbers.map((page) => page - 1);
    if (
      indexes.length === 0 ||
      indexes.some(
        (index) => !Number.isInteger(index) || index < 0 || index >= source.getPageCount(),
      )
    ) {
      throw unsupported("PDF 页码范围无效。");
    }
    const pages = await output.copyPages(source, indexes);
    pages.forEach((page) => output.addPage(page));
    return output.save();
  }
  if (artifact.format === "pdf" && operation.type === "add_page_numbers") {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.getPages().forEach((page, index) => {
      page.drawText(String(index + 1), {
        x: page.getWidth() / 2,
        y: 20,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    });
    return pdf.save();
  }
  if (artifact.format === "pdf" && operation.type === "fill_form") {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const form = pdf.getForm();
    for (const [name, value] of Object.entries(operation.fields)) {
      form.getTextField(name).setText(toPdfText(value));
    }
    return pdf.save();
  }
  if (artifact.format === "pdf" && operation.type === "overlay_text") {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const page = pdf.getPage(operation.pageNumber - 1);
    if (!page) throw unsupported("PDF 页码范围无效。");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText(toPdfText(operation.text), {
      x: operation.x,
      y: operation.y,
      size: 11,
      font,
      color: rgb(0.12, 0.12, 0.12),
    });
    return pdf.save();
  }
  if (
    (artifact.format === "docx" || artifact.format === "pptx") &&
    (operation.type === "replace_text" || operation.type === "append_text")
  ) {
    const text = await extractDocumentText(bytes, artifact, signal);
    const next =
      operation.type === "replace_text"
        ? text.split(operation.search).join(operation.replacement)
        : `${text}\n\n${operation.text}`;
    return artifact.format === "docx"
      ? createDocxText(next)
      : createPptx({
          title: artifact.displayName.replace(/\.[^.]+$/i, ""),
          slides: next
            .split(/\n{2,}/)
            .filter(Boolean)
            .slice(0, 100)
            .map((body, index) => ({
              title:
                index === 0 ? artifact.displayName.replace(/\.[^.]+$/i, "") : `第 ${index + 1} 页`,
              body,
            })),
        });
  }
  throw unsupported("当前文件格式不支持这种修改操作。会保留原版本不变。");
}

export async function patchDocumentOperationsBytes(
  bytes: Uint8Array,
  artifact: DocumentArtifact,
  operations: readonly DocumentPatchOperation[],
  signal: AbortSignal,
): Promise<Uint8Array> {
  const textOperations = operations.every(
    (operation) => operation.type === "replace_text" || operation.type === "append_text",
  );
  if ((artifact.format === "docx" || artifact.format === "pptx") && textOperations) {
    const source = await extractDocumentText(bytes, artifact, signal);
    const next = operations.reduce((text, operation) => {
      if (operation.type === "replace_text") {
        return text.split(operation.search).join(operation.replacement);
      }
      return operation.type === "append_text" ? `${text}\n\n${operation.text}` : text;
    }, source);
    if (artifact.format === "docx") return createDocxText(next);
    const title = artifact.displayName.replace(/\.[^.]+$/i, "");
    return createPptx({
      title,
      slides: next
        .split(/\n{2,}/)
        .filter(Boolean)
        .slice(0, 100)
        .map((body, index) => ({ title: index === 0 ? title : `第 ${index + 1} 页`, body })),
    });
  }
  let current = bytes;
  for (const operation of operations) {
    current = await patchDocumentBytes(current, artifact, operation, signal);
  }
  return current;
}

export async function convertDocumentBytes(
  bytes: Uint8Array,
  artifact: DocumentArtifact,
  targetFormat: DocumentFormat,
  signal: AbortSignal,
  pdfRenderer?: PdfDocumentRenderer,
): Promise<Uint8Array> {
  if (targetFormat === artifact.format) return bytes.slice();
  if (!isDocumentEditableFormat(targetFormat)) {
    throw unsupported("只能转换到 DOCX、XLSX、PPTX 或 PDF。");
  }
  const text = await extractDocumentText(bytes, artifact, signal);
  const title = artifact.displayName.replace(/\.[^.]+$/, "");
  if (targetFormat === "xlsx") {
    return createXlsx({
      title,
      rows: text
        .split("\n")
        .filter(Boolean)
        .map((line) => [line]),
    });
  }
  if (targetFormat === "pptx") {
    const paragraphs = text
      .split(/\n{2,}/)
      .filter(Boolean)
      .slice(0, 100);
    return createPptx({
      title,
      slides: paragraphs.map((body, index) => ({
        title: index === 0 ? title : `第 ${index + 1} 页`,
        body,
      })),
    });
  }
  return createDocumentBytes(targetFormat, { title, paragraphs: [text] }, signal, pdfRenderer);
}

async function createDocx(content: DocumentCreateContent): Promise<Uint8Array> {
  const children = [
    new Paragraph({ text: content.title, heading: HeadingLevel.TITLE }),
    ...(content.paragraphs ?? []).flatMap((value) =>
      value.split(/\n/).map((line) => new Paragraph({ children: [new TextRun(line)] })),
    ),
  ];
  return new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children }] })));
}

async function createDocxText(text: string): Promise<Uint8Array> {
  const children = text.split(/\n/).map((line) => new Paragraph({ children: [new TextRun(line)] }));
  return new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children }] })));
}

async function createXlsx(content: DocumentCreateContent): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zimo";
  const sheet = workbook.addWorksheet(content.title.slice(0, 31) || "Sheet1");
  for (const row of content.rows ?? content.paragraphs?.map((value) => [value]) ?? []) {
    sheet.addRow([...row]);
  }
  if (sheet.rowCount > 0) sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    const values = column.values ?? [];
    column.width = Math.min(
      60,
      Math.max(12, ...values.map((value) => String(value ?? "").length + 2)),
    );
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

async function createPptx(content: DocumentCreateContent): Promise<Uint8Array> {
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "Zimo";
  const slides = content.slides?.length
    ? content.slides
    : [{ title: content.title, body: content.paragraphs?.join("\n\n") ?? "" }];
  for (const item of slides.slice(0, 100)) {
    const slide = presentation.addSlide();
    slide.background = { color: "F7F7F8" };
    slide.addText(item.title, {
      x: 0.7,
      y: 0.6,
      w: 11.9,
      h: 0.7,
      fontSize: 26,
      bold: true,
      color: "27272A",
    });
    if (item.body) {
      slide.addText(item.body, {
        x: 0.8,
        y: 1.55,
        w: 11.7,
        h: 5.2,
        fontSize: 16,
        color: "52525B",
        breakLine: false,
        margin: 0.08,
      });
    }
  }
  return new Uint8Array((await presentation.write({ outputType: "arraybuffer" })) as ArrayBuffer);
}

async function createPdf(content: DocumentCreateContent): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const lines = [content.title, ...(content.paragraphs ?? [])].flatMap((value) =>
    toPdfText(value).split("\n"),
  );
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  for (const line of lines.flatMap(wrapPdfLine)) {
    if (y < 50) {
      page = pdf.addPage([595.28, 841.89]);
      y = 790;
    }
    page.drawText(line, { x: 48, y, size: 11, font, color: rgb(0.12, 0.12, 0.12) });
    y -= 18;
  }
  return pdf.save();
}

function wrapPdfLine(value: string): string[] {
  return value.match(/.{1,82}/g) ?? [""];
}

function toPdfText(value: string): string {
  if ([...value].some((character) => !isStandardPdfCharacter(character))) {
    throw unsupported("当前内置 PDF 字体暂不支持中文创建或水印，请先创建 DOCX，或使用英文内容。");
  }
  return value;
}

function isStandardPdfCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return (
    codePoint === 9 ||
    codePoint === 10 ||
    codePoint === 13 ||
    (codePoint >= 32 && codePoint <= 126) ||
    (codePoint >= 160 && codePoint <= 255)
  );
}

function checkSignal(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Document operation cancelled", "AbortError");
}

function unsupported(message: string): AppError {
  return new AppError({
    code: "DOCUMENT_OPERATION_UNSUPPORTED",
    category: "user",
    userMessage: message,
  });
}
