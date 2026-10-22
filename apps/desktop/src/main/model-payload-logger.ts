import { appendFile, chmod, mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type { ConversationModelPayload, WorkflowModelPayload } from "@zimo/application";

const MAX_BYTES = 10 * 1024 * 1024;
const RETAINED_FILES = 2;

type SensitiveModelRequestPayload = ConversationModelPayload | WorkflowModelPayload;

export class SensitiveModelPayloadLogger {
  private queue = Promise.resolve();

  constructor(private readonly filePath: string) {}

  logRequest(payload: SensitiveModelRequestPayload): void {
    const record = {
      timestamp: new Date().toISOString(),
      event: "model.request.full_payload",
      sensitive: true,
      warning:
        "Contains user, Agent, Skill, knowledge, and Tool input/output content. Never share this file.",
      ...redactImageDataUrls(payload),
    };
    this.queue = this.queue
      .then(() => this.write(`${JSON.stringify(record)}\n`))
      .catch((error: unknown) => {
        console.error(
          "Zimo sensitive model payload logger write failed",
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
      if (current.size + Buffer.byteLength(line) > MAX_BYTES) await this.rotate();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await appendFile(this.filePath, line, { encoding: "utf8", mode: 0o600 });
    await chmod(this.filePath, 0o600);
  }

  private async rotate(): Promise<void> {
    const directory = dirname(this.filePath);
    const fileName = basename(this.filePath);
    const files = (await readdir(directory))
      .filter((entry) => entry.startsWith(`${fileName}.`))
      .sort()
      .reverse();
    for (const file of files.slice(RETAINED_FILES - 1)) await unlink(join(directory, file));
    await rename(this.filePath, `${this.filePath}.${Date.now()}`);
  }
}

function redactImageDataUrls<T>(value: T): T {
  if (typeof value === "string") {
    return (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value) ? "[REDACTED_IMAGE]" : value) as T;
  }
  if (Array.isArray(value)) return value.map((item) => redactImageDataUrls(item)) as T;
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] =
      key === "url" && typeof child === "string" && child.startsWith("data:image/")
        ? "[REDACTED_IMAGE]"
        : redactImageDataUrls(child);
  }
  return next as T;
}

export function shouldEnableModelPayloadLogging(environment: NodeJS.ProcessEnv): boolean {
  return Boolean(environment.ELECTRON_RENDERER_URL && environment.ZIMO_LOG_LLM_PAYLOADS === "1");
}

export function createSensitiveModelPayloadLogger(
  logsDirectory: string,
  environment: NodeJS.ProcessEnv,
): SensitiveModelPayloadLogger | null {
  return shouldEnableModelPayloadLogging(environment)
    ? new SensitiveModelPayloadLogger(join(logsDirectory, "llm-payloads.jsonl"))
    : null;
}
