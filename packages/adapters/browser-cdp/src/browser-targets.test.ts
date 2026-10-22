import { describe, expect, it, vi } from "vitest";

import { LocalCdpBrowserGateway } from "./index";

describe("browser targets", () => {
  it("retries a transient empty page list once", async () => {
    const gateway = new LocalCdpBrowserGateway("unused-profile", "unused-workspace");
    const send = vi
      .fn()
      .mockResolvedValueOnce({ targetInfos: [] })
      .mockResolvedValueOnce({
        targetInfos: [{ type: "page", targetId: "ready", title: "Ready", url: "about:blank" }],
      });
    Object.assign(gateway, { send });

    await expect(gateway.listTabs(new AbortController().signal)).resolves.toEqual([
      { id: "ready", title: "Ready", url: "about:blank", active: true },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list after one bounded retry", async () => {
    const gateway = new LocalCdpBrowserGateway("unused-profile", "unused-workspace");
    const send = vi.fn(async () => ({ targetInfos: [] }));
    Object.assign(gateway, { send });

    await expect(gateway.listTabs(new AbortController().signal)).resolves.toEqual([]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("cancels before retrying an empty page list", async () => {
    const gateway = new LocalCdpBrowserGateway("unused-profile", "unused-workspace");
    const controller = new AbortController();
    const send = vi.fn(async () => {
      controller.abort();
      return { targetInfos: [] };
    });
    Object.assign(gateway, { send });

    await expect(gateway.listTabs(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("creates and activates a target only for an allowed public URL", async () => {
    const gateway = new LocalCdpBrowserGateway("unused-profile", "unused-workspace");
    const send = vi.fn(async (method: string) =>
      method === "Target.createTarget" ? { targetId: "created" } : {},
    );
    Object.assign(gateway, { send });
    const signal = new AbortController().signal;

    await expect(gateway.open("https://8.8.8.8/page", signal)).resolves.toEqual({
      id: "created",
      title: "",
      url: "https://8.8.8.8/page",
      active: true,
    });
    expect(send).toHaveBeenNthCalledWith(
      1,
      "Target.createTarget",
      { url: "https://8.8.8.8/page" },
      signal,
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      "Target.activateTarget",
      { targetId: "created" },
      signal,
    );

    await expect(gateway.open("http://127.0.0.1/", signal)).rejects.toThrow("not allowed");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("does not claim a tab was opened without a CDP target ID", async () => {
    const gateway = new LocalCdpBrowserGateway("unused-profile", "unused-workspace");
    const send = vi.fn(async () => ({}));
    Object.assign(gateway, { send });

    await expect(
      gateway.open("https://8.8.8.8/", new AbortController().signal),
    ).rejects.toMatchObject({
      code: "BROWSER_TARGET_CREATE_FAILED",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
