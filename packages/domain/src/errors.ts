export type ErrorCategory =
  "user" | "configuration" | "network" | "model" | "storage" | "security" | "internal";

export interface AppErrorOptions {
  code: string;
  category: ErrorCategory;
  userMessage: string;
  retryable?: boolean;
  safeDetails?: Readonly<Record<string, string | number | boolean>>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly safeDetails: Readonly<Record<string, string | number | boolean>> | undefined;
  override readonly cause: unknown;

  constructor(options: AppErrorOptions) {
    super(options.userMessage, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.category = options.category;
    this.userMessage = options.userMessage;
    this.retryable = options.retryable ?? false;
    this.safeDetails = options.safeDetails;
    this.cause = options.cause;
  }
}
