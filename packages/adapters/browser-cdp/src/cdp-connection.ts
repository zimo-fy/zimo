type PendingCommand = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

type WebSocketLike = {
  readonly readyState: number;
  addEventListener(
    type: string,
    listener: (event: unknown) => void,
    options?: { once?: boolean },
  ): void;
  send(value: string): void;
  close(): void;
};

type WebSocketConstructor = new (url: string) => WebSocketLike;

export class CdpConnection {
  private readonly pending = new Map<number, PendingCommand>();
  private nextId = 1;

  private constructor(private readonly socket: WebSocketLike) {
    socket.addEventListener("message", (event) => this.receive(eventData(event)));
    socket.addEventListener("error", () => this.rejectAll(new Error("CDP connection failed")));
    socket.addEventListener("close", () => this.rejectAll(new Error("CDP connection closed")));
  }

  static async connect(endpoint: string, signal: AbortSignal): Promise<CdpConnection> {
    assertLoopbackEndpoint(endpoint);
    if (signal.aborted) throw abortError();
    const WebSocketClient = (globalThis as unknown as { WebSocket?: WebSocketConstructor })
      .WebSocket;
    if (!WebSocketClient) throw new Error("WebSocket runtime unavailable");
    return new Promise<CdpConnection>((resolve, reject) => {
      const socket = new WebSocketClient(endpoint);
      const onAbort = () => {
        socket.close();
        reject(abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
      socket.addEventListener(
        "open",
        () => {
          signal.removeEventListener("abort", onAbort);
          resolve(new CdpConnection(socket));
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          signal.removeEventListener("abort", onAbort);
          reject(new Error("CDP connection failed"));
        },
        { once: true },
      );
    });
  }

  send(
    method: string,
    params: Readonly<Record<string, unknown>> = {},
    signal?: AbortSignal,
    sessionId?: string,
  ): Promise<unknown> {
    if (this.socket.readyState !== 1)
      return Promise.reject(new Error("CDP connection is not open"));
    if (signal?.aborted) return Promise.reject(abortError());
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const finish = (error?: Error, value?: unknown) => {
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(id);
        signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else resolve(value);
      };
      const onAbort = () => finish(abortError());
      const timer = setTimeout(() => finish(new Error("CDP command timed out")), 15_000);
      this.pending.set(id, {
        resolve: (value) => finish(undefined, value),
        reject: (error) => finish(error),
        timer,
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  isOpen(): boolean {
    return this.socket.readyState === 1;
  }

  close(): void {
    this.rejectAll(new Error("CDP connection closed"));
    this.socket.close();
  }

  private receive(data: unknown): void {
    try {
      const value = JSON.parse(rawDataText(data)) as {
        id?: unknown;
        result?: unknown;
        error?: { message?: unknown };
      };
      if (typeof value.id !== "number") return;
      const pending = this.pending.get(value.id);
      if (!pending) return;
      if (typeof value.error?.message === "string") pending.reject(new Error(value.error.message));
      else pending.resolve(value.result);
    } catch {
      // CDP events and malformed frames do not satisfy a pending command.
    }
  }

  private rejectAll(error: Error): void {
    const commands = [...this.pending.values()];
    for (const command of commands) command.reject(error);
  }
}

function eventData(event: unknown): unknown {
  return event && typeof event === "object" && "data" in event
    ? (event as { data: unknown }).data
    : undefined;
}

function rawDataText(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  throw new Error("Unsupported WebSocket frame");
}

function assertLoopbackEndpoint(endpoint: string): void {
  const url = new URL(endpoint);
  if (url.protocol !== "ws:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("CDP endpoint must use a loopback WebSocket");
  }
}

function abortError(): Error {
  return new DOMException("The operation was aborted", "AbortError");
}
