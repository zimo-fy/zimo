import { mkdir, readdir, rename, stat, unlink, appendFile } from "node:fs/promises";
import { dirname, basename, join } from "node:path";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type LogCategory =
  | "app"
  | "electron"
  | "auth"
  | "conversation"
  | "model"
  | "agent"
  | "workflow"
  | "tool"
  | "mcp"
  | "plugin"
  | "connector"
  | "knowledge"
  | "automation"
  | "intent-router"
  | "storage"
  | "security"
  | "audit";

export interface LogContext {
  traceId?: string;
  conversationId?: string;
  runId?: string;
  userId?: string;
  providerId?: string;
  durationMs?: number;
  errorCode?: string;
  outcome?: "success" | "failure" | "cancelled" | "fallback";
  [key: string]: unknown;
}

export interface LogInput {
  level: LogLevel;
  category: LogCategory;
  event: string;
  message: string;
  context?: LogContext;
}

const SENSITIVE_KEY =
  /api[-_]?key|token|secret|password|authorization|cookie|credential|image_url/i;
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 30;
const MAX_STRING_LENGTH = 500;

export function redact(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet<object>());
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (typeof value === "string") return sanitizeString(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: sanitizeString(value.message) };
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1, seen));
  }

  const safe: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    safe[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactValue(child, depth + 1, seen);
  }
  return safe;
}

function sanitizeString(value: string): string {
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value) || value.includes(";base64,")) {
    return "[REDACTED_IMAGE]";
  }
  const shortened =
    value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  try {
    const url = new URL(shortened);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.protocol}//${url.host}${url.pathname}`;
    }
  } catch {
    // Ordinary text is returned below.
  }
  return shortened.replace(/[\r\n]+/g, " ");
}

export class StructuredLogger {
  private queue = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly maxBytes = 10 * 1024 * 1024,
    private readonly retainedFiles = 5,
  ) {}

  log(input: LogInput): void {
    const record = {
      timestamp: new Date().toISOString(),
      level: input.level,
      category: input.category,
      event: input.event,
      message: sanitizeString(input.message),
      ...(input.context ? { context: redact(input.context) } : {}),
    };
    this.queue = this.queue
      .then(() => this.write(`${JSON.stringify(record)}\n`))
      .catch((error: unknown) => {
        console.error(
          "Zimo logger write failed",
          error instanceof Error ? error.message : "unknown",
        );
      });
  }

  async flush(): Promise<void> {
    await this.queue;
  }

  private async write(line: string): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const current = await stat(this.filePath);
      if (current.size + Buffer.byteLength(line) > this.maxBytes) await this.rotate();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await appendFile(this.filePath, line, { encoding: "utf8", mode: 0o600 });
  }

  private async rotate(): Promise<void> {
    const directory = dirname(this.filePath);
    const fileName = basename(this.filePath);
    const files = (await readdir(directory))
      .filter((entry) => entry.startsWith(`${fileName}.`))
      .sort()
      .reverse();
    for (const file of files.slice(this.retainedFiles - 1)) await unlink(join(directory, file));
    await rename(this.filePath, `${this.filePath}.${Date.now()}`);
  }
}
