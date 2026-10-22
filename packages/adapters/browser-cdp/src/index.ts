import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { AppError } from "@zimo/domain";
import type {
  BrowserAutomationGateway,
  BrowserKey,
  BrowserScreenshot,
  BrowserSnapshot,
  BrowserTarget,
} from "@zimo/domain";

import type { SnapshotElement } from "./accessibility-snapshot";
import { dispatchBrowserKey } from "./browser-key";
import { CdpConnection } from "./cdp-connection";
import {
  classifyCdpFailure,
  safeCdpMethod,
  type CdpFailureDiagnostic,
} from "./cdp-failure-diagnostic";
import { record, text } from "./cdp-values";
import { readBrowserAccessibilitySnapshot } from "./iframe-accessibility-snapshot";
import { BrowserProfileProcess } from "./browser-process";
import { requirePublicBrowserUrl } from "./browser-url-policy";

type SnapshotCache = {
  snapshotId: string;
  elements: ReadonlyMap<string, SnapshotElement>;
};

export class LocalCdpBrowserGateway implements BrowserAutomationGateway {
  private readonly process: BrowserProfileProcess;
  private connection: CdpConnection | undefined;
  private activeTargetId: string | undefined;
  private readonly snapshots = new Map<string, SnapshotCache>();

  constructor(
    profileDirectory: string,
    private readonly workspaceRoot: string,
    private readonly onCdpFailure?: (diagnostic: CdpFailureDiagnostic) => void,
  ) {
    this.process = new BrowserProfileProcess(profileDirectory);
  }

  async listTabs(signal: AbortSignal): Promise<readonly BrowserTarget[]> {
    const targets = await this.readTabs(signal);
    if (targets.length > 0) return targets;
    await delay(200, signal);
    return this.readTabs(signal);
  }

  private async readTabs(signal: AbortSignal): Promise<readonly BrowserTarget[]> {
    const result = record(await this.send("Target.getTargets", {}, signal));
    const targetInfos = Array.isArray(result.targetInfos) ? result.targetInfos : [];
    const targets = targetInfos.flatMap((entry) => {
      const info = record(entry);
      if (info.type !== "page" || typeof info.targetId !== "string") return [];
      const target: BrowserTarget = {
        id: info.targetId,
        title: text(info.title, 500),
        url: text(info.url, 2_048),
        active: info.targetId === this.activeTargetId,
      };
      return [target];
    });
    if (!this.activeTargetId && targets[0]) {
      this.activeTargetId = targets[0].id;
      return targets.map((target, index) => ({ ...target, active: index === 0 }));
    }
    return targets;
  }

  async open(rawUrl: string, signal: AbortSignal): Promise<BrowserTarget> {
    const url = await requirePublicBrowserUrl(rawUrl);
    if (signal.aborted) throw signal.reason;
    const result = record(await this.send("Target.createTarget", { url }, signal));
    const targetId = result.targetId;
    if (typeof targetId !== "string" || targetId.length === 0) {
      throw browserError("BROWSER_TARGET_CREATE_FAILED", "无法新建浏览器标签页，请重试。");
    }
    await this.send("Target.activateTarget", { targetId }, signal);
    this.activeTargetId = targetId;
    return { id: targetId, title: "", url, active: true };
  }

  async focus(targetId: string, signal: AbortSignal): Promise<void> {
    await this.requireTarget(targetId, signal);
    await this.send("Target.activateTarget", { targetId }, signal);
    this.activeTargetId = targetId;
  }

  async snapshot(targetId: string, signal: AbortSignal): Promise<BrowserSnapshot> {
    const target = await this.requireTarget(targetId, signal);
    return this.withSession(targetId, signal, async (sessionId) => {
      const parsed = await readBrowserAccessibilitySnapshot(
        (method, params) => this.send(method, params, signal, sessionId),
        signal,
      );
      this.snapshots.set(targetId, {
        snapshotId: parsed.snapshotId,
        elements: parsed.elements,
      });
      return {
        targetId,
        snapshotId: parsed.snapshotId,
        title: target.title,
        url: target.url,
        content: parsed.content,
        elementCount: parsed.elements.size,
        truncated: parsed.truncated,
      };
    });
  }

  async screenshot(
    conversationId: string,
    targetId: string,
    signal: AbortSignal,
  ): Promise<BrowserScreenshot> {
    requireUuid(conversationId);
    await this.requireTarget(targetId, signal);
    return this.withSession(targetId, signal, async (sessionId) => {
      const result = record(
        await this.send("Page.captureScreenshot", { format: "png" }, signal, sessionId),
      );
      if (typeof result.data !== "string" || result.data.length > 30_000_000) {
        throw browserError("BROWSER_SCREENSHOT_INVALID", "浏览器没有返回可用的截图。");
      }
      const directory = join(this.workspaceRoot, conversationId, "files", "browser-captures");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const fileName = `browser-${randomUUID()}.png`;
      await writeFile(join(directory, fileName), Buffer.from(result.data, "base64"), {
        flag: "wx",
      });
      return { targetId, fileName, mediaType: "image/png" };
    });
  }

