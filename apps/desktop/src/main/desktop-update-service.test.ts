import type { StructuredLogger } from "@zimo/logging";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] } }));

import { DesktopUpdateService } from "./desktop-update-service";

describe("DesktopUpdateService", () => {
  it("reports the installed version without contacting an update provider", () => {
    const service = new DesktopUpdateService("0.1.0", null as StructuredLogger | null);

    expect(service.check(true)).toEqual({
      status: "up-to-date",
      currentVersion: "0.1.0",
      userInitiated: true,
    });
  });

  it("refuses installation because no package is downloaded", () => {
    const service = new DesktopUpdateService("0.1.0", null);

    expect(() => service.install()).toThrow("新版本尚未下载完成");
  });

  it("rejects a check after the service is disposed", () => {
    const service = new DesktopUpdateService("0.1.0", null);
    service.dispose();

    expect(() => service.check(true)).toThrow("更新服务当前不可用");
  });
});
