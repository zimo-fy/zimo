// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatArtifacts } from "./use-chat-artifacts";

const originalZimo = Object.getOwnPropertyDescriptor(window, "zimo");

afterEach(() => {
  if (originalZimo) Object.defineProperty(window, "zimo", originalZimo);
  else Reflect.deleteProperty(window, "zimo");
});

describe("useChatArtifacts", () => {
  it("shows a restart instruction when a hot-updated renderer has no artifact bridge", async () => {
    Object.defineProperty(window, "zimo", { configurable: true, value: {} });
    const onError = vi.fn();
    const { result } = renderHook(() => useChatArtifacts(onError));

    await act(() => result.current.select("11111111-1111-4111-8111-111111111111"));

    expect(onError).toHaveBeenCalledWith("文件功能尚未加载，请完全退出并重新启动 Zimo 后重试。");
  });
});
