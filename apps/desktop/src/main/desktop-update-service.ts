import { appUpdateStateViewSchema, IPC_CHANNELS, type AppUpdateStateView } from "@zimo/contracts";
import { AppError } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import { BrowserWindow } from "electron";

export class DesktopUpdateService {
  private state: AppUpdateStateView;
  private disposed = false;

  constructor(
    currentVersion: string,
    private readonly logger: StructuredLogger | null,
  ) {
    this.state = {
      status: "idle",
      currentVersion,
      userInitiated: false,
    };
  }

  getState(): AppUpdateStateView {
    return { ...this.state };
  }

  check(userInitiated: boolean): AppUpdateStateView {
    if (this.disposed) throw updateUnavailableError();
    this.publish({
      status: "up-to-date",
      currentVersion: this.state.currentVersion,
      userInitiated,
    });
    this.logger?.log({
      level: "info",
      category: "electron",
      event: "desktop_update.check_completed",
      message: "Desktop update check reported the installed version",
      context: { outcome: "success" },
    });
    return this.getState();
  }

  install(): void {
    throw new AppError({
      code: "UPDATE_NOT_READY",
      category: "user",
      userMessage: "新版本尚未下载完成。",
      retryable: true,
    });
  }

  dispose(): void {
    this.disposed = true;
  }

  private publish(next: AppUpdateStateView): void {
    this.state = appUpdateStateViewSchema.parse(next);
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.updatesState, this.state);
    }
  }
}

export function createDesktopUpdateService(options: {
  currentVersion: string;
  logger: StructuredLogger | null;
}): DesktopUpdateService {
  return new DesktopUpdateService(options.currentVersion, options.logger);
}

function updateUnavailableError(): AppError {
  return new AppError({
    code: "UPDATE_SERVICE_UNAVAILABLE",
    category: "internal",
    userMessage: "更新服务当前不可用。",
    retryable: true,
  });
}
