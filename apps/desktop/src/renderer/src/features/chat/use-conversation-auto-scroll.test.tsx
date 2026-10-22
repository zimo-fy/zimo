// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConversationAutoScroll } from "./use-conversation-auto-scroll";

let notifyResize: ResizeObserverCallback | undefined;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  notifyResize = undefined;
});

function ScrollHarness() {
  const { viewportRef, contentRef, isAtBottom, handleScroll } = useConversationAutoScroll({
    conversationId: "conversation-1",
    forceVersion: 1,
  });
  return (
    <div ref={viewportRef} aria-label="消息列表" onScroll={handleScroll}>
      <div ref={contentRef}>消息内容</div>
      {!isAtBottom && <span>回到最新</span>}
    </div>
  );
}

function setViewportSize(viewport: HTMLElement, height: { scroll: number; client: number }) {
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    get: () => height.scroll,
  });
  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    get: () => height.client,
  });
}

function triggerResize() {
  act(() => notifyResize?.([], {} as ResizeObserver));
}

describe("conversation auto-scroll", () => {
  it("keeps the first streaming reply at the bottom when it begins to overflow", () => {
    render(<ScrollHarness />);
    const viewport = screen.getByLabelText("消息列表");
    const height = { scroll: 400, client: 400 };
    setViewportSize(viewport, height);
    triggerResize();

    height.scroll = 800;
    fireEvent.scroll(viewport);
    triggerResize();

    expect(viewport.scrollTop).toBe(400);
    expect(screen.queryByText("回到最新")).toBeNull();
  });

  it("does not pull the reader back when they scroll up before more text arrives", () => {
    render(<ScrollHarness />);
    const viewport = screen.getByLabelText("消息列表");
    const height = { scroll: 800, client: 400 };
    setViewportSize(viewport, height);
    triggerResize();
    expect(viewport.scrollTop).toBe(400);

    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);
    height.scroll = 1000;
    triggerResize();

    expect(viewport.scrollTop).toBe(0);
    expect(screen.getByText("回到最新")).toBeTruthy();
  });

  it("keeps following when the composer reduces the message viewport height", () => {
    render(<ScrollHarness />);
    const viewport = screen.getByLabelText("消息列表");
    const height = { scroll: 800, client: 400 };
    setViewportSize(viewport, height);
    triggerResize();

    height.client = 300;
    fireEvent.scroll(viewport);
    triggerResize();

    expect(viewport.scrollTop).toBe(500);
    expect(screen.queryByText("回到最新")).toBeNull();
  });
});
