import { spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";

const START_TIMEOUT_MS = 15_000;

export class BrowserProfileProcess {
  private child: ChildProcess | undefined;
  private starting: Promise<string> | undefined;

  constructor(private readonly profileDirectory: string) {}

  async endpoint(signal: AbortSignal): Promise<string> {
    const existing = await readEndpoint(this.profileDirectory);
    if (existing && (await endpointResponds(existing, signal))) return existing;
    if (!this.starting) {
      this.starting = this.start(signal).finally(() => {
        this.starting = undefined;
      });
    }
    return this.starting;
  }

  async close(): Promise<void> {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 3_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private async start(signal: AbortSignal): Promise<string> {
    if (signal.aborted) throw abortError();
    const executable = await locateBrowserExecutable();
    if (!executable) throw new Error("No supported local browser found");
    const port = await reserveAvailablePort();
    await mkdir(this.profileDirectory, { recursive: true, mode: 0o700 });
    await rm(join(this.profileDirectory, "DevToolsActivePort"), { force: true });
    const child = spawn(
      executable,
      [
        `--user-data-dir=${this.profileDirectory}`,
        "--remote-debugging-address=127.0.0.1",
        `--remote-debugging-port=${port}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--new-window",
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "pipe"], windowsHide: false },
    );
    this.child = child;
    child.once("exit", () => {
      if (this.child === child) this.child = undefined;
    });
    child.once("error", () => {
      if (this.child === child) this.child = undefined;
    });
    try {
      const endpoint = await waitForProcessEndpoint(child, port, signal);
      if (!(await endpointResponds(endpoint, signal))) {
        throw new Error("Browser CDP endpoint unavailable");
      }
      const url = new URL(endpoint);
      await writeFile(
        join(this.profileDirectory, "DevToolsActivePort"),
        `${url.port}\n${url.pathname}\n`,
        { mode: 0o600 },
      );
      return endpoint;
    } catch (error) {
      await this.close();
      throw error;
    }
  }
}

async function locateBrowserExecutable(): Promise<string | undefined> {
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : process.platform === "win32"
        ? windowsCandidates()
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/microsoft-edge",
            "/usr/bin/brave-browser",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return candidate;
  }
  return undefined;
}

function windowsCandidates(): string[] {
  const roots = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA,
  ].filter((value): value is string => Boolean(value));
  return roots.flatMap((root) => [
    join(root, "Google", "Chrome", "Application", "chrome.exe"),
    join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
  ]);
}

async function isExecutable(path: string): Promise<boolean> {
  return access(path, process.platform === "win32" ? constants.F_OK : constants.X_OK).then(
    () => true,
    () => false,
  );
}

async function reserveAvailablePort(): Promise<number> {
  const server = createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No available CDP port");
    return address.port;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export function parseBrowserEndpoint(output: string, expectedPort: number): string | undefined {
  const match = output.match(
    /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9-]+)/,
  );
  if (!match?.[1]) return undefined;
  const endpoint = new URL(match[1]);
  return Number(endpoint.port) === expectedPort ? endpoint.href : undefined;
}

function waitForProcessEndpoint(
  child: ChildProcess,
  port: number,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!child.stderr) return reject(new Error("Browser CDP output unavailable"));
    let output = "";
    const cleanup = (): void => {
      clearTimeout(timer);
      child.stderr?.off("data", onData);
      child.stderr?.resume();
      child.off("error", onError);
      child.off("exit", onExit);
      signal.removeEventListener("abort", onAbort);
    };
    const onData = (chunk: Buffer): void => {
      output = (output + chunk.toString("utf8")).slice(-8_192);
      const endpoint = parseBrowserEndpoint(output, port);
      if (endpoint) {
        cleanup();
        resolve(endpoint);
      }
    };
    const onError = (): void => {
      cleanup();
      reject(new Error("Browser failed to start"));
    };
    const onExit = (): void => {
      cleanup();
      reject(new Error("Browser exited before CDP was ready"));
    };
    const onAbort = (): void => {
      cleanup();
      reject(abortError());
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Browser did not expose a CDP endpoint in time"));
    }, START_TIMEOUT_MS);
    child.stderr.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

async function readEndpoint(profileDirectory: string): Promise<string | undefined> {
  try {
    const [portText, path] = (await readFile(join(profileDirectory, "DevToolsActivePort"), "utf8"))
      .trim()
      .split(/\r?\n/);
    const port = Number(portText);
    if (!Number.isInteger(port) || port < 1 || port > 65_535 || !path?.startsWith("/devtools/")) {
      return undefined;
    }
    return `ws://127.0.0.1:${port}${path}`;
  } catch {
    return undefined;
  }
}

async function endpointResponds(endpoint: string, signal: AbortSignal): Promise<boolean> {
  const url = new URL(endpoint);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(`http://127.0.0.1:${url.port}/json/version`, {
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return (
      typeof body === "object" &&
      body !== null &&
      "webSocketDebuggerUrl" in body &&
      body.webSocketDebuggerUrl === endpoint
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

function abortError(): Error {
  return new DOMException("The operation was aborted", "AbortError");
}
