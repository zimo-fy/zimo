import type { AutomationService } from "@zimo/application";
import type { StructuredLogger } from "@zimo/logging";

const TICK_INTERVAL_MS = 30_000;

export class DesktopAutomationScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private isTicking = false;
  private isDisposed = false;

  constructor(
    private readonly automations: AutomationService,
    private readonly logger: StructuredLogger,
  ) {}

  start(): void {
    if (this.timer || this.isDisposed) return;
    this.schedule(0);
  }

  dispose(): void {
    this.isDisposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.automations.cancelAll();
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private async tick(): Promise<void> {
    this.timer = undefined;
    if (this.isDisposed || this.isTicking) return;
    this.isTicking = true;
    try {
      const started = await this.automations.runDue();
      if (started > 0) {
        this.logger.log({
          level: "info",
          category: "automation",
          event: "automation.scheduler.tick.completed",
          message: "Due automation runs started",
          context: { count: started, outcome: "success" },
        });
      }
    } catch (error) {
      this.logger.log({
        level: "warn",
        category: "automation",
        event: "automation.scheduler.tick.failed",
        message: "Automation scheduler tick failed",
        context: {
          errorCode: error instanceof Error ? error.name : "INTERNAL_UNEXPECTED",
          outcome: "failure",
        },
      });
    } finally {
      this.isTicking = false;
      if (!this.isDisposed) this.schedule(TICK_INTERVAL_MS);
    }
  }
}