  async navigate(targetId: string, rawUrl: string, signal: AbortSignal): Promise<void> {
    await this.requireTarget(targetId, signal);
    const url = await requirePublicBrowserUrl(rawUrl);
    await this.withSession(targetId, signal, async (sessionId) => {
      const result = record(await this.send("Page.navigate", { url }, signal, sessionId));
      if (typeof result.errorText === "string") throw new Error(result.errorText);
    });
    this.snapshots.delete(targetId);
    this.activeTargetId = targetId;
  }

  async click(
    targetId: string,
    snapshotId: string,
    ref: string,
    signal: AbortSignal,
  ): Promise<void> {
    const element = this.requireElement(targetId, snapshotId, ref);
    await this.withSession(targetId, signal, async (sessionId) => {
      await this.send("Page.bringToFront", {}, signal, sessionId);
      await this.send("DOM.enable", {}, signal, sessionId);
      const { x, y } = await this.elementCenter(element, sessionId, signal);
      await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, signal, sessionId);
      await delay(30, signal);
      await this.send(
        "Input.dispatchMouseEvent",
        { type: "mousePressed", x, y, button: "left", clickCount: 1 },
        signal,
        sessionId,
      );
      await delay(40, signal);
      await this.send(
        "Input.dispatchMouseEvent",
        { type: "mouseReleased", x, y, button: "left", clickCount: 1 },
        signal,
        sessionId,
      );
    });
    this.snapshots.delete(targetId);
  }

  async type(
    targetId: string,
    snapshotId: string,
    ref: string,
    value: string,
    signal: AbortSignal,
  ): Promise<void> {
    const element = this.requireElement(targetId, snapshotId, ref);
    if (element.isProtected) {
      throw browserError("BROWSER_PASSWORD_INPUT_DENIED", "密码和受保护字段必须由用户手动填写。");
    }
    await this.withSession(targetId, signal, async (sessionId) => {
      await this.send("DOM.enable", {}, signal, sessionId);
      await this.send("DOM.focus", { backendNodeId: element.backendNodeId }, signal, sessionId);
      await this.send("Input.insertText", { text: value }, signal, sessionId);
    });
    this.snapshots.delete(targetId);
  }

  async press(
    targetId: string,
    snapshotId: string | undefined,
    ref: string | undefined,
    key: BrowserKey,
    signal: AbortSignal,
  ): Promise<void> {
    let element: SnapshotElement | undefined;
    if (key !== "Escape") {
      if (!snapshotId || !ref) {
        throw browserError("BROWSER_PRESS_TARGET_REQUIRED", "该按键需要最新网页快照中的元素。");
      }
      element = this.requireElement(targetId, snapshotId, ref);
    }
    if (element?.isProtected) {
      throw browserError("BROWSER_PASSWORD_INPUT_DENIED", "密码和受保护字段必须由用户手动填写。");
    }
    if (key === "Escape") await this.requireTarget(targetId, signal);
    await this.withSession(targetId, signal, async (sessionId) => {
      await dispatchBrowserKey(
        (method, params) => this.send(method, params, signal, sessionId),
        key,
        element?.backendNodeId,
      );
    });
    this.snapshots.delete(targetId);
  }

  async scroll(
    targetId: string,
    snapshotId: string,
    ref: string | undefined,
    deltaX: number,
    deltaY: number,
    signal: AbortSignal,
  ): Promise<void> {
    this.requireSnapshot(targetId, snapshotId);
    await this.withSession(targetId, signal, async (sessionId) => {
      await this.send("DOM.enable", {}, signal, sessionId);
      const point = ref
        ? await this.elementCenter(
            this.requireElement(targetId, snapshotId, ref),
            sessionId,
            signal,
          )
        : await this.viewportCenter(sessionId, signal);
      await this.send(
        "Input.dispatchMouseEvent",
        { type: "mouseWheel", x: point.x, y: point.y, deltaX, deltaY },
        signal,
        sessionId,
      );
    });
    this.snapshots.delete(targetId);
  }

  async wait(targetId: string, timeoutMs: number, signal: AbortSignal): Promise<BrowserSnapshot> {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 5_000) {
      throw browserError("BROWSER_WAIT_INVALID", "浏览器等待时间必须在 100 到 5000 毫秒之间。");
    }
    await delay(timeoutMs, signal);
    return this.snapshot(targetId, signal);
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection
        .send("Browser.close", {}, new AbortController().signal)
        .catch(() => undefined);
    }
    this.connection?.close();
    this.connection = undefined;
    this.snapshots.clear();
    await this.process.close();
  }

  private async requireTarget(targetId: string, signal: AbortSignal): Promise<BrowserTarget> {
    const target = (await this.listTabs(signal)).find((item) => item.id === targetId);
    if (!target) {
      throw browserError(
        "BROWSER_TARGET_NOT_FOUND",
        "指定的浏览器标签页不存在，请重新获取标签页。",
      );
    }
    return target;
  }

  private requireElement(targetId: string, snapshotId: string, ref: string): SnapshotElement {
    const element = this.requireSnapshot(targetId, snapshotId).elements.get(ref);
    if (!element) {
      throw browserError(
        "BROWSER_REF_NOT_FOUND",
        "最新网页结构中没有该元素，请重新读取网页结构并使用其中的 ref。",
      );
    }
    return element;
  }

  private requireSnapshot(targetId: string, snapshotId: string): SnapshotCache {
    const snapshot = this.snapshots.get(targetId);
    if (!snapshot || snapshot.snapshotId !== snapshotId) throw staleSnapshotError();
    return snapshot;
  }

  private async elementCenter(
    element: SnapshotElement,
    sessionId: string,
    signal: AbortSignal,
  ): Promise<{ x: number; y: number }> {
    await this.send(
      "DOM.scrollIntoViewIfNeeded",
      { backendNodeId: element.backendNodeId },
      signal,
      sessionId,
    );
    const result = record(
      await this.send(
        "DOM.getBoxModel",
        { backendNodeId: element.backendNodeId },
        signal,
        sessionId,
      ),
    );
    const content = record(result.model).content;
    if (!Array.isArray(content) || content.length < 8) throw staleSnapshotError();
    const numbers = content.slice(0, 8).map(Number);
    if (numbers.some((value) => !Number.isFinite(value))) throw staleSnapshotError();
    return {
      x: (numbers[0]! + numbers[2]! + numbers[4]! + numbers[6]!) / 4,
      y: (numbers[1]! + numbers[3]! + numbers[5]! + numbers[7]!) / 4,
    };
  }

  private async viewportCenter(
    sessionId: string,
    signal: AbortSignal,
  ): Promise<{ x: number; y: number }> {
    const metrics = record(await this.send("Page.getLayoutMetrics", {}, signal, sessionId));
    const viewport = record(metrics.cssVisualViewport);
    const width = Number(viewport.clientWidth);
    const height = Number(viewport.clientHeight);
    return {
      x: Number.isFinite(width) && width > 0 ? width / 2 : 640,
      y: Number.isFinite(height) && height > 0 ? height / 2 : 400,
    };
  }

  private async withSession<T>(
    targetId: string,
    signal: AbortSignal,
    action: (sessionId: string) => Promise<T>,
  ): Promise<T> {
    const attached = record(
      await this.send("Target.attachToTarget", { targetId, flatten: true }, signal),
    );
    if (typeof attached.sessionId !== "string") throw new Error("CDP session unavailable");
    try {
      return await action(attached.sessionId);
    } finally {
      await this.send(
        "Target.detachFromTarget",
        { sessionId: attached.sessionId },
        undefined,
      ).catch(() => undefined);
    }
  }

  private async send(
    method: string,
    params: Readonly<Record<string, unknown>>,
    signal?: AbortSignal,
    sessionId?: string,
  ): Promise<unknown> {
    const startedAt = Date.now();
    const effectiveSignal = signal ?? new AbortController().signal;
    const attempts = method === "Target.getTargets" && !sessionId ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const connection = await this.currentConnection(effectiveSignal);
        return await connection.send(method, params, effectiveSignal, sessionId);
      } catch (error) {
        if (effectiveSignal.aborted) throw error;
        const reason = classifyCdpFailure(error);
        this.invalidateConnection();
        if (attempt + 1 < attempts && isConnectionFailure(reason)) continue;
        try {
          this.onCdpFailure?.({
            method: safeCdpMethod(method),
            reason,
            durationMs: Date.now() - startedAt,
          });
        } catch {
          // Diagnostic failure must not replace the browser error.
        }
        throw browserError(
          "BROWSER_CDP_FAILED",
          "浏览器操作失败，请确认 Zimo 浏览器仍在运行。",
          error,
        );
      }
    }
    throw new Error("CDP query exhausted its retry budget");
  }

  private async currentConnection(signal: AbortSignal): Promise<CdpConnection> {
    if (this.connection && !this.connection.isOpen()) this.invalidateConnection();
    if (!this.connection) {
      this.connection = await CdpConnection.connect(await this.process.endpoint(signal), signal);
    }
    return this.connection;
  }

  private invalidateConnection(): void {
    this.connection?.close();
    this.connection = undefined;
    this.activeTargetId = undefined;
    this.snapshots.clear();
  }
}

function isConnectionFailure(reason: ReturnType<typeof classifyCdpFailure>): boolean {
  return (
    reason === "connection_closed" ||
    reason === "connection_failed" ||
    reason === "connection_unavailable"
  );
}

function requireUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Invalid conversation ID");
  }
}

async function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw signal.reason;
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timeout);
      reject(signal.reason);
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function staleSnapshotError(): AppError {
  return browserError("BROWSER_SNAPSHOT_STALE", "网页结构已变化，请重新读取网页结构后再操作。");
}

function browserError(code: string, userMessage: string, cause?: unknown): AppError {
  return new AppError({ code, category: "network", userMessage, ...(cause ? { cause } : {}) });
}
