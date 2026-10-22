import { isDocumentEditableFormat, type DocumentEditableFormat } from "@zimo/domain";

export function parseDocumentFormat(value: unknown): DocumentEditableFormat {
  if (!isDocumentEditableFormat(String(value))) throw new Error("Invalid format");
  return value as DocumentEditableFormat;
}

export function parseUuid(value: unknown): string {
  const result = requireString(value);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(result)) throw new Error("Invalid ID");
  return result;
}

export function requireString(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected string");
  return value;
}

export function limitedString(value: unknown, max: number, allowEmpty = false): string {
  const result = requireString(value).trim();
  if ((!allowEmpty && !result) || result.length > max) throw new Error("Invalid string");
  return result;
}

export function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
    throw new Error("Invalid integer");
  return value;
}

export function finiteNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error("Invalid number");
  return value;
}

export function positiveIntegers(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid integers");
  return value.map((item) => integer(item, 1, 1_000_000));
}

export function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error("Invalid strings");
  const result = value.map((item) => limitedString(item, maxLength, true));
  if (result.reduce((total, item) => total + item.length, 0) > 100_000) {
    throw new Error("Text budget exceeded");
  }
  return result;
}

export function tableRows(value: unknown): (string | number | boolean)[][] {
  if (!Array.isArray(value) || value.length > 5_000) throw new Error("Invalid rows");
  let cells = 0;
  let characters = 0;
  return value.map((row) => {
    if (!Array.isArray(row) || row.length > 200) throw new Error("Invalid row");
    cells += row.length;
    if (cells > 50_000) throw new Error("Cell budget exceeded");
    return row.map((cell) => {
      if (!["string", "number", "boolean"].includes(typeof cell)) throw new Error("Invalid cell");
      if (typeof cell === "string") {
        characters += cell.length;
        if (cell.length > 10_000 || characters > 100_000)
          throw new Error("Cell text budget exceeded");
      }
      return cell as string | number | boolean;
    });
  });
}

export function slideRows(value: unknown): { title: string; body?: string }[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid slides");
  const result = value.map((item) => {
    if (!record(item)) throw new Error("Invalid slide");
    onlyKeys(item, ["title", "body"]);
    return {
      title: limitedString(item.title, 200),
      ...(item.body === undefined ? {} : { body: limitedString(item.body, 20_000, true) }),
    };
  });
  if (
    result.reduce((total, item) => total + item.title.length + (item.body?.length ?? 0), 0) >
    100_000
  ) {
    throw new Error("Slide text budget exceeded");
  }
  return result;
}

export function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function onlyKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error("Unknown argument");
}
