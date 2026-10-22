import { randomUUID } from "node:crypto";

import { ipcResultSchema, type IpcResult, type SerializedAppError } from "@zimo/contracts";
import { AppError } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";

export type RegisterIpcHandler = <TInput, TOutput>(options: {
  channel: string;
  input: z.ZodType<TInput>;
  output: z.ZodType<TOutput>;
  handle: (input: TInput, event: IpcMainInvokeEvent) => Promise<TOutput> | TOutput;
}) => void;

export function createIpcHandlerRegistrar(logger: StructuredLogger | null): RegisterIpcHandler {
  return <TInput, TOutput>(options: {
    channel: string;
    input: z.ZodType<TInput>;
    output: z.ZodType<TOutput>;
    handle: (input: TInput, event: IpcMainInvokeEvent) => Promise<TOutput> | TOutput;
  }): void => {
    ipcMain.handle(options.channel, async (event, raw: unknown): Promise<IpcResult<TOutput>> => {
      const requestId = requestIdFrom(raw);
      if (!isAllowedSender(event)) {
        logger?.log({
          level: "warn",
          category: "security",
          event: "ipc.sender.rejected",
          message: "Rejected IPC request from an untrusted sender",
          context: { channel: options.channel },
        });
        return {
          ok: false,
          requestId,
          error: {
            code: "SECURITY_REQUEST_REJECTED",
            category: "security",
            message: "请求未通过安全检查。",
            retryable: false,
          },
        };
      }

      const input = options.input.safeParse(raw);
      if (!input.success) {
        return {
          ok: false,
          requestId,
          error: {
            code: "IPC_INVALID_INPUT",
            category: "user",
            message: "提交的数据格式不正确。",
            retryable: false,
          },
        };
      }

      try {
        const data = options.output.parse(await options.handle(input.data, event));
        return ipcResultSchema(options.output).parse({ ok: true, requestId, data });
      } catch (error) {
        return ipcResultSchema(options.output).parse({
          ok: false,
          requestId,
          error: serializeError(error, logger),
        });
      }
    });
  };
}

function serializeError(error: unknown, logger: StructuredLogger | null): SerializedAppError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      category: error.category,
      message: error.userMessage,
      retryable: error.retryable,
      ...(error.safeDetails ? { details: { ...error.safeDetails } } : {}),
    };
  }
  logger?.log({
    level: "error",
    category: "app",
    event: "app.operation.failed",
    message: "Unexpected application error",
    context: { errorCode: "INTERNAL_UNEXPECTED", error },
  });
  return {
    code: "INTERNAL_UNEXPECTED",
    category: "internal",
    message: "操作未能完成，请稍后重试。",
    retryable: true,
  };
}

function requestIdFrom(raw: unknown): string {
  if (raw && typeof raw === "object" && "requestId" in raw) {
    const parsed = z.uuid().safeParse(raw.requestId);
    if (parsed.success) return parsed.data;
  }
  return randomUUID();
}

function isAllowedSender(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  if (!frame || frame.parent !== null) return false;
  try {
    const url = new URL(frame.url);
    if (process.env.ELECTRON_RENDERER_URL) {
      return url.origin === new URL(process.env.ELECTRON_RENDERER_URL).origin;
    }
    return url.protocol === "app:" && url.host === "zimo";
  } catch {
    return false;
  }
}
