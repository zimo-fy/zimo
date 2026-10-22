import { createHash } from "node:crypto";
import { join } from "node:path";

import { LocalCdpBrowserGateway } from "@zimo/browser-cdp";
import { AppError } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import type {
  BrowserAutomationGateway,
  BrowserKey,
  BrowserScreenshot,
  BrowserSnapshot,
  BrowserTarget,
} from "@zimo/domain";

export function createBrowserAutomation(options: {
  profilesRoot: string;
  workspaceRoot: string;
  logger: StructuredLogger;
  resolveOwnerId(): Promise<string | undefined>;
}): BrowserAutomationGateway {
  return new AccountScopedBrowserAutomation(options);
}

class AccountScopedBrowserAutomation implements BrowserAutomationGateway {
  private readonly gateways = new Map<string, LocalCdpBrowserGateway>();

  constructor(
    private readonly options: {
      profilesRoot: string;
      workspaceRoot: string;
      logger: StructuredLogger;
      resolveOwnerId(): Promise<string | undefined>;
    },
  ) {}

  async listTabs(signal: AbortSignal): Promise<readonly BrowserTarget[]> {
    return (await this.current()).listTabs(signal);
  }

  async open(url: string, signal: AbortSignal): Promise<BrowserTarget> {
    return (await this.current()).open(url, signal);
  }

  async focus(targetId: string, signal: AbortSignal): Promise<void> {
    return (await this.current()).focus(targetId, signal);
  }

  async snapshot(targetId: string, signal: AbortSignal): Promise<BrowserSnapshot> {
    return (await this.current()).snapshot(targetId, signal);
  }

  async screenshot(
    conversationId: string,
    targetId: string,
    signal: AbortSignal,
  ): Promise<BrowserScreenshot> {
    return (await this.current()).screenshot(conversationId, targetId, signal);
  }

  async navigate(targetId: string, url: string, signal: AbortSignal): Promise<void> {
    return (await this.current()).navigate(targetId, url, signal);
  }

  async click(
    targetId: string,
    snapshotId: string,
    ref: string,
    signal: AbortSignal,
  ): Promise<void> {
    return (await this.current()).click(targetId, snapshotId, ref, signal);
  }

  async type(
    targetId: string,
    snapshotId: string,
    ref: string,
    text: string,
    signal: AbortSignal,
  ): Promise<void> {
    return (await this.current()).type(targetId, snapshotId, ref, text, signal);
  }

  async press(
    targetId: string,
    snapshotId: string | undefined,
    ref: string | undefined,
    key: BrowserKey,
    signal: AbortSignal,
  ): Promise<void> {
    return (await this.current()).press(targetId, snapshotId, ref, key, signal);
  }

  async scroll(
    targetId: string,
    snapshotId: string,
    ref: string | undefined,
    deltaX: number,
    deltaY: number,
    signal: AbortSignal,
  ): Promise<void> {
    return (await this.current()).scroll(targetId, snapshotId, ref, deltaX, deltaY, signal);
  }

  async wait(targetId: string, timeoutMs: number, signal: AbortSignal): Promise<BrowserSnapshot> {
    return (await this.current()).wait(targetId, timeoutMs, signal);
  }

  async close(): Promise<void> {
    await Promise.all([...this.gateways.values()].map((gateway) => gateway.close()));
    this.gateways.clear();
  }

  private async current(): Promise<LocalCdpBrowserGateway> {
    const ownerId = await this.options.resolveOwnerId();
    if (!ownerId) {
      throw new AppError({
        code: "BROWSER_SESSION_REQUIRED",
        category: "configuration",
        userMessage: "请先登录后再使用浏览器能力。",
      });
    }
    const key = createHash("sha256").update(ownerId).digest("hex").slice(0, 32);
    const existing = this.gateways.get(key);
    if (existing) return existing;
    const gateway = new LocalCdpBrowserGateway(
      join(this.options.profilesRoot, key, "default", "user-data"),
      this.options.workspaceRoot,
      (diagnostic) =>
        this.options.logger.log({
          level: "warn",
          category: "tool",
          event: "browser.cdp.command.failed",
          message: "Browser CDP command failed; original error omitted by policy",
          context: { ...diagnostic, errorCode: "BROWSER_CDP_FAILED", outcome: "failure" },
        }),
    );
    this.gateways.set(key, gateway);
    return gateway;
  }
}
