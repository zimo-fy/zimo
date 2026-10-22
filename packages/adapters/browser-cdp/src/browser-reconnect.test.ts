import { afterEach, describe, expect, it, vi } from "vitest";

import { CdpConnection } from "./cdp-connection";
import { LocalCdpBrowserGateway } from "./index";

const page = {
  type: "page",
  targetId: "new-target",
  title: "Boss",
  url: "https://www.zhipin.com/",
};

function gatewayWithConnection(connection: object) {
  const gateway = new LocalCdpBrowserGateway("unused-profile", "unused-workspace");
  const endpoint = vi.fn(async () => "ws://127.0.0.1:49152/devtools/browser/new");
  Object.assign(gateway, { connection, process: { endpoint } });
  return { gateway, endpoint };
}

afterEach(() => vi.restoreAllMocks());

describe("browser CDP reconnection", () => {
  it("replaces a closed cached socket before listing tabs", async () => {
    const old = { isOpen: () => false, send: vi.fn(), close: vi.fn() };
    const fresh = {
      isOpen: () => true,
      send: vi.fn(async () => ({ targetInfos: [page] })),
      close: vi.fn(),
    };
    const { gateway, endpoint } = gatewayWithConnection(old);
    const connect = vi
      .spyOn(CdpConnection, "connect")
      .mockResolvedValue(fresh as unknown as CdpConnection);

    await expect(gateway.listTabs(new AbortController().signal)).resolves.toEqual([
      { id: "new-target", title: "Boss", url: "https://www.zhipin.com/", active: true },
    ]);
    expect(old.close).toHaveBeenCalledOnce();
    expect(old.send).not.toHaveBeenCalled();
    expect(endpoint).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledOnce();
  });

  it("retries only the read-only tab query when the socket closes during send", async () => {
    const old = {
      isOpen: () => true,
      send: vi.fn(async () => {
        throw new Error("CDP connection is not open");
      }),
      close: vi.fn(),
    };
    const fresh = {
      isOpen: () => true,
      send: vi.fn(async () => ({ targetInfos: [page] })),
      close: vi.fn(),
    };
    const { gateway, endpoint } = gatewayWithConnection(old);
    vi.spyOn(CdpConnection, "connect").mockResolvedValue(fresh as unknown as CdpConnection);

    await expect(gateway.listTabs(new AbortController().signal)).resolves.toHaveLength(1);
    expect(old.send).toHaveBeenCalledOnce();
    expect(fresh.send).toHaveBeenCalledOnce();
    expect(endpoint).toHaveBeenCalledOnce();
    expect(old.close).toHaveBeenCalledOnce();
  });

  it("does not reuse an old tab ID after relaunch", async () => {
    const old = { isOpen: () => false, send: vi.fn(), close: vi.fn() };
    const fresh = {
      isOpen: () => true,
      send: vi.fn(async () => ({ targetInfos: [page] })),
      close: vi.fn(),
    };
    const { gateway } = gatewayWithConnection(old);
    vi.spyOn(CdpConnection, "connect").mockResolvedValue(fresh as unknown as CdpConnection);

    await expect(
      gateway.snapshot("old-target", new AbortController().signal),
    ).rejects.toMatchObject({
      code: "BROWSER_TARGET_NOT_FOUND",
    });
    expect(fresh.send).toHaveBeenCalledOnce();
    expect(fresh.send).toHaveBeenCalledWith(
      "Target.getTargets",
      {},
      expect.any(AbortSignal),
      undefined,
    );
  });

  it("stops after one read-only retry and reports the final safe failure", async () => {
    const first = {
      isOpen: () => true,
      send: vi.fn(async () => {
        throw new Error("CDP connection closed");
      }),
      close: vi.fn(),
    };
    const second = {
      isOpen: () => true,
      send: vi.fn(async () => {
        throw new Error("CDP connection closed");
      }),
      close: vi.fn(),
    };
    const diagnostic = vi.fn();
    const gateway = new LocalCdpBrowserGateway("unused-profile", "unused-workspace", diagnostic);
    Object.assign(gateway, {
      connection: first,
      process: { endpoint: vi.fn(async () => "ws://127.0.0.1:49152/devtools/browser/new") },
    });
    vi.spyOn(CdpConnection, "connect").mockResolvedValue(second as unknown as CdpConnection);

    await expect(gateway.listTabs(new AbortController().signal)).rejects.toMatchObject({
      code: "BROWSER_CDP_FAILED",
    });
    expect(first.send).toHaveBeenCalledOnce();
    expect(second.send).toHaveBeenCalledOnce();
    expect(diagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ method: "Target.getTargets", reason: "connection_closed" }),
    );
  });

  it("never replays a tab-creation command after a connection failure", async () => {
    const old = {
      isOpen: () => true,
      send: vi.fn(async () => {
        throw new Error("CDP connection closed");
      }),
      close: vi.fn(),
    };
    const { gateway, endpoint } = gatewayWithConnection(old);
    const connect = vi.spyOn(CdpConnection, "connect");

    await expect(
      gateway.open("https://8.8.8.8/", new AbortController().signal),
    ).rejects.toMatchObject({
      code: "BROWSER_CDP_FAILED",
    });
    expect(old.send).toHaveBeenCalledOnce();
    expect(endpoint).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it("does not reconnect after cancellation", async () => {
    const controller = new AbortController();
    const old = {
      isOpen: () => true,
      send: vi.fn(async () => {
        controller.abort();
        throw new Error("CDP connection closed");
      }),
      close: vi.fn(),
    };
    const { gateway, endpoint } = gatewayWithConnection(old);
    const connect = vi.spyOn(CdpConnection, "connect");

    await expect(gateway.listTabs(controller.signal)).rejects.toThrow("CDP connection closed");
    expect(old.send).toHaveBeenCalledOnce();
    expect(endpoint).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
});
