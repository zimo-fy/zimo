import { IPC_CHANNELS } from "@zimo/contracts";
import { describe, expect, it, vi } from "vitest";

const ipc = vi.hoisted(() => ({
  on: vi.fn(),
  removeListener: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("electron", () => ({ ipcRenderer: ipc }));

import { automationApi } from "./automation-api";

describe("automationApi.onTaskListChanged", () => {
  it("accepts only the empty notification and removes its listener", () => {
    const listener = vi.fn();
    const unsubscribe = automationApi.onTaskListChanged(listener);
    const wrapped = ipc.on.mock.calls.at(-1)?.[1] as
      ((_event: unknown, payload: unknown) => void) | undefined;

    expect(ipc.on).toHaveBeenCalledWith(IPC_CHANNELS.automationsTaskListChanged, wrapped);
    expect(wrapped).toBeDefined();
    wrapped?.(undefined, { prompt: "private" });
    expect(listener).not.toHaveBeenCalled();
    wrapped?.(undefined, {});
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    expect(ipc.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.automationsTaskListChanged,
      wrapped,
    );
  });
});
