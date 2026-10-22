import { AppError } from "@zimo/domain";

/** A Profile is shared by runs, so one run owns browser actions until its tool loop ends. */
export class BrowserRunLease {
  private ownerRunId: string | undefined;

  claim(runId: string): void {
    if (this.ownerRunId && this.ownerRunId !== runId) {
      throw new AppError({
        code: "BROWSER_RUN_BUSY",
        category: "user",
        userMessage: "另一个任务正在操作 Zimo 浏览器，请稍后重试。",
        retryable: true,
      });
    }
    this.ownerRunId = runId;
  }

  release(runId: string): void {
    if (this.ownerRunId === runId) this.ownerRunId = undefined;
  }
}
